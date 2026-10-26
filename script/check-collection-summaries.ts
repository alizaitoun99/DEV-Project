import "dotenv/config";
import assert from "node:assert/strict";
import { Prisma } from "../src/generated/prisma/client";
import { getRecentCollections } from "../src/lib/db/collections";
import { prisma } from "../src/lib/prisma";

// Read-only integration regression check against independently counted memberships.
// Run: node --conditions=react-server --import tsx script/check-collection-summaries.ts
async function main() {
  const users = await prisma.user.findMany({ select: { id: true } });
  let checkedCollections = 0;
  let membershipRows = 0;
  let aggregateRows = 0;
  const typeOrder = ["snippet", "prompt", "command", "note", "file", "image", "link"];
  const rank = (slug: string) => {
    const index = typeOrder.indexOf(slug);
    return index === -1 ? typeOrder.length : index;
  };

  for (const user of users) {
    const expectedCollections = await prisma.collection.findMany({
      where: { userId: user.id },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      select: {
        id: true, name: true, description: true, isFavorite: true,
        items: {
          where: { item: { userId: user.id } },
          select: { item: { select: { type: { select: { id: true, slug: true, name: true } } } } },
        },
      },
    });
    const expected = expectedCollections.map(({ items, ...collection }) => {
      const counts = new Map<string, { id: string; slug: string; name: string; count: number }>();
      for (const { item: { type } } of items) {
        counts.set(type.id, { ...type, count: (counts.get(type.id)?.count ?? 0) + 1 });
      }
      const types = [...counts.values()].sort((a, b) =>
        b.count - a.count || rank(a.slug) - rank(b.slug) || a.slug.localeCompare(b.slug));
      return { ...collection, itemCount: items.length, types };
    });
    for (const limit of [0, 1, 3, 6, expected.length + 1]) {
      assert.deepEqual(await getRecentCollections(user.id, limit), expected.slice(0, limit));
    }
    checkedCollections += expected.length;
    membershipRows += expected.reduce((total, collection) => total + collection.itemCount, 0);
    aggregateRows += expected.reduce((total, collection) => total + collection.types.length, 0);
  }
  assert.deepEqual(await getRecentCollections("nonexistent-owner-collection-summary-check"), []);
  await checkSyntheticCollections();
  console.log(JSON.stringify({ checkedUsers: users.length, checkedCollections, membershipRows, aggregateRows, syntheticChecks: "passed" }));
}

async function checkSyntheticCollections() {
  const metadata = ["large", "ties", "empty"].map((id) => ({
    id, name: id, description: null, isFavorite: false,
  }));
  const queryRaw = prisma.$queryRaw.bind(prisma);
  const findMany = prisma.collection.findMany;
  const originalQueryRaw = prisma.$queryRaw;
  // CTEs shadow the real tables for this SELECT only; no database writes occur.
  const fixtures = Prisma.sql`
    WITH "Collection"("id", "userId") AS (
      VALUES ('large', 'owner'), ('ties', 'owner'), ('empty', 'owner'), ('foreign', 'other')
    ), "ItemType"("id", "slug", "name") AS (
      VALUES ('snippet', 'snippet', 'Snippet'), ('prompt', 'prompt', 'Prompt'),
        ('zeta', 'zeta', 'Zeta'), ('alpha', 'alpha', 'Alpha')
    ), "Item"("id", "userId", "typeId") AS (
      SELECT n::text, 'owner', 'snippet' FROM generate_series(1, 10000) AS n
      UNION ALL VALUES ('p', 'owner', 'prompt'), ('s', 'owner', 'snippet'),
        ('a', 'owner', 'alpha'), ('z', 'owner', 'zeta'), ('x', 'other', 'prompt')
    ), "ItemCollection"("collectionId", "itemId") AS (
      SELECT 'large', n::text FROM generate_series(1, 10000) AS n
      UNION ALL VALUES ('ties', 'p'), ('ties', 's'), ('ties', 'a'), ('ties', 'z'),
        ('large', 'x'), ('empty', 'x'), ('foreign', 's')
    )
  `;
  Object.assign(prisma.collection, { findMany: async () => metadata });
  let returnedRows = 0;
  Object.assign(prisma, { $queryRaw: async (query: Prisma.Sql) => {
    const rows = await queryRaw<unknown[]>(Prisma.sql`${fixtures} ${query}`);
    returnedRows += rows.length;
    return rows;
  } });
  try {
    const summaries = await getRecentCollections("owner");
    assert.equal(summaries[0].itemCount, 10000);
    assert.equal(summaries[0].types.length, 1);
    assert.equal(summaries[1].itemCount, 4);
    assert.deepEqual(summaries[1].types.map(({ slug }) => slug), ["snippet", "prompt", "alpha", "zeta"]);
    assert.equal(summaries[2].itemCount, 0);
    assert.deepEqual(summaries[2].types, []);
    assert.equal(returnedRows, 5, "10004 owned memberships should produce only five aggregate rows");
    // Deliberately include foreign metadata to independently exercise the SQL owner check.
    assert.ok((await getRecentCollections("other")).every(({ itemCount }) => itemCount === 0));
  } finally {
    Object.assign(prisma.collection, { findMany });
    Object.assign(prisma, { $queryRaw: originalQueryRaw });
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Collection summary verification failed.");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
