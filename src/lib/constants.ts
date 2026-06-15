/**
 * Static reference data for Mongol Local.
 * Used by seeds, SEO landing pages, filters, and the map.
 */

export const APP_NAME = "Mongol Local";

/** Ulaanbaatar centre (Sükhbaatar Square). */
export const UB_CENTER = { lat: 47.918, lng: 106.917 } as const;

export type District = {
  slug: string;
  nameMn: string;
  nameEn: string;
  lat: number;
  lng: number;
};

/** The nine düüregs of Ulaanbaatar, plus catch-all for аймаг later. */
export const UB_DISTRICTS: District[] = [
  { slug: "sukhbaatar", nameMn: "Сүхбаатар", nameEn: "Sükhbaatar", lat: 47.926, lng: 106.918 },
  { slug: "chingeltei", nameMn: "Чингэлтэй", nameEn: "Chingeltei", lat: 47.945, lng: 106.905 },
  { slug: "bayanzurkh", nameMn: "Баянзүрх", nameEn: "Bayanzürkh", lat: 47.913, lng: 106.97 },
  { slug: "khan-uul", nameMn: "Хан-Уул", nameEn: "Khan-Uul", lat: 47.88, lng: 106.91 },
  { slug: "bayangol", nameMn: "Баянгол", nameEn: "Bayangol", lat: 47.915, lng: 106.85 },
  { slug: "songinokhairkhan", nameMn: "Сонгинохайрхан", nameEn: "Songinokhairkhan", lat: 47.93, lng: 106.78 },
  { slug: "nalaikh", nameMn: "Налайх", nameEn: "Nalaikh", lat: 47.77, lng: 107.25 },
  { slug: "baganuur", nameMn: "Багануур", nameEn: "Baganuur", lat: 47.83, lng: 108.36 },
  { slug: "bagakhangai", nameMn: "Багахангай", nameEn: "Bagakhangai", lat: 47.39, lng: 107.55 },
];

export const DISTRICT_BY_SLUG = Object.fromEntries(
  UB_DISTRICTS.map((d) => [d.slug, d]),
) as Record<string, District>;

export type CategorySeed = {
  nameMn: string;
  nameEn: string;
  slug: string;
  icon: string; // lucide-react icon name
  children?: CategorySeed[];
};

/**
 * Initial Mongolian category taxonomy (parent → children).
 * Icons reference lucide-react component names.
 */
