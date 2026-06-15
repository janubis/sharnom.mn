/**
 * Idempotent database seed for Mongol Local.
 *
 *   npm run db:seed
 *
 * Inserts the full category taxonomy, demo users, ~36 realistic Ulaanbaatar
 * businesses (with locations, contacts, hours, photos), 2–5 reviews each, then
 * recomputes all denormalised aggregates. Safe to run repeatedly — every step
 * skips rows that already exist (keyed by slug / email / natural keys).
 */
import "./_shared";

import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import * as t from "@/db/schema";
import { CATEGORY_TAXONOMY } from "@/lib/constants";
import { normalizeBusinessName } from "@/lib/normalize";
import { slugify } from "@/lib/utils";

import {
  closeDb,
  loadCategoryIdBySlug,
  pick,
  pointInDistrict,
  randInt,
  recomputeAggregates,
} from "./_shared";

/* ───────────────────────────── 1. Categories ─────────────────────────────── */

async function seedCategories(): Promise<void> {
  console.log("→ Ангилал (category taxonomy) суулгаж байна…");
  let inserted = 0;

  for (let pi = 0; pi < CATEGORY_TAXONOMY.length; pi++) {
    const parent = CATEGORY_TAXONOMY[pi]!;
    const existingParent = await db
      .select({ id: t.categories.id })
      .from(t.categories)
      .where(eq(t.categories.slug, parent.slug))
      .limit(1);

    let parentId: string;
    if (existingParent[0]) {
      parentId = existingParent[0].id;
    } else {
      const [row] = await db
        .insert(t.categories)
        .values({
          parentId: null,
          nameMn: parent.nameMn,
          nameEn: parent.nameEn,
          slug: parent.slug,
          icon: parent.icon,
          sortOrder: pi,
        })
        .returning({ id: t.categories.id });
      parentId = row!.id;
      inserted++;
    }

    const children = parent.children ?? [];
    for (let ci = 0; ci < children.length; ci++) {
      const child = children[ci]!;
      const exists = await db
        .select({ id: t.categories.id })
        .from(t.categories)
        .where(eq(t.categories.slug, child.slug))
        .limit(1);
      if (exists[0]) continue;
      await db.insert(t.categories).values({
        parentId,
        nameMn: child.nameMn,
        nameEn: child.nameEn,
        slug: child.slug,
        icon: child.icon,
        sortOrder: ci,
      });
      inserted++;
    }
  }
  console.log(`  ✓ ${inserted} шинэ ангилал нэмлээ.`);
}

/* ────────────────────────────── 2. Users ─────────────────────────────────── */

type SeededUsers = {
  admin: string;
  owner: string;
  users: string[];
};

const DEMO_USERS = [
  { email: "admin@mongol-local.mn", name: "Админ", role: "SUPER_ADMIN" as const },
  { email: "owner@mongol-local.mn", name: "Бат-Эрдэнэ (эзэн)", role: "OWNER" as const },
  { email: "bolormaa@example.mn", name: "Болормаа", role: "USER" as const },
  { email: "tuvshin@example.mn", name: "Түвшин", role: "USER" as const },
  { email: "naranaa@example.mn", name: "Наранаа", role: "USER" as const },
];

async function seedUsers(): Promise<SeededUsers> {
  console.log("→ Хэрэглэгчид суулгаж байна…");
  const ids: Record<string, string> = {};

  for (const u of DEMO_USERS) {
    const existing = await db
      .select({ id: t.users.id })
      .from(t.users)
      .where(eq(t.users.email, u.email))
      .limit(1);
    if (existing[0]) {
      ids[u.email] = existing[0].id;
      continue;
    }
    const [row] = await db
      .insert(t.users)
      .values({
        email: u.email,
        name: u.name,
        role: u.role,
        emailVerified: new Date(),
      })
      .returning({ id: t.users.id });
    ids[u.email] = row!.id;
  }
  console.log(`  ✓ ${DEMO_USERS.length} хэрэглэгч бэлэн.`);

  return {
    admin: ids["admin@mongol-local.mn"]!,
    owner: ids["owner@mongol-local.mn"]!,
    users: [
      ids["bolormaa@example.mn"]!,
      ids["tuvshin@example.mn"]!,
      ids["naranaa@example.mn"]!,
    ],
  };
}

/* ──────────────────────────── 3. Businesses ──────────────────────────────── */

type BizSeed = {
  name: string;
  categorySlug: string;
  district: string;
  description: string;
  priceLevel: number;
  website?: string;
  facebook?: string;
};

