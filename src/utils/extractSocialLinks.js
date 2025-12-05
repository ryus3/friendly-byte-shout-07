/**
 * استخراج روابط التواصل من business_links array و social_media object
 * @param {Array} businessLinks - مصفوفة روابط الأعمال من profile.business_links
 * @param {Object} socialMedia - كائن وسائل التواصل من profile.social_media
 * @returns {Object} كائن يحتوي على جميع روابط التواصل
 */
export const extractSocialLinks = (businessLinks = [], socialMedia = {}) => {
  const links = {
    whatsapp: null,
    instagram: null,
    facebook: null,
    telegram: null,
    phone: null
  };

  // أولاً: استخراج من business_links array إذا كانت مصفوفة
  if (Array.isArray(businessLinks)) {
    businessLinks.forEach(link => {
      if (!link || !link.type) return;
      
      const type = link.type.toLowerCase();
      const url = link.url || link.value;
      
      if (type === 'whatsapp' && url) links.whatsapp = url;
      if (type === 'instagram' && url) links.instagram = url;
      if (type === 'facebook' && url) links.facebook = url;
      if (type === 'telegram' && url) links.telegram = url;
      if (type === 'phone' && url) links.phone = url;
    });
  }
  
  // ثانياً: استخراج من business_links كـ object إذا لم تكن مصفوفة
  if (businessLinks && typeof businessLinks === 'object' && !Array.isArray(businessLinks)) {
    if (businessLinks.whatsapp) links.whatsapp = businessLinks.whatsapp;
    if (businessLinks.instagram) links.instagram = businessLinks.instagram;
    if (businessLinks.facebook) links.facebook = businessLinks.facebook;
    if (businessLinks.telegram) links.telegram = businessLinks.telegram;
    if (businessLinks.phone) links.phone = businessLinks.phone;
  }

  // ثالثاً: دمج مع social_media object كـ fallback
  if (socialMedia && typeof socialMedia === 'object') {
    if (!links.whatsapp && socialMedia.whatsapp) links.whatsapp = socialMedia.whatsapp;
    if (!links.instagram && socialMedia.instagram) links.instagram = socialMedia.instagram;
    if (!links.facebook && socialMedia.facebook) links.facebook = socialMedia.facebook;
    if (!links.telegram && socialMedia.telegram) links.telegram = socialMedia.telegram;
    if (!links.phone && socialMedia.phone) links.phone = socialMedia.phone;
  }

  return links;
};

/**
 * تنسيق رابط واتساب
 * @param {string} whatsapp - رقم أو رابط واتساب
 * @returns {string} رابط واتساب منسق
 */
export const formatWhatsAppUrl = (whatsapp) => {
  if (!whatsapp) return null;
  if (whatsapp.includes('wa.me') || whatsapp.includes('whatsapp.com')) {
    return whatsapp;
  }
  const cleanNumber = whatsapp.replace(/[^0-9]/g, '');
  return `https://wa.me/${cleanNumber}`;
};

/**
 * تنسيق رابط انستغرام
 * @param {string} instagram - اسم المستخدم أو رابط انستغرام
 * @returns {string} رابط انستغرام منسق
 */
export const formatInstagramUrl = (instagram) => {
  if (!instagram) return null;
  if (instagram.startsWith('http')) return instagram;
  return `https://instagram.com/${instagram.replace('@', '')}`;
};

/**
 * تنسيق رابط فيسبوك
 * @param {string} facebook - اسم المستخدم أو رابط فيسبوك
 * @returns {string} رابط فيسبوك منسق
 */
export const formatFacebookUrl = (facebook) => {
  if (!facebook) return null;
  if (facebook.startsWith('http')) return facebook;
  return `https://facebook.com/${facebook}`;
};

/**
 * تنسيق رابط تليغرام
 * @param {string} telegram - اسم المستخدم أو رابط تليغرام
 * @returns {string} رابط تليغرام منسق
 */
export const formatTelegramUrl = (telegram) => {
  if (!telegram) return null;
  if (telegram.startsWith('http')) return telegram;
  return `https://t.me/${telegram.replace('@', '')}`;
};
