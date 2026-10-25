import "dotenv/config";

async function main(): Promise<void> {
  const { prisma } = await import("../src/lib/prisma");

  try {
    await prisma.$queryRaw`SELECT 1`;
    await Promise.all([
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
    console.log("Neon connection and all initial model tables verified.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  // Avoid printing driver errors, which can contain connection details.
  console.error(
    "Database check failed. Check DATABASE_URL, connectivity, and applied migrations.",
  );
  process.exitCode = 1;
});
