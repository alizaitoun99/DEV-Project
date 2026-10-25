import "dotenv/config";

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const { prisma } = await import("../src/lib/prisma");

  try {
    await prisma.$queryRaw`SELECT 1`;
    const counts = await Promise.all([
      prisma.user.count(),
      prisma.account.count(),
      prisma.session.count(),
      prisma.verificationToken.count(),
      prisma.itemType.count(),
      prisma.item.count(),
      prisma.collection.count(),
      prisma.itemCollection.count(),
      prisma.tag.count(),
      prisma.itemTag.count(),
    ]);
    const tables = [
      "User", "Account", "Session", "VerificationToken", "ItemType",
      "Item", "Collection", "ItemCollection", "Tag", "ItemTag",
    ];
    console.log("Database connection successful. All model tables are accessible.");
    console.table(Object.fromEntries(tables.map((table, index) => [table, counts[index]])));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  // Driver errors can contain credentials; keep failure output safe.
  console.error("Database test failed. Check DATABASE_URL, connectivity, and migrations.");
  process.exitCode = 1;
});
