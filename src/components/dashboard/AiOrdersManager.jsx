import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select.jsx';
import { useLocalStorage } from '@/hooks/useLocalStorage.jsx';
import { 
  Bot, 
  MessageSquare, 
  Clock, 
  AlertTriangle, 
  CheckCircle2,
  XCircle,
  Send,
  Eye,
  X,
  Brain,
  Zap,
  Smartphone,
  Users,
  TrendingUp,
  Activity,
  Trash2,
  ShoppingCart
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSuper } from '@/contexts/SuperProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import AiOrderCard from './AiOrderCard';
import AiOrderDestinationSelector from '@/components/ai-orders/AiOrderDestinationSelector';
import { useUnifiedUserData } from '@/hooks/useUnifiedUserData';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';

const AiOrdersManager = ({ open, onClose, highlightId }) => {
  const { aiOrders = [], loading, refreshAll, products = [], approveAiOrder, users = [] } = useSuper();
  const ordersFromContext = Array.isArray(aiOrders) ? aiOrders : [];
  const [orders, setOrders] = useState(ordersFromContext);
  
  // LocalStorage للطلبات المعالجة (معتمدة أو محذوفة)
  const [processedOrders, setProcessedOrders] = useLocalStorage('processedAiOrders', []);
  
  // إزالة التكرار وترتيب الأحدث أولاً من السياق مع فلترة الطلبات المعالجة
  const dedupedContextOrders = useMemo(() => {
    const map = new Map();
    for (const o of ordersFromContext) {
      // فلترة الطلبات المعتمدة والمعالجة محلياً لمنع إعادة ظهورها
      if (o && o.id && !map.has(o.id) && o.status !== 'approved' && o.status !== 'deleted' && !processedOrders.includes(o.id)) {
        map.set(o.id, o);
      }
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [ordersFromContext, processedOrders]);
  
  // تزامن مع البيانات من Context عند التحديث
  useEffect(() => {
    setOrders(dedupedContextOrders);
  }, [dedupedContextOrders]);
  
  // إعدادات وجهة الطلبات (تعريفها قبل استخدام أي تأثير يعتمد عليها لتفادي TDZ)
  const [orderDestination, setOrderDestination] = useState({
    destination: 'local',
    account: '',
    partnerName: 'local'
  });
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  // إعدادات الموافقة التلقائية
  const [autoApprovalEnabled, setAutoApprovalEnabled] = useState(false);
  // بيانات المستخدم الموحدة لاستخدامها في تحديد ملكية الطلبات
  const { isAdmin, userUUID, employeeCode } = useUnifiedUserData();
  
  // مستمعات Real-time للتحديثات الفورية مع موافقة تلقائية محسنة
  useEffect(() => {
    const handleAiOrderCreated = async (event) => {
      const newOrder = event.detail;
      if (newOrder?.id) {
        setOrders(prev => {
          // تجنب التكرار
          if (prev.some(o => o.id === newOrder.id)) return prev;
          return [newOrder, ...prev];
        });

        // الموافقة التلقائية المحسنة - تعمل فوراً عند وصول طلب جديد
        if (preferencesLoaded && autoApprovalEnabled && newOrder.status === 'pending') {
          console.log('🤖 بدء الموافقة التلقائية للطلب الجديد:', newOrder.id);
          
          // فحص شامل للطلب
          const availability = availabilityOf(newOrder);
          const needsReview = orderNeedsReview(newOrder);
          const isFromTelegram = newOrder.source === 'telegram' || newOrder.order_data?.source === 'telegram';
          // تحقق من ملكية الطلب: الموافقة التلقائية تخص هذا المستخدم فقط
          const by = newOrder?.created_by ?? newOrder?.user_id ?? newOrder?.created_by_employee_code ?? newOrder?.order_data?.created_by;
          const byNorm = by ? String(by).toUpperCase() : '';
          const candidates = [userUUID, employeeCode].filter(Boolean).map(v => String(v).toUpperCase());
          const isMine = candidates.length > 0 && byNorm && candidates.includes(byNorm);
          
          console.log('📋 تقييم الطلب للموافقة التلقائية:', {
            availability,
            needsReview,
            isFromTelegram,
            isMine,
            destination: orderDestination.destination,
            hasAccount: !!orderDestination.account
          });
          
          // شروط الموافقة التلقائية المحسنة
          const canAutoApprove = (
            availability === 'available' && 
            !needsReview && 
            isFromTelegram && // فقط طلبات التليغرام
            isMine && // تخص هذا المستخدم فقط
            (orderDestination.destination === 'local' || 
             (orderDestination.destination !== 'local' && orderDestination.account))
          );
          
          if (canAutoApprove) {
            try {
              console.log('✅ تنفيذ الموافقة التلقائية للطلب:', newOrder.id);
              
              // إزالة الطلب من القائمة فوراً لمنع ظهوره
              setOrders(prev => prev.filter(o => o.id !== newOrder.id));
              setProcessedOrders(prev => [...prev, newOrder.id]);
              
              // تنفيذ الموافقة في الخلفية
              const result = await approveAiOrder?.(
                newOrder.id, 
                orderDestination.destination, 
                orderDestination.account
              );
              
              if (result?.success) {
                toast({
                  title: "✅ تمت الموافقة التلقائية",
                  description: `طلب التليغرام تم إرساله لشركة التوصيل تلقائياً`,
                  variant: "success"
                });
                
                // تحديث حالة الطلب في قاعدة البيانات
                try {
                  await supabase.from('ai_orders').update({ 
                    status: 'approved',
                    processed_at: new Date().toISOString()
                  }).eq('id', newOrder.id);
                } catch (updateError) {
                  console.warn('تحذير: فشل تحديث حالة الطلب:', updateError);
                }
                
                window.dispatchEvent(new CustomEvent('aiOrderApproved', { detail: { id: newOrder.id } }));
              } else {
                console.error('❌ فشلت الموافقة التلقائية:', result?.error);
                // إعادة الطلب للقائمة في حالة الفشل
                setOrders(prev => [newOrder, ...prev]);
                setProcessedOrders(prev => prev.filter(id => id !== newOrder.id));
              }
            } catch (error) {
              console.error('❌ خطأ في الموافقة التلقائية:', error);
              // إعادة الطلب للقائمة في حالة الخطأ
              setOrders(prev => [newOrder, ...prev]);
              setProcessedOrders(prev => prev.filter(id => id !== newOrder.id));
            }
          } else {
            console.log('⚠️ الطلب لا يستوفي شروط الموافقة التلقائية');
          }
        }
      }
    };

    const handleAiOrderDeleted = (event) => {
      const deletedId = event.detail?.id;
      if (deletedId) {
        console.log('📢 تم الإشعار بحذف الطلب:', deletedId);
        setOrders(prev => prev.filter(o => o.id !== deletedId));
        setProcessedOrders(prev => {
          const updated = [...prev, deletedId];
          console.log('📝 تحديث قائمة الطلبات المحذوفة:', updated.length);
          return updated;
        });
      }
    };

    const handleAiOrderApproved = (event) => {
      const approvedId = event.detail?.id;
      if (approvedId) {
        console.log('📢 تم الإشعار بموافقة الطلب:', approvedId);
        setOrders(prev => prev.filter(o => o.id !== approvedId));
        setProcessedOrders(prev => {
          const updated = [...prev, approvedId];
          console.log('📝 تحديث قائمة الطلبات المعالجة:', updated.length);
          return updated;
        });
      }
    };

    window.addEventListener('aiOrderCreated', handleAiOrderCreated);
    window.addEventListener('aiOrderDeleted', handleAiOrderDeleted);
    window.addEventListener('aiOrderApproved', handleAiOrderApproved);

    return () => {
      window.removeEventListener('aiOrderCreated', handleAiOrderCreated);
      window.removeEventListener('aiOrderDeleted', handleAiOrderDeleted);
      window.removeEventListener('aiOrderApproved', handleAiOrderApproved);
    };
  }, [preferencesLoaded, autoApprovalEnabled, orderDestination, approveAiOrder]);
  
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [statFilter, setStatFilter] = useState('all'); // all | needs_review | telegram | ai_chat | store | pending

// إذا تم تمرير معرّف للتمييز عند الفتح، حدده تلقائياً مع التمرير إليه
useEffect(() => {
  if (highlightId) {
    setSelectedOrders(prev => (prev.includes(highlightId) ? prev : [...prev, highlightId]));
    setTimeout(() => {
      const el = document.getElementById(`ai-order-${highlightId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }
}, [highlightId, orders]);
  const { user, allUsers = [] } = useAuth();
  const [telegramCode, setTelegramCode] = useState(null);
  useEffect(() => {
    const fetchCode = async () => {
      if (!user?.user_id) return;
      try {
        const { data } = await supabase
          .from('employee_telegram_codes')
          .select('telegram_code')
          .eq('user_id', user.user_id)
          .single();
        if (data?.telegram_code) setTelegramCode(String(data.telegram_code).toUpperCase());
      } catch (e) {
        // ignore
      }
    };
    fetchCode();
  }, [user?.user_id]);

  // فلتر الموظفين مع حفظ محلي: الافتراضي "جميع الموظفين"
  const [employeeFilter, setEmployeeFilter] = useLocalStorage('aiOrdersEmployeeFilter', 'all');
  const employeesOnly = useMemo(
    () => (allUsers || []).filter(u => 
      u?.status === 'active' &&
      Array.isArray(u?.roles) &&
      u.roles.some(r => ['super_admin','admin','department_manager','sales_employee','warehouse_employee','cashier'].includes(r))
    ),
    [allUsers]
  );

  // تحميل إعدادات المستخدم (الوجهة والموافقة التلقائية) مع تحسينات
  useEffect(() => {
    const loadUserPreferences = async () => {
      if (!user?.user_id) return;
      try {
        console.log('📋 تحميل إعدادات المستخدم للموافقة التلقائية...');
        const { data } = await supabase
          .from('profiles')
          .select('auto_approval_enabled, default_ai_order_destination, selected_delivery_account')
          .eq('user_id', user.user_id)
          .single();
        
        if (data) {
          const autoApproval = data.auto_approval_enabled || false;
          const destination = data.default_ai_order_destination || 'local';
          const account = data.selected_delivery_account || '';
          
          console.log('⚙️ إعدادات المستخدم المحملة:', {
            autoApproval,
            destination,
            hasAccount: !!account
          });
          
          setAutoApprovalEnabled(autoApproval);
          
          if (destination && destination !== 'local') {
            setOrderDestination({
              destination: destination,
              account: account,
              partnerName: destination
            });
          } else {
            setOrderDestination({
              destination: 'local',
              account: '',
              partnerName: 'local'
            });
          }
          
          console.log('✅ تم تحميل إعدادات الموافقة التلقائية بنجاح');
        }
      } catch (error) {
        console.error('❌ خطأ في تحميل إعدادات المستخدم:', error);
      } finally {
        setPreferencesLoaded(true);
      }
    };
    loadUserPreferences();
  }, [user?.user_id]);

  // معالجة الطلبات الموجودة عند تفعيل الموافقة التلقائية
  const processedExistingRef = useRef(false);
  useEffect(() => {
    if (!preferencesLoaded || !autoApprovalEnabled || !orders?.length || processedExistingRef.current) return;
    
    console.log('🔄 معالجة الطلبات الموجودة للموافقة التلقائية...');
    processedExistingRef.current = true;
    
    (async () => {
      const candidates = orders
        .filter(o => o?.status === 'pending')
        .filter(o => availabilityOf(o) === 'available' && !orderNeedsReview(o))
        .filter(o => o.source === 'telegram' || o.order_data?.source === 'telegram')
        .slice(0, 10); // حد أقصى لمنع الضغط
      
      console.log(`📦 وجد ${candidates.length} طلباً مؤهلاً للموافقة التلقائية`);
      
      for (const o of candidates) {
        try {
          console.log('🤖 معالجة طلب موجود:', o.id);
          
          // إزالة من القائمة فوراً
          setOrders(prev => prev.filter(x => x.id !== o.id));
          setProcessedOrders(prev => [...prev, o.id]);
          
          const res = await approveAiOrder?.(o.id, orderDestination.destination, orderDestination.account);
          if (res?.success) {
            console.log('✅ تمت موافقة الطلب الموجود:', o.id);
            try { 
              await supabase.from('ai_orders').update({ 
                status: 'approved',
                processed_at: new Date().toISOString()
              }).eq('id', o.id); 
            } catch {}
            window.dispatchEvent(new CustomEvent('aiOrderApproved', { detail: { id: o.id } }));
          } else {
            console.error('فشلت موافقة الطلب الموجود:', o.id, res?.error);
            // إعادة للقائمة في حالة الفشل
            setOrders(prev => [o, ...prev]);
            setProcessedOrders(prev => prev.filter(id => id !== o.id));
          }
        } catch (err) {
          console.error('خطأ في موافقة الطلب الموجود:', o.id, err);
          // إعادة للقائمة في حالة الخطأ
          setOrders(prev => [o, ...prev]);
          setProcessedOrders(prev => prev.filter(id => id !== o.id));
        }
      }
    })();
  }, [orders, preferencesLoaded, autoApprovalEnabled, orderDestination, approveAiOrder, availabilityOf, orderNeedsReview]);

  // صلاحيات وهوية المستخدم + مطابقة الطلبات
  const { isDepartmentManager } = usePermissions();
  const matchesCurrentUser = useCallback((order) => {
    const by = order?.created_by ?? order?.user_id ?? order?.created_by_employee_code ?? order?.order_data?.created_by;
    const candidates = [employeeCode, userUUID, telegramCode]
      .filter(Boolean)
      .map(v => String(v).toUpperCase());
    const byNorm = by ? String(by).toUpperCase() : '';
    return by ? candidates.some(v => v === byNorm) : false;
  }, [employeeCode, userUUID, telegramCode]);

  const matchesOrderByProfile = useCallback((order, profile) => {
    if (!order || !profile) return false;
    const by = order?.created_by ?? order?.user_id ?? order?.created_by_employee_code ?? order?.order_data?.created_by;
    const candidates = [profile?.employee_code, profile?.user_id, profile?.id, profile?.username]
      .filter(Boolean)
      .map(v => String(v).toUpperCase());
    const byNorm = by ? String(by).toUpperCase() : '';
    return by ? candidates.some(v => v === byNorm) : false;
  }, []);

  const baseVisible = useMemo(() => (
    (isAdmin || isDepartmentManager) ? orders : orders.filter(matchesCurrentUser)
  ), [orders, isAdmin, isDepartmentManager, matchesCurrentUser]);

  const visibleOrders = useMemo(() => {
    let list = baseVisible;
    if (employeeFilter === 'all') return list;
    if (employeeFilter?.startsWith('user:')) {
      const uid = employeeFilter.slice(5);
      const u = (allUsers || []).find(x => String(x?.user_id) === uid || String(x?.id) === uid);
      return u ? list.filter(o => matchesOrderByProfile(o, u)) : list;
    }
    return list;
  }, [baseVisible, employeeFilter, allUsers, matchesOrderByProfile]);

  // Availability helpers based on products
  const variants = useMemo(() => {
    const v = [];
    (products || []).forEach(p => {
      const list = Array.isArray(p.variants) ? p.variants : (p.product_variants || []);
      list.forEach(vi => v.push({ ...vi, product_id: p.id, product_name: p.name }));
    });
    return v;
  }, [products]);

  const availabilityOf = useCallback((order) => {
    const items = Array.isArray(order?.items) ? order.items : (order?.order_data?.items || []);
    if (!items.length) return 'unknown';
    const lower = (v) => (v || '').toString().trim().toLowerCase();
    const findByVariantId = (id) => variants.find(v => v.id === id);
    const findByProductId = (pid) => variants.find(v => v.product_id === pid);
    const findByName = (name, color, size) => {
      const vname = lower(name);
      const normalizeSize = (s) => {
        if (!s) return '';
        let str = String(s).trim().toLowerCase();
        const digits = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
        str = str.replace(/[٠-٩]/g, (d) => digits[d]);
        str = str.replace(/اكسات/g, 'اكس');
        str = str.replace(/ثلاثة\s*اكس|ثلاث\s*اكس|3\s*اكس|٣\s*اكس/g, 'xxx');
        str = str.replace(/(2|٢)\s*اكس/g, 'xx');
        str = str.replace(/اكسين/g, 'xx');
        str = str.replace(/اكس/g, 'x');
        str = str.replace(/لارج|large|lrg/g, '');
        str = str.replace(/\s|-/g, '');
        if (/^(3xl|xxxl|xxx|3x)$/.test(str)) return 'xxxl';
        if (/^(2xl|xxl|xx|2x)$/.test(str)) return 'xxl';
        if (/^(xl|x)$/.test(str)) return 'xl';
        if (str.includes('xxx') || str.includes('3x')) return 'xxxl';
        if (str.includes('xx') || str.includes('2x')) return 'xxl';
        if (str.includes('x')) return 'xl';
        return str;
      };
      const matches = variants.filter(v => lower(v.product_name) === vname || lower(v.product_name).includes(vname));
      if (!matches.length) return null;
      if (color || size) {
        const ns = normalizeSize(size);
        return matches.find(v => lower(v.color || v.color_name) === lower(color) && normalizeSize(v.size || v.size_name) === ns)
          || matches.find(v => lower(v.color || v.color_name) === lower(color))
          || matches.find(v => normalizeSize(v.size || v.size_name) === ns)
          || matches[0];
      }
      return matches[0];
    };

    let allMatched = true;
    let allAvailable = true;

    for (const it of items) {
      const qty = Number(it.quantity || 1);
      let variant = null;
      if (it.variant_id) variant = findByVariantId(it.variant_id);
      else if (it.product_id) variant = findByProductId(it.product_id);
      else variant = findByName(it.product_name || it.name || it.product, it.color, it.size);
      if (!variant) { allMatched = false; continue; }
      const available = (Number(variant.quantity ?? 0) - Number(variant.reserved_quantity ?? 0));
      if (available < qty) { allAvailable = false; }
    }
    if (!allMatched) return 'unknown';
    return allAvailable ? 'available' : 'out';
  }, [variants]);

  // تحديد الحاجة للمراجعة بدقة (يشمل فقدان المقاس/اللون)
  const orderNeedsReview = useCallback((order) => {
    const items = Array.isArray(order?.items) ? order.items : (order?.order_data?.items || []);
    const lower = (v) => (v || '').toString().trim().toLowerCase();
    const productHasAnyColor = (it) => {
      const list = variants.filter(v => (it.product_id ? v.product_id === it.product_id : lower(v.product_name) === lower(it.product_name || it.name || it.product)));
      return list.some(v => v.color || v.color_name);
    };
    const productHasAnySize = (it) => {
      const list = variants.filter(v => (it.product_id ? v.product_id === it.product_id : lower(v.product_name) === lower(it.product_name || it.name || it.product)));
      return list.some(v => v.size || v.size_name);
    };
    const statusFlag = ['needs_review','review','error','failed'].includes(order.status);
    const availFlag = availabilityOf(order) !== 'available';
    let missingAttr = false;
    for (const it of items) {
      const miss = it?.missing_attributes || {};
      if (miss?.need_color || miss?.need_size) { missingAttr = true; break; }
      if (!it?.color && productHasAnyColor(it)) { missingAttr = true; break; }
      if (!it?.size && productHasAnySize(it)) { missingAttr = true; break; }
    }
    return statusFlag || availFlag || missingAttr;
  }, [variants, availabilityOf]);


  const totalCount = visibleOrders.length;
  const pendingCount = visibleOrders.filter(order => order.status === 'pending').length;
  const needsReviewCount = visibleOrders.filter(orderNeedsReview).length;
  const telegramCount = visibleOrders.filter(order => order.source === 'telegram').length;
  const aiChatCount = visibleOrders.filter(order => order.source === 'ai_chat').length;
  const storeCount = visibleOrders.filter(order => order.source === 'web' || order.source === 'store').length;

  const filteredOrders = useMemo(() => {
    switch (statFilter) {
      case 'needs_review':
        return visibleOrders.filter(orderNeedsReview);
      case 'telegram':
        return visibleOrders.filter(order => order.source === 'telegram');
      case 'ai_chat':
        return visibleOrders.filter(order => order.source === 'ai_chat');
      case 'store':
        return visibleOrders.filter(order => order.source === 'web' || order.source === 'store');
      case 'pending':
        return visibleOrders.filter(order => order.status === 'pending');
      default:
        return visibleOrders;
    }
  }, [visibleOrders, statFilter]);

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedOrders(filteredOrders.map(order => order.id));
    } else {
      setSelectedOrders([]);
    }
  };

  const handleSelectOrder = (orderId, checked) => {
    if (checked) {
      setSelectedOrders(prev => [...prev, orderId]);
    } else {
      setSelectedOrders(prev => prev.filter(id => id !== orderId));
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedOrders.length === 0) return;
    
    // التحقق من صحة الوجهة والحساب قبل الموافقة
    if (action === 'approve') {
      // فحص إذا كانت هناك طلبات تليغرام والوجهة شركة توصيل بدون حساب محدد
      const hasTelegramOrders = selectedOrders.some(orderId => {
        const order = orders.find(o => o.id === orderId);
        return order?.source === 'telegram' || order?.order_data?.source === 'telegram';
      });
      
      if (hasTelegramOrders && orderDestination?.destination !== 'local' && !orderDestination?.account) {
        toast({
          title: "حساب التوصيل مطلوب",
          description: "طلبات التليغرام تتطلب تحديد حساب شركة التوصيل في إعدادات الوجهة",
          variant: "destructive"
        });
        return;
      }
      
      if (orderDestination.destination !== 'local' && !orderDestination.account) {
        toast({
          title: "خطأ في الإعدادات",
          description: `يجب تحديد حساب لشركة التوصيل ${orderDestination.destination} أولاً`,
          variant: "destructive"
        });
        return;
      }
    }
    
    try {
      if (action === 'approve') {
        // تحديث فوري محلياً أولاً
        const approvedIds = [...selectedOrders];
        setOrders(prev => prev.filter(o => !approvedIds.includes(o.id)));
        toast({ title: 'تتم المعالجة...', description: `جاري الموافقة على ${approvedIds.length} طلب`, variant: 'default' });
        
        // المعالجة الفعلية في الخلفية مع تمرير وجهة الطلب
        const results = await Promise.all(approvedIds.map(id => 
          approveAiOrder?.(id, orderDestination.destination, orderDestination.account)
        ));
        const successIds = approvedIds.filter((_, i) => results[i]?.success);
        const failedIds = approvedIds.filter((_, i) => !results[i]?.success);
        
        // تحديث حالة الطلبات المعتمدة لمنع إعادة ظهورها
        if (successIds.length > 0) {
          await supabase
            .from('ai_orders')
            .update({ status: 'approved' })
            .in('id', successIds);
        }
        
        // إضافة الطلبات الفاشلة للقائمة مرة أخرى
        if (failedIds.length > 0) {
          const failedOrders = ordersFromContext.filter(o => failedIds.includes(o.id));
          setOrders(prev => [...failedOrders, ...prev]);
        }
        
        // إضافة الطلبات المعتمدة للمعالجة
        if (successIds.length > 0) {
          setProcessedOrders(prev => [...prev, ...successIds]);
          successIds.forEach(id => {
            try { window.dispatchEvent(new CustomEvent('aiOrderApproved', { detail: { id } })); } catch {}
          });
          toast({ title: 'تمت الموافقة', description: `تمت الموافقة على ${successIds.length} طلب بنجاح`, variant: 'success' });
        }
        if (failedIds.length > 0) {
          toast({ title: 'تنبيه', description: `فشل في الموافقة على ${failedIds.length} طلب`, variant: 'destructive' });
        }
        
      } else if (action === 'delete') {
        // تحديث فوري محلياً أولاً
        const deletedIds = [...selectedOrders];
        setOrders(prev => prev.filter(o => !deletedIds.includes(o.id)));
        toast({ title: 'تتم المعالجة...', description: `جاري حذف ${deletedIds.length} طلب`, variant: 'default' });
        
        // الحذف الفعلي في الخلفية
        const results = await Promise.all(deletedIds.map(async (id) => {
          try {
            const { data, error } = await supabase.rpc('delete_ai_order_safe', { p_order_id: id });
            return { id, success: !error && data?.success !== false };
          } catch {
            return { id, success: false };
          }
        }));
        
        const successIds = results.filter(r => r.success).map(r => r.id);
        const failedIds = results.filter(r => !r.success).map(r => r.id);
        
        // تحديث الحالة في قاعدة البيانات لمنع إعادة ظهورها
        if (successIds.length > 0) {
          try { await supabase.from('ai_orders').update({ status: 'deleted' }).in('id', successIds); } catch {}
        }
        
        // إضافة الطلبات الفاشلة للقائمة مرة أخرى
        if (failedIds.length > 0) {
          const failedOrders = ordersFromContext.filter(o => failedIds.includes(o.id));
          setOrders(prev => [...failedOrders, ...prev]);
        }
        
        // إضافة الطلبات المحذوفة للمعالجة
        if (successIds.length > 0) {
          setProcessedOrders(prev => [...prev, ...successIds]);
          successIds.forEach(id => {
            try { window.dispatchEvent(new CustomEvent('aiOrderDeleted', { detail: { id } })); } catch {}
          });
          toast({ title: 'تم الحذف', description: `تم حذف ${successIds.length} طلب بنجاح`, variant: 'success' });
        }
        if (failedIds.length > 0) {
          toast({ title: 'تنبيه', description: `فشل في حذف ${failedIds.length} طلب`, variant: 'destructive' });
        }
      }
    } catch (e) {
      // في حالة خطأ شامل، أعد تحميل البيانات
      console.error('Bulk action error:', e);
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء تنفيذ العملية', variant: 'destructive' });
      try { await refreshAll?.(); } catch (_) {}
    } finally {
      setSelectedOrders([]);
    }
  };

  // عدم عرض الحوار إذا لم يكن مفتوحاً
  if (open === false) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-lg z-[1200] flex items-center justify-center p-4" onClick={onClose}>
      <ScrollArea className="h-full w-full max-w-5xl mx-auto" onClick={(e) => e.stopPropagation()}>
        <div 
          className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-blue-900/20 dark:to-indigo-900/20 rounded-lg shadow-2xl min-h-[90vh] overflow-hidden mx-4 my-8"
          onClick={e => e.stopPropagation()}
          dir="rtl"
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="relative p-4 pb-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-t-lg overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-32 h-32 bg-white/20 rounded-full -translate-x-16 -translate-y-16"></div>
              <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/10 rounded-full translate-x-12 translate-y-12"></div>
              <div className="absolute top-1/2 left-1/3 w-16 h-16 bg-white/15 rounded-full"></div>
            </div>
            
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  onClick={onClose}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/10 rounded-lg p-2 h-auto"
                >
                  <X className="w-4 h-4" />
                </Button>
                
                <div className="relative">
                  <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20">
                    <Brain className="w-6 h-6 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white mb-0.5">إدارة الطلبات الذكية</h2>
                  <p className="text-blue-100 text-xs">نظام ذكي متطور لإدارة طلبات التليغرام والذكاء الاصطناعي</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4">
            {/* Stats Overview */}
            <div className="grid grid-cols-5 gap-3 mb-4" dir="ltr">
              {/* Needs Review Card */}
              <Card
                onClick={() => setStatFilter(statFilter === 'needs_review' ? 'all' : 'needs_review')}
                className={cn(
                  "relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-red-500 to-red-700 text-white min-h-[100px] cursor-pointer",
                  statFilter === 'needs_review' && 'ring-2 ring-white/70'
                )}
              >
                <CardContent className="p-3">
                  <div className="text-center space-y-1">
                    <div className="flex justify-center">
                      <div className="p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs">تحتاج مراجعة</h4>
                      <p className="text-red-100 text-xs">مراجعة عاجلة</p>
                    </div>
                    <div className="pt-1 border-t border-white/20">
                      <p className="text-lg font-bold">{needsReviewCount} طلب</p>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white/5 rounded-full"></div>
                  <div className="absolute top-1 right-3 w-3 h-3 bg-white/10 rounded-full"></div>
                  <div className="absolute top-3 left-1 w-2 h-2 bg-white/15 rounded-full"></div>
                </CardContent>
              </Card>

              {/* AI Chat Orders Card */}
              <Card
                onClick={() => setStatFilter(statFilter === 'ai_chat' ? 'all' : 'ai_chat')}
                className={cn(
                  "relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-purple-500 to-pink-600 text-white min-h-[100px] cursor-pointer",
                  statFilter === 'ai_chat' && 'ring-2 ring-white/70'
                )}
              >
                <CardContent className="p-3">
                  <div className="text-center space-y-1">
                    <div className="flex justify-center">
                      <div className="p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
                        <Brain className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs">الذكاء الاصطناعي</h4>
                      <p className="text-purple-100 text-xs">مساعد ذكي</p>
                    </div>
                    <div className="pt-1 border-t border-white/20">
                      <p className="text-lg font-bold">{aiChatCount} طلب</p>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white/5 rounded-full"></div>
                  <div className="absolute top-2 left-1 w-5 h-5 bg-white/8 rounded-full"></div>
                  <div className="absolute top-1 right-2 w-2 h-2 bg-white/15 rounded-full"></div>
                </CardContent>
              </Card>

              {/* Store Orders Card */}
              <Card
                onClick={() => setStatFilter(statFilter === 'store' ? 'all' : 'store')}
                className={cn(
                  "relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white min-h-[100px] cursor-pointer",
                  statFilter === 'store' && 'ring-2 ring-white/70'
                )}
              >
                <CardContent className="p-3">
                  <div className="text-center space-y-1">
                    <div className="flex justify-center">
                      <div className="p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
                        <ShoppingCart className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs">من المتجر</h4>
                      <p className="text-amber-100 text-xs">طلبات الموقع</p>
                    </div>
                    <div className="pt-1 border-t border-white/20">
                      <p className="text-lg font-bold">{storeCount} طلب</p>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white/5 rounded-full"></div>
                  <div className="absolute top-1 left-3 w-3 h-3 bg-white/12 rounded-full"></div>
                  <div className="absolute top-4 right-1 w-2 h-2 bg-white/20 rounded-full"></div>
                </CardContent>
              </Card>

              {/* Telegram Orders Card */}
              <Card
                onClick={() => setStatFilter(statFilter === 'telegram' ? 'all' : 'telegram')}
                className={cn(
                  "relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white min-h-[100px] cursor-pointer",
                  statFilter === 'telegram' && 'ring-2 ring-white/70'
                )}
              >
                <CardContent className="p-3">
                  <div className="text-center space-y-1">
                    <div className="flex justify-center">
                      <div className="p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
                        <Smartphone className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs">من التليغرام</h4>
                      <p className="text-cyan-100 text-xs">تليغرام بوت</p>
                    </div>
                    <div className="pt-1 border-t border-white/20">
                      <p className="text-lg font-bold">{telegramCount} طلب</p>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white/5 rounded-full"></div>
                  <div className="absolute top-1 left-3 w-3 h-3 bg-white/12 rounded-full"></div>
                  <div className="absolute top-4 right-1 w-2 h-2 bg-white/20 rounded-full"></div>
                </CardContent>
              </Card>

              {/* Total Orders Card */}
              <Card
                onClick={() => setStatFilter('all')}
                className={cn(
                  "relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-teal-700 text-white min-h-[100px] cursor-pointer",
                  statFilter === 'all' && 'ring-2 ring-white/70'
                )}
              >
                <CardContent className="p-3">
                  <div className="text-center space-y-1">
                    <div className="flex justify-center">
                      <div className="p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs">إجمالي الطلبات</h4>
                      <p className="text-emerald-100 text-xs">طلبات واردة</p>
                    </div>
                    <div className="pt-1 border-t border-white/20">
                      <p className="text-lg font-bold">{totalCount} طلب</p>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white/5 rounded-full"></div>
                  <div className="absolute top-2 left-2 w-6 h-6 bg-white/10 rounded-full"></div>
                  <div className="absolute top-1 right-1 w-3 h-3 bg-white/15 rounded-full"></div>
                </CardContent>
              </Card>
            </div>

            {/* Needs Review Alert */}
            {needsReviewCount > 0 && (
              <div className="mb-4 p-3 bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <div>
                    <h4 className="font-bold text-sm text-red-800 dark:text-red-200">
                      لديك {needsReviewCount} طلب يحتاج مراجعة عاجلة!
                    </h4>
                    <p className="text-xs text-red-700 dark:text-red-300">
                      هذه الطلبات تحتاج إلى اهتمام فوري ومراجعة يدوية
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Orders List */}
            <Card className="bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700">
              <CardHeader className="p-3 border-b border-slate-200 dark:border-slate-700">
                <div dir="rtl">
                  <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-blue-600" />
                      قائمة الطلبات الذكية ({filteredOrders.length})
                    </div>
                    
                    {/* زر الموافقة التلقائية - مدمج مع العنوان */}
                    <Button
                      variant={autoApprovalEnabled ? "default" : "outline"}
                      size="sm"
                      onClick={async () => {
                        try {
                          const newValue = !autoApprovalEnabled;
                          const { error } = await supabase
                            .from('profiles')
                            .update({ auto_approval_enabled: newValue })
                            .eq('user_id', user.user_id);
                          
                          if (error) throw error;
                          
                          setAutoApprovalEnabled(newValue);
                          toast({
                            title: newValue ? "تم تفعيل الموافقة التلقائية" : "تم إلغاء الموافقة التلقائية",
                            description: newValue 
                              ? "سيتم الموافقة على الطلبات الصحيحة تلقائياً" 
                              : "ستحتاج الطلبات إلى موافقة يدوية",
                            variant: "success"
                          });
                        } catch (error) {
                          console.error('خطأ في تحديث إعدادات الموافقة التلقائية:', error);
                          toast({
                            title: "خطأ",
                            description: "فشل في تحديث الإعدادات",
                            variant: "destructive"
                          });
                        }
                      }}
                      className={cn(
                        "h-7 px-2 transition-all duration-200 flex items-center gap-1.5 text-xs",
                        autoApprovalEnabled
                          ? "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-md"
                          : "border border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      )}
                    >
                      <Zap className={cn(
                        "w-3 h-3",
                        autoApprovalEnabled ? "text-white" : "text-slate-500"
                      )} />
                      <span className="font-medium">
                        {autoApprovalEnabled ? "مفعل" : "معطل"}
                      </span>
                    </Button>
                  </CardTitle>
                  
                  {(isAdmin || isDepartmentManager) && (
                    <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-500" />
                        <span className="text-xs text-slate-600 dark:text-slate-400">عرض الطلبات:</span>
                      </div>
                      <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                        <SelectTrigger className="h-8 w-full md:w-80">
                          <SelectValue placeholder="جميع الموظفين" />
                        </SelectTrigger>
                        <SelectContent className="z-[2000] bg-white dark:bg-slate-800">
                          <SelectItem value="all">جميع الموظفين</SelectItem>
                          {employeesOnly.map((u) => (
                            <SelectItem key={String(u.user_id || u.id)} value={`user:${String(u.user_id || u.id)}`}>
                              {u.full_name || u.username || u.employee_code || (u.user_id || u.id)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* مكون اختيار وجهة الطلبات - يظهر دائماً */}
                  {filteredOrders.length > 0 && (
                    <div className="mb-4 p-3 bg-white/40 dark:bg-slate-800/40 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                      <AiOrderDestinationSelector 
                        value={orderDestination}
                        onChange={setOrderDestination}
                        className="max-w-md"
                        hideLocal={filteredOrders.some(order => order.source === 'telegram' || order.order_data?.source === 'telegram')}
                      />
                    </div>
                  )}
                  
                  {/* إزالة رسالة التليغرام */}
                  {false && (
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200/50 dark:border-blue-700/50">
                      <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                        <Send className="w-4 h-4" />
                        <span className="text-sm font-medium">طلبات التليغرام توصيل فقط</span>
                      </div>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        جميع الطلبات الواردة من التليغرام سيتم توجيهها تلقائياً لشركة التوصيل المحددة في إعداداتك
                      </p>
                    </div>
                  )}

                  {filteredOrders.length > 0 && (
                    <>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedOrders.length === filteredOrders.length}
                          onCheckedChange={handleSelectAll}
                        />
                        <span className="text-xs text-slate-600 dark:text-slate-400">تحديد الكل</span>
                      </div>
                      {selectedOrders.length > 0 && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleBulkAction('approve')}
                            className="h-7 text-xs bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white"
                          >
                            <CheckCircle2 className="w-3 h-3 ml-1" />
                            موافقة على المحدد ({selectedOrders.length})
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleBulkAction('delete')}
                            className="h-7 text-xs bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
                          >
                            <Trash2 className="w-3 h-3 ml-1" />
                            حذف المحدد ({selectedOrders.length})
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="p-3 space-y-3">
                {filteredOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 mx-auto mb-3 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                      <Bot className="w-6 h-6 text-slate-400" />
                    </div>
                    <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                      لا توجد طلبات ذكية
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-500">
                      سيتم عرض الطلبات الواردة من التليغرام والذكاء الاصطناعي هنا
                    </p>
                  </div>
                ) : (
                  [...filteredOrders].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).map((order) => (
                    <AiOrderCard 
                      key={order.id} 
                      order={order}
                      isSelected={selectedOrders.includes(order.id) || (highlightId && order.id === highlightId)}
                      onSelect={(checked) => handleSelectOrder(order.id, checked)}
                      orderDestination={orderDestination}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default AiOrdersManager;