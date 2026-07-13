/*
  قوائم العناصر لكل تصنيف (٢٠ لكل تصنيف).
  لكل عنصر: name (الاسم العربي المعروض) + queries (مصادر مرتّبة يجرّبها السكربت بالتتابع).
  أنواع الاستعلام:
    { kind: "commonsFile", title: "Flag of X.svg" }  -> ملف محدّد على ويكيميديا كومنز (للأعلام)
    { kind: "wiki", lang: "en"|"ar", title: "..." }    -> صورة المقال الرئيسية من ويكيبيديا
    { kind: "commonsSearch", term: "..." }              -> بحث في كومنز وأخذ أول صورة مناسبة
  يجرّب السكربت الاستعلامات بالترتيب حتى ينجح أحدها.
*/

const wiki = (lang, title) => ({ kind: "wiki", lang, title });
const search = (term) => ({ kind: "commonsSearch", term });
const flag = (title) => ({ kind: "commonsFile", title });
const file = (title) => ({ kind: "commonsFile", title }); // ملف محدّد على كومنز (لصورة موثوقة)

export const CATEGORIES = [
  {
    key: "animal", labelAr: "حيوان", emoji: "🦁", ext: "jpg",
    items: [
      { name: "أسد", queries: [wiki("en", "Lion"), search("Panthera leo")] },
      { name: "نمر", queries: [wiki("en", "Tiger"), search("Panthera tigris")] },
      { name: "فيل", queries: [wiki("en", "Elephant"), search("African bush elephant")] },
      { name: "زرافة", queries: [wiki("en", "Giraffe"), search("Giraffa")] },
      { name: "دب", queries: [wiki("en", "Brown bear"), search("Ursus arctos")] },
      { name: "ثعلب", queries: [wiki("en", "Red fox"), search("Vulpes vulpes")] },
      { name: "بطريق", queries: [wiki("en", "Penguin"), search("Aptenodytes")] },
      { name: "جمل", queries: [wiki("en", "Dromedary"), search("Camelus dromedarius")] },
      { name: "حصان", queries: [wiki("en", "Horse"), search("Equus caballus")] },
      { name: "قرد", queries: [wiki("en", "Chimpanzee"), wiki("en", "Baboon")] },
      { name: "باندا", queries: [wiki("en", "Giant panda"), search("Ailuropoda melanoleuca")] },
      { name: "كنغر", queries: [wiki("en", "Red kangaroo"), search("Macropus rufus")] },
      { name: "حمار وحشي", queries: [wiki("en", "Zebra"), wiki("en", "Grévy's zebra")] },
      { name: "وحيد القرن", queries: [wiki("en", "Indian rhinoceros"), wiki("en", "White rhinoceros"), wiki("en", "Black rhinoceros")] },
      { name: "فرس النهر", queries: [wiki("en", "Hippopotamus"), search("Hippopotamus amphibius")] },
      { name: "ذئب", queries: [wiki("en", "Wolf"), search("Canis lupus")] },
      { name: "أرنب", queries: [wiki("en", "European rabbit"), search("Oryctolagus cuniculus")] },
      { name: "بومة", queries: [wiki("en", "Owl"), search("Bubo bubo")] },
      { name: "نسر", queries: [wiki("en", "Bald eagle"), wiki("en", "Golden eagle")] },
      { name: "دولفين", queries: [wiki("en", "Bottlenose dolphin"), search("Tursiops truncatus")] }
    ]
  },
  {
    key: "fruit", labelAr: "فاكهة", emoji: "🍎", ext: "jpg",
    items: [
      { name: "تفاح", queries: [wiki("en", "Apple"), search("Red apple fruit")] },
      { name: "موز", queries: [file("Cavendish banana from Maracaibo.jpg"), wiki("en", "Banana"), search("Banana fruit")] },
      { name: "فراولة", queries: [wiki("en", "Strawberry"), search("Strawberry fruit")] },
      { name: "بطيخ", queries: [file("Watermelon Bahar1.jpg"), wiki("en", "Watermelon"), search("Watermelon fruit")] },
      { name: "عنب", queries: [wiki("en", "Grape"), search("Grapes fruit")] },
      { name: "مانجو", queries: [wiki("en", "Mango"), search("Mango fruit")] },
      { name: "أناناس", queries: [wiki("en", "Pineapple"), search("Pineapple fruit")] },
      { name: "رمان", queries: [wiki("en", "Pomegranate"), search("Pomegranate fruit")] },
      { name: "برتقال", queries: [wiki("en", "Orange (fruit)"), search("Orange fruit")] },
      { name: "كيوي", queries: [file("Kiwi aka.jpg"), wiki("en", "Kiwifruit"), search("Kiwifruit")] },
      { name: "خوخ", queries: [file("Autumn Red peaches.jpg"), wiki("en", "Peach"), search("Peach fruit")] },
      { name: "كرز", queries: [wiki("en", "Cherry"), search("Cherry fruit")] },
      { name: "أفوكادو", queries: [file("Persea americana fruit 2.JPG"), wiki("en", "Avocado"), search("Avocado fruit")] },
      { name: "تين", queries: [file("Bowl of Figs.jpg"), wiki("en", "Common fig"), search("Fig fruit")] },
      { name: "مشمش", queries: [wiki("en", "Apricot"), search("Apricot fruit")] },
      { name: "ليمون", queries: [file("Lemon - whole and split.jpg"), wiki("en", "Lemon"), search("Lemon fruit")] },
      { name: "جوز الهند", queries: [file("Coconuts - single and cracked open.jpg"), wiki("en", "Coconut"), search("Coconut fruit")] },
      { name: "توت أزرق", queries: [wiki("en", "Blueberry"), search("Blueberries")] },
      { name: "كمثرى", queries: [wiki("en", "Pear"), search("Pear fruit")] },
      { name: "بابايا", queries: [file("Papaya - longitudinal section.jpg"), wiki("en", "Papaya"), search("Papaya fruit")] }
    ]
  },
  {
    key: "flag", labelAr: "علم دولة", emoji: "🏳️", ext: "jpg",
    items: [
      { name: "السعودية", queries: [flag("Flag of Saudi Arabia.svg"), search("Flag of Saudi Arabia")] },
      { name: "مصر", queries: [flag("Flag of Egypt.svg"), search("Flag of Egypt")] },
      { name: "اليابان", queries: [flag("Flag of Japan.svg"), search("Flag of Japan")] },
      { name: "البرازيل", queries: [flag("Flag of Brazil.svg"), search("Flag of Brazil")] },
      { name: "فرنسا", queries: [flag("Flag of France.svg"), search("Flag of France")] },
      { name: "كندا", queries: [flag("Flag of Canada (Pantone).svg"), flag("Flag of Canada.svg"), search("Flag of Canada")] },
      { name: "تركيا", queries: [flag("Flag of Turkey.svg"), search("Flag of Turkey")] },
      { name: "ألمانيا", queries: [flag("Flag of Germany.svg"), search("Flag of Germany")] },
      { name: "إيطاليا", queries: [flag("Flag of Italy.svg"), search("Flag of Italy")] },
      { name: "إسبانيا", queries: [flag("Flag of Spain.svg"), search("Flag of Spain")] },
      { name: "الهند", queries: [flag("Flag of India.svg"), search("Flag of India")] },
      { name: "الصين", queries: [flag("Flag of the People's Republic of China.svg"), search("Flag of China")] },
      { name: "الولايات المتحدة", queries: [flag("Flag of the United States.svg"), search("Flag of the United States")] },
      { name: "المملكة المتحدة", queries: [flag("Flag of the United Kingdom.svg"), search("Flag of the United Kingdom")] },
      { name: "الأرجنتين", queries: [flag("Flag of Argentina.svg"), search("Flag of Argentina")] },
      { name: "أستراليا", queries: [flag("Flag of Australia (converted).svg"), flag("Flag of Australia.svg"), search("Flag of Australia")] },
      { name: "كوريا الجنوبية", queries: [flag("Flag of South Korea.svg"), search("Flag of South Korea")] },
      { name: "المكسيك", queries: [flag("Flag of Mexico.svg"), search("Flag of Mexico")] },
      { name: "جنوب أفريقيا", queries: [flag("Flag of South Africa.svg"), search("Flag of South Africa")] },
      { name: "الإمارات", queries: [flag("Flag of the United Arab Emirates.svg"), search("Flag of the United Arab Emirates")] }
    ]
  },
  {
    key: "saudi-food", labelAr: "أكلة سعودية", emoji: "🍲", ext: "jpg",
    items: [
      { name: "كبسة", queries: [wiki("en", "Kabsa"), wiki("ar", "كبسة"), search("Kabsa")] },
      { name: "مندي", queries: [wiki("en", "Mandi (food)"), wiki("ar", "مندي"), search("Mandi food")] },
      { name: "جريش", queries: [file("Jarish SaudiCuisine.JPG"), wiki("ar", "جريش (طعام)"), search("Jarish dish")] },
      { name: "بلاليط", queries: [file("Homemade Balaleet, 2023.jpg"), wiki("en", "Balaleet"), search("Balaleet")] },
      { name: "مطازيز", queries: [wiki("ar", "مطازيز"), search("Mataziz")] },
      { name: "معصوب", queries: [wiki("ar", "معصوب"), search("Masoub food")] },
      { name: "سليق", queries: [wiki("ar", "سليق (طعام)"), search("Saleeg")] },
      { name: "كليجا", queries: [file("Kleeja 1.JPG"), wiki("ar", "كليجا"), search("Kleicha")] },
      { name: "مفطح", queries: [wiki("ar", "مفطح"), search("Mathbi lamb")] },
      { name: "سمبوسة", queries: [wiki("en", "Samosa"), wiki("ar", "سمبوسة")] },
      { name: "هريس", queries: [wiki("en", "Harees"), wiki("ar", "هريس"), search("Harees")] },
      { name: "لقيمات", queries: [wiki("en", "Luqaimat"), wiki("ar", "لقيمات"), search("Luqaimat")] },
      { name: "معمول", queries: [wiki("en", "Maamoul"), wiki("ar", "معمول"), search("Maamoul")] },
      { name: "تمر", queries: [wiki("ar", "تمر"), search("Medjool dates")] },
      { name: "قهوة عربية", queries: [wiki("en", "Arabic coffee"), wiki("ar", "قهوة عربية"), search("Arabic coffee dallah")] },
      { name: "شكشوكة", queries: [wiki("en", "Shakshouka"), wiki("ar", "شكشوكة"), search("Shakshouka")] },
      { name: "فول", queries: [file("Ful medames (arabic meal).jpg"), wiki("en", "Ful medames"), search("Ful medames")] },
      { name: "مضغوط", queries: [wiki("ar", "مضغوط (طعام)"), search("Madghout food"), search("Madfoon rice")] },
      { name: "حنيني", queries: [file("Hininy Vestival in Unayzah 2020-1.jpg"), wiki("ar", "حنيني")] },
      { name: "مطبق", queries: [wiki("en", "Murtabak"), wiki("ar", "مطبق"), search("Mutabbaq")] }
    ]
  },
  {
    key: "saudi-city", labelAr: "مدينة سعودية", emoji: "🏙️", ext: "jpg",
    items: [
      { name: "الرياض", queries: [wiki("en", "Riyadh"), search("Riyadh skyline")] },
      { name: "جدة", queries: [wiki("en", "Jeddah"), search("Jeddah waterfront")] },
      { name: "مكة المكرمة", queries: [wiki("en", "Mecca"), search("Mecca Great Mosque")] },
      { name: "المدينة المنورة", queries: [wiki("en", "Medina"), search("Al-Masjid an-Nabawi")] },
      { name: "أبها", queries: [wiki("en", "Abha"), search("Abha city")] },
      { name: "الطائف", queries: [wiki("en", "Ta'if"), search("Taif city")] },
      { name: "الدمام", queries: [wiki("en", "Dammam"), search("Dammam city")] },
      { name: "العُلا", queries: [wiki("en", "AlUla"), search("AlUla Hegra")] },
      { name: "تبوك", queries: [wiki("en", "Tabuk, Saudi Arabia"), search("Tabuk Saudi Arabia")] },
      { name: "الخبر", queries: [wiki("en", "Khobar"), search("Khobar corniche")] },
      { name: "بريدة", queries: [wiki("en", "Buraidah"), search("Buraidah city")] },
      { name: "حائل", queries: [wiki("en", "Ha'il"), search("Hail Saudi Arabia")] },
      { name: "نجران", queries: [wiki("en", "Najran"), search("Najran Saudi Arabia")] },
      { name: "جازان", queries: [wiki("en", "Jizan"), search("Jazan city")] },
      { name: "ينبع", queries: [wiki("en", "Yanbu"), search("Yanbu city")] },
      { name: "الأحساء", queries: [wiki("en", "Al-Ahsa"), search("Al-Ahsa oasis")] },
      { name: "القطيف", queries: [wiki("en", "Qatif"), search("Qatif city")] },
      { name: "عرعر", queries: [wiki("en", "Arar, Saudi Arabia"), search("Arar Saudi Arabia")] },
      { name: "سكاكا", queries: [wiki("en", "Sakakah"), search("Sakaka city")] },
      { name: "الباحة", queries: [wiki("en", "Al Bahah"), search("Al Bahah city")] }
    ]
  }
];
