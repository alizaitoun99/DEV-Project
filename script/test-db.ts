import "dotenv/config";

import { compare, getRounds } from "bcryptjs";
import { prisma } from "../src/lib/prisma";

class DemoValidationError extends Error {}

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new DemoValidationError(message);
}

const EXPECTED_COLLECTIONS = [
  { name: "React Patterns", types: { snippet: 3 } },
  { name: "AI Workflows", types: { prompt: 3 } },
  { name: "DevOps", types: { snippet: 1, command: 1, link: 2 } },
  { name: "Terminal Commands", types: { command: 4 } },
  { name: "Design Resources", types: { link: 4 } },
];

const EXPECTED_TYPES = [
  { slug: "snippet", icon: "Code", color: "#3b82f6", kind: "TEXT" },
  { slug: "prompt", icon: "Sparkles", color: "#8b5cf6", kind: "TEXT" },
  { slug: "command", icon: "Terminal", color: "#f97316", kind: "TEXT" },
  { slug: "note", icon: "StickyNote", color: "#fde047", kind: "TEXT" },
  { slug: "file", icon: "File", color: "#6b7280", kind: "FILE" },
  { slug: "image", icon: "Image", color: "#ec4899", kind: "FILE" },
  { slug: "link", icon: "Link", color: "#10b981", kind: "URL" },
];

async function checkTables(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
  const counts = await Promise.all([
    prisma.user.count(), prisma.account.count(), prisma.session.count(),
    prisma.verificationToken.count(), prisma.itemType.count(), prisma.item.count(),
    prisma.collection.count(), prisma.itemCollection.count(), prisma.tag.count(),
    prisma.itemTag.count(),
  ]);
  const tables = [
    "User", "Account", "Session", "VerificationToken", "ItemType",
    "Item", "Collection", "ItemCollection", "Tag", "ItemTag",
  ];
  console.log("Database connection successful. All model tables are accessible (database-wide counts).");
  console.table(Object.fromEntries(tables.map((table, index) => [table, counts[index]])));
}

async function checkDemoData(): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: "demo@devistage.io" },
    select: {
      id: true, name: true, email: true, plan: true, emailVerified: true, passwordHash: true,
      collections: {
        where: { id: { startsWith: "demo-" } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, description: true, items: { select: { itemId: true } } },
      },
      items: {
        where: { id: { startsWith: "demo-" } },
        orderBy: { title: "asc" },
        select: {
          id: true, title: true, content: true, url: true, language: true,
          type: { select: { slug: true, isSystem: true, userId: true, kind: true } },
          collections: { select: { collectionId: true } },
        },
      },
    },
  });
  check(user !== null, "Demo user is missing. Run npm run db:seed first.");
  check(user.name === "John Doe" && user.plan === "PRO" && user.emailVerified !== null, "Demo user profile does not match the seed spec.");
  check(user.passwordHash !== null, "Demo user password hash is missing.");
  check(getRounds(user.passwordHash) === 12 && await compare("12345678", user.passwordHash), "Demo password or bcrypt cost does not match the seed spec.");
  console.log("Demo user (password verified; hash omitted):");
  console.table([{ name: user.name, email: user.email, plan: user.plan, emailVerified: user.emailVerified.toISOString() }]);

  const types = await prisma.itemType.findMany({
    where: { isSystem: true, userId: null }, orderBy: { slug: "asc" },
    select: { slug: true, name: true, icon: true, color: true, kind: true },
  });
  console.log("System item types:");
  console.table(types);
  check(types.length === EXPECTED_TYPES.length, "Expected seven system item types.");
  for (const expected of EXPECTED_TYPES) {
    const type = types.find((record) => record.slug === expected.slug);
    check(type !== undefined && type.name === expected.slug && type.icon === expected.icon && type.color === expected.color && type.kind === expected.kind, `System type ${expected.slug} does not match the seed spec.`);
  }
  check(user.collections.length === 5 && user.items.length === 18, "Expected five demo collections and 18 demo items.");
  console.log("Demo collections:");
  console.table(user.collections.map((collection) => ({ name: collection.name, description: collection.description, items: collection.items.length })));
  for (const expected of EXPECTED_COLLECTIONS) {
    const collection = user.collections.find((record) => record.name === expected.name);
    check(collection !== undefined, `Missing demo collection: ${expected.name}.`);
    const items = user.items.filter((item) => collection.items.some((membership) => membership.itemId === item.id));
    check(items.length === collection.items.length && items.length === Object.values(expected.types).reduce((sum, count) => sum + count, 0), `${expected.name} has incorrect or cross-owner memberships.`);
    for (const [slug, count] of Object.entries(expected.types)) {
      check(items.filter((item) => item.type.slug === slug).length === count, `${expected.name} has an incorrect ${slug} count.`);
    }
  }
  console.log("Demo items:");
  console.table(user.items.map((item) => ({
    title: item.title, type: item.type.slug, language: item.language,
    collection: user.collections.filter((collection) => item.collections.some((membership) => membership.collectionId === collection.id)).map((collection) => collection.name).join(", "),
    content: item.url ?? (item.content && item.content.length > 100 ? `${item.content.slice(0, 100).replace(/\s+/g, " ")}…` : item.content),
  })));
  for (const item of user.items) {
    check(item.type.isSystem && item.type.userId === null, "Demo item references a non-system type.");
    check(item.collections.length === 1 && user.collections.some((collection) => collection.id === item.collections[0].collectionId), "Demo item must belong to exactly one owned collection.");
    if (item.type.kind === "URL") {
      check(item.url !== null && /^https?:\/\//.test(item.url) && URL.canParse(item.url), "Demo link has an invalid URL.");
    } else {
      check(item.type.kind === "TEXT" && Boolean(item.content?.trim()), "Demo text item has missing content or an unexpected storage kind.");
    }
  }
  check(user.items.filter((item) => item.type.slug === "snippet" && item.collections.some((membership) => user.collections.find((collection) => collection.id === membership.collectionId)?.name === "React Patterns")).every((item) => item.language === "typescript"), "React snippets must use TypeScript.");
  console.log("Demo verification passed: credentials, seven types, five collections, 18 items, content, and ownership/memberships.");
}

async function main(): Promise<void> {
  try {
    await checkTables();
    await checkDemoData();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  // Driver errors can contain credentials; only display our own validation messages.
  console.error(error instanceof DemoValidationError ? error.message : "Database test failed. Check DATABASE_URL, connectivity, migrations, and demo password hash format.");
  process.exitCode = 1;
});