/** 36 realistic UB businesses across districts & leaf categories. */
const BUSINESSES: BizSeed[] = [
  // restaurants
  { name: "Модерн Номадс ресторан", categorySlug: "restaurant", district: "sukhbaatar", description: "Уламжлалт монгол хоолыг орчин үеийн хэлбэрээр. Чанасан мах, бууз, цуйван.", priceLevel: 3, website: "https://modernnomads.mn", facebook: "https://facebook.com/modernnomads" },
  { name: "Хан буузны газар", categorySlug: "restaurant", district: "bayanzurkh", description: "Гэр бүлээрээ зочлох уламжлалт буузны газар. Өглөөнөөс орой хүртэл.", priceLevel: 2 },
  { name: "Сансар грилл", categorySlug: "restaurant", district: "khan-uul", description: "Стейк, шарсан мах, дотоодын болон импортын дарс.", priceLevel: 4, website: "https://sansargrill.mn" },
  { name: "Талын амт", categorySlug: "restaurant", district: "songinokhairkhan", description: "Хөдөөний амттай хонины мах, шөл хоол. Гэрийн нөхцөл.", priceLevel: 2 },
  { name: "Чингис ресторан", categorySlug: "restaurant", district: "chingeltei", description: "Монгол, азийн хоолны өргөн сонголт. Хурим, арга хэмжээний танхимтай.", priceLevel: 3 },
  // cafe
  { name: "Цэнхэр тэнгэр кафе", categorySlug: "cafe", district: "sukhbaatar", description: "Тайван уур амьсгалтай кафе. Гэрийн жигнэмэг, шинэхэн салат.", priceLevel: 2, facebook: "https://facebook.com/tsenkhertenger" },
  { name: "Ногоон навч кафе", categorySlug: "cafe", district: "bayangol", description: "Эрүүл хооллолтын кафе. Веган, цагаан хоолны сонголттой.", priceLevel: 2 },
  { name: "Уулзалт кафе", categorySlug: "cafe", district: "chingeltei", description: "Найзуудтайгаа уулзах, ажиллах тохиромжтой орчин. Wi-Fi үнэгүй.", priceLevel: 2 },
  // coffee-shop
  { name: "Тосгон кофе", categorySlug: "coffee-shop", district: "sukhbaatar", description: "Шинэхэн шарсан кофе, гар хийцийн латте. Тав тухтай уншлагын булан.", priceLevel: 2, website: "https://tosgoncoffee.mn" },
  { name: "Мокко кофе хаус", categorySlug: "coffee-shop", district: "khan-uul", description: "Специалти кофе, дэгжин амралт. Эспрессо, флэт уайт, колд брю.", priceLevel: 3 },
  { name: "Өглөөний кофе", categorySlug: "coffee-shop", district: "bayanzurkh", description: "Ажилдаа явахаасаа өмнө аваад явах хурдан үйлчилгээ.", priceLevel: 1 },
  // fast-food
  { name: "Хурд бургер", categorySlug: "fast-food", district: "bayangol", description: "Шинэхэн махан бургер, шарсан төмс. Хүргэлттэй.", priceLevel: 1, facebook: "https://facebook.com/khurdburger" },
  { name: "Цэнгэг шаурма", categorySlug: "fast-food", district: "songinokhairkhan", description: "Тахиа, үхрийн махтай шаурма, дөнөр. Хямд, хурдан.", priceLevel: 1 },
  { name: "Питса плэйс", categorySlug: "fast-food", district: "bayanzurkh", description: "Гар хийцийн пицца, түргэн хүргэлт. 30 минутын дотор.", priceLevel: 2 },
  // bakery
  { name: "Алтан талх нарийн боов", categorySlug: "bakery", district: "chingeltei", description: "Өдөр бүр шинэхэн жигнэсэн талх, бялуу, нарийн боов.", priceLevel: 2 },
  // clinic
  { name: "Энэрэл эмнэлэг", categorySlug: "clinic", district: "bayanzurkh", description: "Гэр бүлийн эмнэлэг. Дотрын, хүүхдийн, шинжилгээний кабинет.", priceLevel: 3, website: "https://enerel.mn" },
  { name: "Эрүүл амьдрал клиник", categorySlug: "clinic", district: "khan-uul", description: "Орчин үеийн тоног төхөөрөмжтэй хувийн эмнэлэг.", priceLevel: 3 },
  { name: "Найрамдал поликлиник", categorySlug: "clinic", district: "songinokhairkhan", description: "Үндсэн эмчилгээ, урьдчилан сэргийлэх үзлэг.", priceLevel: 2 },
  // dental
  { name: "Цагаан шүд эмнэлэг", categorySlug: "dental", district: "sukhbaatar", description: "Шүдний эмчилгээ, цайруулалт, гажиг засал. Өвдөлтгүй технологи.", priceLevel: 3, website: "https://tsagaanshud.mn" },
  { name: "Дент про", categorySlug: "dental", district: "bayangol", description: "Гоо сайхны болон эмчилгээний шүдний үйлчилгээ.", priceLevel: 3 },
  // beauty-salon
  { name: "Гоо бүсгүй салон", categorySlug: "beauty-salon", district: "sukhbaatar", description: "Үс засал, нүүр будалт, маникюр педикюр. Туршлагатай мастерууд.", priceLevel: 2, facebook: "https://facebook.com/goobusgui" },
  { name: "Лотос гоо сайхан", categorySlug: "beauty-salon", district: "khan-uul", description: "Арьс арчилгаа, спа процедур, гоо сайхны иж бүрэн үйлчилгээ.", priceLevel: 3 },
  // hair-salon
  { name: "Стайл үсчин", categorySlug: "hair-salon", district: "bayanzurkh", description: "Эрэгтэй, эмэгтэй үс засал, будалт. Захиалгаар.", priceLevel: 2 },
  // fitness
  { name: "Пауэр фитнес клуб", categorySlug: "fitness", district: "khan-uul", description: "Орчин үеийн тренажер, бүлгийн хичээл, дасгалжуулагчтай.", priceLevel: 3, website: "https://powerfitness.mn" },
  { name: "Идэр спорт заал", categorySlug: "fitness", district: "songinokhairkhan", description: "Хүндийн өргөлт, кардио бүс, саун. 24 цаг.", priceLevel: 2 },
  // supermarket
  { name: "Номин супермаркет", categorySlug: "supermarket", district: "bayangol", description: "Хүнсний болон ахуйн бараа. Өргөн сонголт, хямд үнэ.", priceLevel: 2 },
  { name: "Сансар их дэлгүүр", categorySlug: "supermarket", district: "bayanzurkh", description: "Иж бүрэн худалдааны төв. Хүнс, хувцас, цахилгаан бараа.", priceLevel: 2, website: "https://sansar.mn" },
  // hotel
  { name: "Чингис хаан зочид буудал", categorySlug: "hotel", district: "sukhbaatar", description: "Тав тухтай өрөө, бизнес төв, ресторан. Хотын төвд.", priceLevel: 4, website: "https://chinggishotel.mn" },
  { name: "Туушин зочид буудал", categorySlug: "hotel", district: "chingeltei", description: "4 одтой буудал. Хурлын танхим, фитнес, спа.", priceLevel: 4 },
  // karaoke
  { name: "Од караоке", categorySlug: "karaoke", district: "bayanzurkh", description: "Орчин үеийн дуу, тусгай өрөөнүүд. Үдшийн зугаа цэнгэл.", priceLevel: 2 },
  { name: "Мелоди караоке клуб", categorySlug: "karaoke", district: "bayangol", description: "VIP өрөө, баялаг дууны сан, ундааны үйлчилгээ.", priceLevel: 3 },
  // university
  { name: "Шинэ зуун дээд сургууль", categorySlug: "university", district: "sukhbaatar", description: "Мэдээллийн технологи, бизнесийн чиглэлийн их сургууль.", priceLevel: 3, website: "https://shinezuun.edu.mn" },
  // auto-repair
  { name: "Авто мастер засвар", categorySlug: "auto-repair", district: "songinokhairkhan", description: "Хөдөлгүүр, явах эд анги, цахилгааны засвар. Баталгаатай.", priceLevel: 2 },
  { name: "Түргэн засвар сервис", categorySlug: "auto-repair", district: "bayanzurkh", description: "Тос солих, дугуй засвар, оношилгоо. Хурдан үйлчилгээ.", priceLevel: 2 },
  // spa-massage
  { name: "Амралт спа төв", categorySlug: "spa-massage", district: "khan-uul", description: "Тайвшруулах массаж, халуун чулууны эмчилгээ, саун.", priceLevel: 3, website: "https://amralt-spa.mn" },
  // store / florist
  { name: "Цэцэг цэцэглэг дэлгүүр", categorySlug: "florist", district: "chingeltei", description: "Шинэхэн цэцэг, баглаа, бэлгийн чимэглэл. Хүргэлттэй.", priceLevel: 2, facebook: "https://facebook.com/tsetsegleg" },
];

