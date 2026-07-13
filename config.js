/* مُولَّد بواسطة tools/upload-from-config.js — الصور من Cloudflare R2. */
window.GAME_CONFIG = {
  R2_PUBLIC_URL: "https://pub-71f12863e04a4cebbbe21aa7f291f0ec.r2.dev/guess_game",
  IMG_VERSION: 5,

  CATEGORIES: [
    {
      key: "animal", labelAr: "حيوان", emoji: "🦁", ext: "jpg",
      images: [
        { n: 1, name: "أسد" },
        { n: 2, name: "نمر" },
        { n: 3, name: "فيل" },
        { n: 4, name: "زرافة" },
        { n: 5, name: "دب" },
        { n: 6, name: "ثعلب" },
        { n: 7, name: "بطريق" },
        { n: 8, name: "جمل" },
        { n: 9, name: "حصان" },
        { n: 10, name: "قرد" },
        { n: 11, name: "باندا" },
        { n: 12, name: "كنغر" },
        { n: 13, name: "حمار وحشي" },
        { n: 14, name: "وحيد القرن" },
        { n: 15, name: "فرس النهر" },
        { n: 16, name: "ذئب" },
        { n: 17, name: "أرنب" },
        { n: 18, name: "بومة" },
        { n: 19, name: "نسر" },
        { n: 20, name: "دولفين" }
      ]
    },
    {
      key: "fruit", labelAr: "فاكهة", emoji: "🍎", ext: "jpg",
      images: [
        { n: 1, name: "تفاح" },
        { n: 2, name: "موز" },
        { n: 3, name: "فراولة" },
        { n: 4, name: "بطيخ" },
        { n: 5, name: "عنب" },
        { n: 6, name: "مانجو" },
        { n: 7, name: "أناناس" },
        { n: 8, name: "رمان" },
        { n: 9, name: "برتقال" },
        { n: 10, name: "كيوي" },
        { n: 11, name: "خوخ" },
        { n: 12, name: "كرز" },
        { n: 13, name: "أفوكادو" },
        { n: 14, name: "تين" },
        { n: 15, name: "مشمش" },
        { n: 16, name: "ليمون" },
        { n: 17, name: "جوز الهند" },
        { n: 18, name: "توت أزرق" },
        { n: 19, name: "كمثرى" },
        { n: 20, name: "بابايا" }
      ]
    },
    {
      key: "flag", labelAr: "علم دولة", emoji: "🏳️", ext: "jpg",
      images: [
        { n: 1, name: "السعودية" },
        { n: 2, name: "مصر" },
        { n: 3, name: "اليابان" },
        { n: 4, name: "البرازيل" },
        { n: 5, name: "فرنسا" },
        { n: 6, name: "كندا" },
        { n: 7, name: "تركيا" },
        { n: 8, name: "ألمانيا" },
        { n: 9, name: "إيطاليا" },
        { n: 10, name: "إسبانيا" },
        { n: 11, name: "الهند" },
        { n: 12, name: "الصين" },
        { n: 13, name: "الولايات المتحدة" },
        { n: 14, name: "المملكة المتحدة" },
        { n: 15, name: "الأرجنتين" },
        { n: 16, name: "أستراليا" },
        { n: 17, name: "كوريا الجنوبية" },
        { n: 18, name: "المكسيك" },
        { n: 19, name: "جنوب أفريقيا" },
        { n: 20, name: "الإمارات" }
      ]
    },
    {
      key: "saudi-food", labelAr: "أكلة سعودية", emoji: "🍲", ext: "jpg",
      images: [
        { n: 1, name: "كبسة" },
        { n: 2, name: "مندي" },
        { n: 3, name: "جريش" },
        { n: 4, name: "بلاليط" },
        { n: 5, name: "مطازيز" },
        { n: 6, name: "معصوب" },
        { n: 7, name: "سليق" },
        { n: 8, name: "كليجا" },
        { n: 9, name: "مفطح" },
        { n: 10, name: "سمبوسة" },
        { n: 11, name: "هريس" },
        { n: 12, name: "لقيمات" },
        { n: 13, name: "معمول" },
        { n: 14, name: "تمر" },
        { n: 15, name: "قهوة عربية" },
        { n: 16, name: "شكشوكة" },
        { n: 17, name: "فول" },
        { n: 18, name: "حنيني" },
        { n: 19, name: "مطبق" }
      ]
    },
    {
      key: "saudi-city", labelAr: "مدينة سعودية", emoji: "🏙️", ext: "jpg",
      images: [
        { n: 1, name: "الرياض" },
        { n: 2, name: "جدة" },
        { n: 3, name: "مكة المكرمة" },
        { n: 4, name: "المدينة المنورة" },
        { n: 5, name: "أبها" },
        { n: 6, name: "الطائف" },
        { n: 7, name: "الدمام" },
        { n: 8, name: "العُلا" },
        { n: 9, name: "تبوك" },
        { n: 10, name: "الخبر" },
        { n: 11, name: "بريدة" },
        { n: 12, name: "حائل" },
        { n: 13, name: "نجران" },
        { n: 14, name: "جازان" },
        { n: 15, name: "ينبع" },
        { n: 16, name: "الأحساء" },
        { n: 17, name: "القطيف" },
        { n: 18, name: "عرعر" },
        { n: 19, name: "سكاكا" },
        { n: 20, name: "الباحة" }
      ]
    }
  ]
};
