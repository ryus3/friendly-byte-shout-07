import React from 'react';
import Deno from 'https://deno.land/x/deno@v1.36.4/cli/deno.ts';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Handle CORS preflight requests
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method === 'POST') {
      const { action, data } = await req.json();

      if (action === 'create_backup') {
        console.log('🔄 بدء إنشاء النسخة الاحتياطية...');
        
        // قائمة الجداول المهمة للنسخ الاحتياطي
        const tablesToBackup = [
          'products',
          'product_variants', 
          'inventory',
          'orders',
          'order_items',
          'customers',
          'purchases',
          'purchase_items',
          'expenses',
          'cash_sources',
          'cash_movements',
          'profits',
          'colors',
          'sizes',
          'categories',
          'departments',
          'profiles',
          'settings',
          'notifications'
        ];

        const backupData = {
          timestamp: new Date().toISOString(),
          version: '1.0',
          tables: {}
        };

        // نسخ البيانات من كل جدول
        for (const table of tablesToBackup) {
          try {
            console.log(`📋 نسخ جدول: ${table}`);
            const { data: tableData, error } = await supabase
              .from(table)
              .select('*');
            
            if (error) {
              console.warn(`⚠️ خطأ في نسخ جدول ${table}:`, error.message);
              continue;
            }
            
            backupData.tables[table] = tableData || [];
            console.log(`✅ تم نسخ ${tableData?.length || 0} سجل من جدول ${table}`);
          } catch (err) {
            console.warn(`⚠️ فشل في نسخ جدول ${table}:`, err.message);
          }
        }

        // حفظ النسخة الاحتياطية في جدول خاص
        const backupFileName = `backup_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;
        
        const { error: saveError } = await supabase
          .from('system_backups')
          .insert({
            filename: backupFileName,
            backup_data: backupData,
            size_mb: JSON.stringify(backupData).length / (1024 * 1024),
            created_by: data.userId || null,
            backup_type: 'full'
          });

        if (saveError) {
          console.error('❌ خطأ في حفظ النسخة الاحتياطية:', saveError);
          throw new Error('فشل في حفظ النسخة الاحتياطية');
        }

        console.log('✅ تم إنشاء النسخة الاحتياطية بنجاح');
        
        return new Response(JSON.stringify({
          success: true,
          message: 'تم إنشاء النسخة الاحتياطية بنجاح',
          filename: backupFileName,
          tables_count: Object.keys(backupData.tables).length,
          total_records: Object.values(backupData.tables).reduce((sum, table) => sum + table.length, 0)
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      if (action === 'restore_backup') {
        console.log('🔄 بدء استعادة النسخة الاحتياطية...');
        
        const { backupId, options = {} } = data;
        
        // جلب النسخة الاحتياطية
        const { data: backup, error: fetchError } = await supabase
          .from('system_backups')
          .select('*')
          .eq('id', backupId)
          .single();

        if (fetchError || !backup) {
          throw new Error('النسخة الاحتياطية غير موجودة');
        }

        const backupData = backup.backup_data;
        const restoredTables = [];

        // استعادة البيانات
        for (const [tableName, tableData] of Object.entries(backupData.tables)) {
          try {
            if (options.clearExisting) {
              console.log(`🗑️ مسح بيانات جدول: ${tableName}`);
              await supabase.from(tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000');
            }

            if (tableData && tableData.length > 0) {
              console.log(`📥 استعادة ${tableData.length} سجل في جدول: ${tableName}`);
              
              // تقسيم البيانات إلى مجموعات صغيرة لتجنب مشاكل الحجم
              const batchSize = 100;
              for (let i = 0; i < tableData.length; i += batchSize) {
                const batch = tableData.slice(i, i + batchSize);
                const { error } = await supabase
                  .from(tableName)
                  .upsert(batch, { onConflict: 'id' });
                
                if (error) {
                  console.warn(`⚠️ خطأ في استعادة مجموعة من ${tableName}:`, error.message);
                }
              }
              
              restoredTables.push({
                table: tableName,
                records: tableData.length
              });
            }
          } catch (err) {
            console.warn(`⚠️ فشل في استعادة جدول ${tableName}:`, err.message);
          }
        }

        console.log('✅ تم استعادة النسخة الاحتياطية بنجاح');

        return new Response(JSON.stringify({
          success: true,
          message: 'تم استعادة النسخة الاحتياطية بنجاح',
          restored_tables: restoredTables,
          total_records: restoredTables.reduce((sum, t) => sum + t.records, 0)
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      if (action === 'list_backups') {
        const { data: backups, error } = await supabase
          .from('system_backups')
          .select('id, filename, created_at, size_mb, backup_type, created_by, profiles!created_by(full_name)')
          .order('created_at', { ascending: false });

        if (error) {
          throw new Error('فشل في جلب قائمة النسخ الاحتياطية');
        }

        return new Response(JSON.stringify({
          success: true,
          backups: backups || []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      if (action === 'delete_backup') {
        const { backupId } = data;
        
        const { error } = await supabase
          .from('system_backups')
          .delete()
          .eq('id', backupId);

        if (error) {
          throw new Error('فشل في حذف النسخة الاحتياطية');
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'تم حذف النسخة الاحتياطية بنجاح'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      if (action === 'download_backup') {
        const { backupId } = data;
        
        const { data: backup, error } = await supabase
          .from('system_backups')
          .select('*')
          .eq('id', backupId)
          .single();

        if (error || !backup) {
          throw new Error('النسخة الاحتياطية غير موجودة');
        }

        return new Response(JSON.stringify(backup.backup_data), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="${backup.filename}"`
          },
          status: 200
        });
      }

    }

    return new Response(JSON.stringify({
      success: false,
      message: 'إجراء غير صحيح'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });

  } catch (error) {
    console.error('❌ خطأ في النسخ الاحتياطي:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: error.message || 'حدث خطأ غير متوقع'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});