const PHOTO_BASE = "https://picsum.photos/seed";

function makePhotos(slug: string): Array<{ url: string; isCover: boolean; sort: number }> {
  const n = randInt(1, 3);
  return Array.from({ length: n }, (_, i) => ({
    url: `${PHOTO_BASE}/${slug}-${i + 1}/800/600`,
    isCover: i === 0,
    sort: i,
  }));
}

/** Mon–Sat 10:00–22:00; Sunday closed or short hours. */
function makeHours(businessId: string): Array<typeof t.businessHours.$inferInsert> {
  const rows: Array<typeof t.businessHours.$inferInsert> = [];
  for (let day = 0; day <= 6; day++) {
    if (day === 0) {
      // Sunday: varies — half closed, half short hours
      const closed = Math.random() < 0.5;
      rows.push({
        businessId,
        dayOfWeek: day,
        isClosed: closed,
        openTime: closed ? null : "11:00",
        closeTime: closed ? null : "18:00",
      });
    } else {
      rows.push({
        businessId,
        dayOfWeek: day,
        isClosed: false,
        openTime: "10:00",
        closeTime: "22:00",
      });
    }
  }
  return rows;
}

async function seedBusinesses(catBySlug: Map<string, string>, owner: string): Promise<void> {
  console.log("→ Бизнесүүд суулгаж байна…");
  let inserted = 0;
  let skipped = 0;

  for (const b of BUSINESSES) {
    const slug = slugify(b.name);
    const existing = await db
      .select({ id: t.businesses.id })
      .from(t.businesses)
      .where(eq(t.businesses.slug, slug))
      .limit(1);
    if (existing[0]) {
      skipped++;
      continue;
    }

    const categoryId = catBySlug.get(b.categorySlug) ?? null;
    const now = new Date();
    const { lat, lng } = pointInDistrict(b.district);

    const [biz] = await db
      .insert(t.businesses)
      .values({
        name: b.name,
        normalizedName: normalizeBusinessName(b.name),
        slug,
        description: b.description,
        primaryCategoryId: categoryId,
        priceLevel: b.priceLevel,
        status: "ACTIVE",
        verificationStatus: "UNVERIFIED",
        // First restaurant is owned + verified by the demo owner for owner-flow demos.
        ownerUserId: b.categorySlug === "restaurant" && inserted === 0 ? owner : null,
        source: "seed",
        confidenceScore: 1,
        manuallyVerified: false,
        publishedAt: now,
      })
      .returning({ id: t.businesses.id });
    const businessId = biz!.id;

    await db.insert(t.businessLocations).values({
      businessId,
      addressText: `Улаанбаатар хот, ${b.district} дүүрэг, ${randInt(1, 20)}-р хороо`,
      district: b.district,
      khoroo: String(randInt(1, 20)),
      latitude: lat,
      longitude: lng,
      // geog is GENERATED — never set it.
    });

    await db.insert(t.businessContacts).values({
      businessId,
      phone: String(randInt(70000000, 99999999)),
      website: b.website ?? null,
      facebookUrl: b.facebook ?? null,
    });

    await db.insert(t.businessHours).values(makeHours(businessId));

    const photos = makePhotos(slug);
    await db.insert(t.businessPhotos).values(
      photos.map((p) => ({
        businessId,
        uploadedByUserId: owner,
        imageUrl: p.url,
        status: "APPROVED" as const,
        isCover: p.isCover,
        sortOrder: p.sort,
        width: 800,
        height: 600,
      })),
    );

    inserted++;
  }
  console.log(`  ✓ ${inserted} бизнес нэмлээ${skipped ? `, ${skipped} аль хэдийн байсан` : ""}.`);
}