export const CATEGORY_TAXONOMY: CategorySeed[] = [
  {
    nameMn: "Хоол, ундаа",
    nameEn: "Restaurants & Food",
    slug: "restaurants",
    icon: "UtensilsCrossed",
    children: [
      { nameMn: "Ресторан", nameEn: "Restaurant", slug: "restaurant", icon: "Utensils" },
      { nameMn: "Кафе", nameEn: "Cafe", slug: "cafe", icon: "Coffee" },
      { nameMn: "Кофе шоп", nameEn: "Coffee shop", slug: "coffee-shop", icon: "Coffee" },
      { nameMn: "Түргэн хоол", nameEn: "Fast food", slug: "fast-food", icon: "Beef" },
      { nameMn: "Паб, Лаунж", nameEn: "Pub & Lounge", slug: "pub-lounge", icon: "Beer" },
      { nameMn: "Талх, нарийн боов", nameEn: "Bakery", slug: "bakery", icon: "Croissant" },
      { nameMn: "Хоол хүргэлт", nameEn: "Food delivery", slug: "food-delivery", icon: "Bike" },
    ],
  },
  {
    nameMn: "Эрүүл мэнд, гоо сайхан",
    nameEn: "Health & Beauty",
    slug: "health-beauty",
    icon: "HeartPulse",
    children: [
      { nameMn: "Эмнэлэг", nameEn: "Clinic / Hospital", slug: "clinic", icon: "Stethoscope" },
      { nameMn: "Шүдний эмнэлэг", nameEn: "Dental clinic", slug: "dental", icon: "Smile" },
      { nameMn: "Гоо сайхны салон", nameEn: "Beauty salon", slug: "beauty-salon", icon: "Sparkles" },
      { nameMn: "Үсчин", nameEn: "Barber / Hair", slug: "hair-salon", icon: "Scissors" },
      { nameMn: "Фитнес", nameEn: "Fitness", slug: "fitness", icon: "Dumbbell" },
      { nameMn: "Спа, массаж", nameEn: "Spa & Massage", slug: "spa-massage", icon: "Flower2" },
    ],
  },
  {
    nameMn: "Худалдаа",
    nameEn: "Shopping",
    slug: "shopping",
    icon: "ShoppingBag",
    children: [
      { nameMn: "Дэлгүүр", nameEn: "Store", slug: "store", icon: "Store" },
      { nameMn: "Супермаркет", nameEn: "Supermarket", slug: "supermarket", icon: "ShoppingCart" },
      { nameMn: "Хувцас", nameEn: "Clothing", slug: "clothing", icon: "Shirt" },
      { nameMn: "Цэцгийн дэлгүүр", nameEn: "Florist", slug: "florist", icon: "Flower" },
      { nameMn: "Электрон бараа", nameEn: "Electronics", slug: "electronics", icon: "Smartphone" },
      { nameMn: "Гэр ахуйн бараа", nameEn: "Home goods", slug: "home-goods", icon: "Lamp" },
    ],
  },
  {
    nameMn: "Үйлчилгээ",
    nameEn: "Services",
    slug: "services",
    icon: "Wrench",
    children: [
      { nameMn: "Авто засвар", nameEn: "Auto repair", slug: "auto-repair", icon: "Car" },
      { nameMn: "Угаалга", nameEn: "Car wash / Laundry", slug: "laundry", icon: "WashingMachine" },
      { nameMn: "Хими цэвэрлэгээ", nameEn: "Dry cleaning", slug: "dry-cleaning", icon: "Shirt" },
      { nameMn: "Хууль зүйн үйлчилгээ", nameEn: "Legal services", slug: "legal", icon: "Scale" },
      { nameMn: "Нягтлан бодох", nameEn: "Accounting", slug: "accounting", icon: "Calculator" },
      { nameMn: "IT үйлчилгээ", nameEn: "IT services", slug: "it-services", icon: "Laptop" },
      { nameMn: "Хэвлэл, дизайн", nameEn: "Printing & Design", slug: "printing-design", icon: "Printer" },
    ],
  },
  {
    nameMn: "Боловсрол",
    nameEn: "Education",
    slug: "education",
    icon: "GraduationCap",
    children: [
      { nameMn: "Сургууль", nameEn: "School", slug: "school", icon: "School" },
      { nameMn: "Цэцэрлэг", nameEn: "Kindergarten", slug: "kindergarten", icon: "Baby" },
      { nameMn: "Сургалтын төв", nameEn: "Training center", slug: "training-center", icon: "BookOpen" },
      { nameMn: "Их сургууль", nameEn: "University", slug: "university", icon: "GraduationCap" },
    ],
  },
  {
    nameMn: "Зугаа цэнгэл",
    nameEn: "Entertainment",
    slug: "entertainment",
    icon: "PartyPopper",
    children: [
      { nameMn: "Караоке", nameEn: "Karaoke", slug: "karaoke", icon: "Mic2" },
      { nameMn: "Кино театр", nameEn: "Cinema", slug: "cinema", icon: "Clapperboard" },
      { nameMn: "Event hall", nameEn: "Event hall", slug: "event-hall", icon: "PartyPopper" },
      { nameMn: "Тоглоомын төв", nameEn: "Game center", slug: "game-center", icon: "Gamepad2" },
    ],
  },
  {
    nameMn: "Зочид буудал, аялал",
    nameEn: "Hotels & Travel",
    slug: "hotels-travel",
    icon: "Plane",
    children: [
      { nameMn: "Зочид буудал", nameEn: "Hotel", slug: "hotel", icon: "BedDouble" },
      { nameMn: "Амралтын газар", nameEn: "Resort", slug: "resort", icon: "TreePalm" },
      { nameMn: "Жуулчны бааз", nameEn: "Tourist camp", slug: "tourist-camp", icon: "Tent" },
      { nameMn: "Аяллын компани", nameEn: "Travel agency", slug: "travel-agency", icon: "Plane" },
    ],
  },
];

/** Flat list of leaf category slugs for validation / quick lookups. */
export const LEAF_CATEGORY_SLUGS = CATEGORY_TAXONOMY.flatMap(
  (g) => g.children?.map((c) => c.slug) ?? [],
);

export const PRICE_LEVELS = [
  { value: 1, label: "₮", hint: "Хямд" },
  { value: 2, label: "₮₮", hint: "Дунд" },
  { value: 3, label: "₮₮₮", hint: "Үнэтэй" },
  { value: 4, label: "₮₮₮₮", hint: "Тансаг" },
] as const;

export const DAYS_MN = [
  "Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба",
] as const;

export const SORT_OPTIONS = [
  { value: "recommended", label: "Санал болгосон" },
  { value: "rating", label: "Үнэлгээгээр" },
  { value: "reviews", label: "Сэтгэгдлээр" },
  { value: "nearest", label: "Ойролцоо" },
  { value: "newest", label: "Шинэ нэмэгдсэн" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

/** Analytics event names — keep in sync with ClickHouse + Postgres sinks. */
export const ANALYTICS_EVENTS = [
  "page_view",
  "search_performed",
  "business_viewed",
  "map_pin_clicked",
  "direction_clicked",
  "phone_clicked",
  "website_clicked",
  "review_created",
  "photo_uploaded",
  "business_saved",
  "claim_started",
  "claim_submitted",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export const PAGE_SIZE = 20;
export const MAP_MAX_PINS = 300;
