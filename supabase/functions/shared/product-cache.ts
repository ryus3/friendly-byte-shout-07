import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

interface ProductCache {
  id: string;
  name: string;
  normalized_name: string;
  base_price: number;
  colors: Array<{ id: string; name: string }>;
  sizes: Array<{ id: string; name: string }>;
}

let cache: ProductCache[] = [];
let lastUpdate = 0;
const TTL = 7 * 24 * 60 * 60 * 1000; // أسبوع واحد

/**
 * جلب كاش المنتجات مع تحديث ذكي
 * @param forceRefresh - فرض التحديث الفوري حتى لو كان الكاش صالحاً
 */
export async function getProductsCache(forceRefresh = false): Promise<ProductCache[]> {
  const now = Date.now();
  
  // التحقق من الحاجة للتحديث
  const needsUpdate = forceRefresh || now - lastUpdate > TTL || cache.length === 0;
  
  if (needsUpdate) {
    console.log('🔄 تحديث كاش المنتجات...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    const { data: products, error } = await supabase
      .from('products')
      .select(`
        id, name, base_price,
        product_variants (
          id,
          colors ( id, name ),
          sizes ( id, name )
        )
      `)
      .eq('is_active', true);
    
    if (error) {
      console.error('❌ خطأ في جلب المنتجات:', error);
      throw error;
    }
    
    if (products) {
      // تحويل البيانات لصيغة الكاش
      cache = products.map(p => {
        // استخراج الألوان والقياسات الفريدة من المتغيرات
        const uniqueColors = new Map();
        const uniqueSizes = new Map();
        
        if (p.product_variants && Array.isArray(p.product_variants)) {
          p.product_variants.forEach((v: any) => {
            if (v.colors) uniqueColors.set(v.colors.id, v.colors);
            if (v.sizes) uniqueSizes.set(v.sizes.id, v.sizes);
          });
        }
        
        return {
          id: p.id,
          name: p.name,
          normalized_name: p.name.toLowerCase().trim(),
          base_price: p.base_price,
          colors: Array.from(uniqueColors.values()),
          sizes: Array.from(uniqueSizes.values())
        };
      });
      
      lastUpdate = now;
      console.log(`✅ تم تحديث الكاش: ${cache.length} منتج (التحديث التالي بعد 7 أيام)`);
    }
  } else {
    const remainingTime = Math.ceil((TTL - (now - lastUpdate)) / (1000 * 60 * 60 * 24));
    console.log(`📋 استخدام الكاش الحالي: ${cache.length} منتج (صالح لـ ${remainingTime} يوم)`);
  }
  
  return cache;
}

/**
 * البحث الذكي عن منتج باستخدام Bigram/Trigram matching
 * @param text - النص المراد البحث عنه
 * @param products - قائمة المنتجات في الكاش
 * @returns المنتج المطابق أو null
 */
export function findBestProductMatch(text: string, products: ProductCache[]): ProductCache | null {
  const normalizedText = text.toLowerCase().trim();
  const words = normalizedText.split(/\s+/);
  
  console.log(`🔍 البحث عن: "${text}" (${words.length} كلمة)`);
  
  // محاولة 1: تطابق تام (Exact Match)
  for (const product of products) {
    if (product.normalized_name === normalizedText) {
      console.log(`✅ تطابق تام: ${product.name}`);
      return product;
    }
  }
  
  // محاولة 2: Trigram (3 كلمات)
  if (words.length >= 3) {
    for (let i = 0; i < words.length - 2; i++) {
      const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      for (const product of products) {
        if (product.normalized_name.includes(trigram)) {
          console.log(`✅ تطابق ثلاثي (trigram): ${product.name} ← "${trigram}"`);
          return product;
        }
      }
    }
  }
  
  // محاولة 3: Bigram (كلمتين)
  if (words.length >= 2) {
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      for (const product of products) {
        if (product.normalized_name.includes(bigram)) {
          console.log(`✅ تطابق ثنائي (bigram): ${product.name} ← "${bigram}"`);
          return product;
        }
      }
    }
  }
  
  // محاولة 4: كلمة واحدة (Unigram)
  for (const word of words) {
    if (word.length < 3) continue; // تجاهل الكلمات القصيرة جداً
    for (const product of products) {
      if (product.normalized_name.includes(word)) {
        console.log(`✅ تطابق أحادي (unigram): ${product.name} ← "${word}"`);
        return product;
      }
    }
  }
  
  console.log(`❌ لم يتم العثور على تطابق لـ: "${text}"`);
  return null;
}

/**
 * إلغاء الكاش بالكامل (للاستخدام عند التحديث الفوري)
 */
export function invalidateCache(): void {
  cache = [];
  lastUpdate = 0;
  console.log('🗑️ تم مسح الكاش بالكامل');
}