/* ────────────────────────────── 4. Reviews ───────────────────────────────── */

const REVIEW_BODIES: Array<{ rating: number; title: string; body: string }> = [
  { rating: 5, title: "Гайхалтай!", body: "Үйлчилгээ маш сайхан, ажилтнууд эелдэг. Заавал дахин ирнэ. Бүх найзууддаа санал болгож байна." },
  { rating: 5, title: "Маш сэтгэл хангалуун", body: "Чанар үнэдээ тохирсон. Орчин цэвэрхэн, тав тухтай. Хүлээлгүй үйлчилгээ авлаа." },
  { rating: 4, title: "Сайхан газар", body: "Ерөнхийдөө сайн. Зарим зүйл сайжруулах хэрэгтэй ч дахин ирэхэд таатай." },
  { rating: 4, title: "Дажгүй шүү", body: "Үнэ боломжийн, амт чанар сайн. Зогсоол бага зэрэг хүндрэлтэй байсан." },
  { rating: 3, title: "Дунд зэрэг", body: "Муугүй ч онцлох зүйл алга. Үйлчилгээ удаан байсан тул багасгалаа." },
  { rating: 5, title: "Шилдэг сонголт", body: "Энэ дүүрэгт хамгийн шилдэг нь. Гэр бүлээрээ ирэхэд тохиромжтой." },
  { rating: 4, title: "Дахин ирнэ", body: "Найзтайгаа уулзахад тохиромжтой орчин. Кофе нь онцгой амттай." },
  { rating: 5, title: "Маш цэвэрхэн", body: "Ариун цэвэр, эмх цэгцтэй. Ажилтнууд мэргэжлийн түвшинд." },
];

