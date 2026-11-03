import "dotenv/config";
import { runStorageCleanup } from "../src/lib/storage-uploads";
import { prisma } from "../src/lib/prisma";

try { console.log(await runStorageCleanup()); }
finally { await prisma.$disconnect(); }
