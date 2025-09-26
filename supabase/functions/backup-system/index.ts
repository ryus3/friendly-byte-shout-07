import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  console.log('🔥 Backup System function called:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const requestData = await req.json();
    const { action, data } = requestData;
    console.log('📋 Action requested:', action, 'with data:', data);

    switch (action) {
      case 'list_backups':
        return await listBackups(supabase);
      
      case 'create_backup':
        return await createBackup(supabase, data);
      
      case 'restore_backup':
        return await restoreBackup(supabase, data);
      
      case 'download_backup':
        return await downloadBackup(supabase, data);
      
      case 'delete_backup':
        return await deleteBackup(supabase, data);
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
  } catch (error) {
    console.error('❌ Backup System Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});

// جلب قائمة النسخ الاحتياطية
async function listBackups(supabase: any) {
  console.log('📋 Listing backups...');
  
  try {
    // جلب النسخ الاحتياطية مع أسماء المستخدمين
    const { data: backups, error } = await supabase
      .from('system_backups')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error listing backups:', error);
      throw error;
    }

    // جلب أسماء المستخدمين
    const userIds = [...new Set(backups?.map(b => b.created_by).filter(Boolean))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', userIds);

    // دمج البيانات
    const backupsWithNames = backups?.map(backup => ({
      ...backup,
      creator_name: profiles?.find(p => p.user_id === backup.created_by)?.full_name || 'غير معروف'
    })) || [];

    console.log(`✅ Found ${backupsWithNames.length} backups`);
    
    return new Response(
      JSON.stringify({
        success: true,
        backups: backupsWithNames || []
      }),
      {
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('❌ List backups error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        backups: []
      }),
      {
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
}

// إنشاء نسخة احتياطية
async function createBackup(supabase: any, data: any) {
  console.log('🔄 Creating backup...');
  
  const tablesToBackup = [
    'profiles', 'products', 'product_variants', 'inventory', 'orders', 'order_items',
    'customers', 'purchases', 'purchase_items', 'expenses', 'profits', 'colors', 
    'sizes', 'categories', 'brands', 'suppliers', 'cash_sources', 'cash_movements', 
    'financial_transactions', 'purchase_cost_history'
  ];

  const backupData: any = {};
  let totalRecords = 0;

  for (const table of tablesToBackup) {
    try {
      console.log(`📊 Backing up table: ${table}`);
      const { data: tableData, error } = await supabase
        .from(table)
        .select('*');

      if (error) {
        console.warn(`⚠️ Warning backing up ${table}:`, error);
        backupData[table] = [];
        continue;
      }

      backupData[table] = tableData || [];
      totalRecords += (tableData || []).length;
      console.log(`✅ Table ${table}: ${(tableData || []).length} records`);
    } catch (error) {
      console.warn(`⚠️ Error backing up ${table}:`, error);
      backupData[table] = [];
    }
  }

  // حفظ النسخة الاحتياطية في قاعدة البيانات
  const filename = `backup_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
  const backupJson = JSON.stringify(backupData, null, 2);
  const sizeMB = new Blob([backupJson]).size / (1024 * 1024);

  try {
    const { data: backup, error: insertError } = await supabase
      .from('system_backups')
      .insert({
        filename,
        backup_data: backupData,
        size_mb: Math.round(sizeMB * 100) / 100,
        backup_type: 'full',
        tables_count: tablesToBackup.length,
        total_records: totalRecords,
        created_by: data?.userId,
        is_auto_backup: false
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error saving backup:', insertError);
      throw insertError;
    }

    console.log(`✅ Backup created successfully: ${totalRecords} records from ${tablesToBackup.length} tables`);

    return new Response(
      JSON.stringify({
        success: true,
        backup_id: backup.id,
        filename,
        total_records: totalRecords,
        tables_count: tablesToBackup.length,
        size_mb: Math.round(sizeMB * 100) / 100
      }),
      {
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('❌ Create backup error:', error);
    throw error;
  }
}

// استعادة نسخة احتياطية
async function restoreBackup(supabase: any, data: any) {
  console.log('🔄 Restoring backup:', data.backupId);
  
  try {
    // جلب بيانات النسخة الاحتياطية
    const { data: backup, error: fetchError } = await supabase
      .from('system_backups')
      .select('backup_data, filename')
      .eq('id', data.backupId)
      .single();

    if (fetchError || !backup) {
      throw new Error('النسخة الاحتياطية غير موجودة');
    }

    const backupData = backup.backup_data;
    let totalRestored = 0;

    // حذف البيانات الموجودة إذا طُلب ذلك
    if (data.options?.clearExisting) {
      console.log('🗑️ Clearing existing data...');
      const tablesToClear = Object.keys(backupData);
      
      for (const table of tablesToClear.reverse()) {
        try {
          await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
          console.log(`✅ Cleared table: ${table}`);
        } catch (error) {
          console.warn(`⚠️ Warning clearing ${table}:`, error);
        }
      }
    }

    // استعادة البيانات
    for (const [table, records] of Object.entries(backupData)) {
      if (!Array.isArray(records) || records.length === 0) continue;

      try {
        console.log(`📥 Restoring ${table}: ${records.length} records`);
        
        const { error } = await supabase
          .from(table)
          .upsert(records, { onConflict: 'id' });

        if (error) {
          console.warn(`⚠️ Warning restoring ${table}:`, error);
          continue;
        }

        totalRestored += records.length;
        console.log(`✅ Restored ${table}: ${records.length} records`);
      } catch (error) {
        console.warn(`⚠️ Error restoring ${table}:`, error);
      }
    }

    console.log(`✅ Backup restored successfully: ${totalRestored} records`);

    return new Response(
      JSON.stringify({
        success: true,
        total_records: totalRestored,
        message: `تم استعادة ${totalRestored} سجل بنجاح`
      }),
      {
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('❌ Restore backup error:', error);
    throw error;
  }
}

// تحميل نسخة احتياطية
async function downloadBackup(supabase: any, data: any) {
  console.log('⬇️ Downloading backup:', data.backupId);
  
  try {
    const { data: backup, error } = await supabase
      .from('system_backups')
      .select('backup_data, filename')
      .eq('id', data.backupId)
      .single();

    if (error || !backup) {
      throw new Error('النسخة الاحتياطية غير موجودة');
    }

    return new Response(
      JSON.stringify(backup.backup_data),
      {
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('❌ Download backup error:', error);
    throw error;
  }
}

// حذف نسخة احتياطية
async function deleteBackup(supabase: any, data: any) {
  console.log('🗑️ Deleting backup:', data.backupId);
  
  try {
    const { error } = await supabase
      .from('system_backups')
      .delete()
      .eq('id', data.backupId);

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'تم حذف النسخة الاحتياطية بنجاح'
      }),
      {
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('❌ Delete backup error:', error);
    throw error;
  }
}