async function seedReviews(users: string[]): Promise<void> {
  console.log("→ Сэтгэгдлүүд суулгаж байна…");
  const allBiz = await db
    .select({ id: t.businesses.id })
    .from(t.businesses)
    .where(eq(t.businesses.status, "ACTIVE"));

  let inserted = 0;
  let photos = 0;

  for (const biz of allBiz) {
    // 2..5 reviews, but never more than we have demo users (one review per user/business).
    const count = Math.min(users.length, randInt(2, Math.min(5, users.length + 2)));
    const chosenUsers = [...users].sort(() => Math.random() - 0.5).slice(0, count);

    for (const userId of chosenUsers) {
      const existing = await db
        .select({ id: t.reviews.id })
        .from(t.reviews)
        .where(and(eq(t.reviews.businessId, biz.id), eq(t.reviews.userId, userId)))
        .limit(1);
      if (existing[0]) continue;

      const tmpl = pick(REVIEW_BODIES);
      const visit = new Date();
      visit.setDate(visit.getDate() - randInt(3, 180));

      const [rev] = await db
        .insert(t.reviews)
        .values({
          businessId: biz.id,
          userId,
          rating: tmpl.rating,
          title: tmpl.title,
          body: tmpl.body,
          status: "PUBLISHED",
          visitDate: visit,
          usefulCount: randInt(0, 12),
          funnyCount: randInt(0, 4),
          coolCount: randInt(0, 6),
        })
        .returning({ id: t.reviews.id });

      // ~30% of reviews include a photo
      if (Math.random() < 0.3) {
        await db.insert(t.reviewPhotos).values({
          reviewId: rev!.id,
          businessId: biz.id,
          userId,
          imageUrl: `${PHOTO_BASE}/review-${rev!.id.slice(0, 8)}/800/600`,
          status: "APPROVED",
          width: 800,
          height: 600,
        });
        photos++;
      }
      inserted++;
    }
  }
  console.log(`  ✓ ${inserted} сэтгэгдэл, ${photos} зурагтай.`);
}

/* ─────────────────────── 5. Update user counters ─────────────────────────── */

async function refreshUserCounters(): Promise<void> {
  await db.execute(sql`
    UPDATE users u SET review_count = COALESCE(r.cnt, 0)
    FROM (
      SELECT user_id, COUNT(*)::int AS cnt FROM reviews
      WHERE status = 'PUBLISHED' GROUP BY user_id
    ) r WHERE u.id = r.user_id
  `);
  await db.execute(sql`
    UPDATE users u SET photo_count = COALESCE(p.cnt, 0)
    FROM (
      SELECT user_id, COUNT(*)::int AS cnt FROM review_photos
      WHERE status = 'APPROVED' GROUP BY user_id
    ) p WHERE u.id = p.user_id
  `);
}

/* ──────────────────────────────── main ───────────────────────────────────── */

async function main(): Promise<void> {
  console.log("🌱 Mongol Local seed эхэллээ\n");

  await seedCategories();
  const users = await seedUsers();
  const catBySlug = await loadCategoryIdBySlug();
  await seedBusinesses(catBySlug, users.owner);
  await seedReviews(users.users);

  console.log("→ Нэгтгэсэн үзүүлэлтүүдийг дахин тооцоолж байна…");
  await recomputeAggregates();
  await refreshUserCounters();
  console.log("  ✓ rating_avg / review_count / photo_count / completeness / business_count шинэчлэгдлээ.");

  // Mark the owned business as VERIFIED for a richer owner demo.
  await db
    .update(t.businesses)
    .set({ verificationStatus: "VERIFIED", manuallyVerified: true })
    .where(inArray(t.businesses.ownerUserId, [users.owner]));

  console.log("\n✅ Seed амжилттай дууслаа.");
}

main()
  .catch((err) => {
    console.error("\n❌ Seed алдаа:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
    process.exit(process.exitCode ?? 0);
  });
