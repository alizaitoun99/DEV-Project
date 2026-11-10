import "dotenv/config";

import { hash } from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { assertNoBillingForBulkDeletion, BillingDeletionError } from "../src/lib/billing/account-deletion";
import { enqueueAccountStorage } from "../src/lib/db/items";
import { Prisma, type ContentKind } from "../src/generated/prisma/client";

const DEMO_EMAIL = "demo@devistage.io";

const SYSTEM_TYPES = [
  { slug: "snippet", icon: "Code", color: "#3b82f6", kind: "TEXT" },
  { slug: "prompt", icon: "Sparkles", color: "#8b5cf6", kind: "TEXT" },
  { slug: "command", icon: "Terminal", color: "#f97316", kind: "TEXT" },
  { slug: "note", icon: "StickyNote", color: "#fde047", kind: "TEXT" },
  { slug: "file", icon: "File", color: "#6b7280", kind: "FILE" },
  { slug: "image", icon: "Image", color: "#ec4899", kind: "FILE" },
  { slug: "link", icon: "Link", color: "#10b981", kind: "URL" },
] satisfies { slug: string; icon: string; color: string; kind: ContentKind }[];

interface SeedItem {
  key: string;
  title: string;
  type: string;
  content?: string;
  url?: string;
  language?: string;
}

interface SeedCollection {
  key: string;
  name: string;
  description: string;
  items: SeedItem[];
}

const COLLECTIONS: SeedCollection[] = [
  {
    key: "react-patterns", name: "React Patterns",
    description: "Reusable React patterns and hooks",
    items: [
      { key: "use-debounce", title: "useDebounce hook", type: "snippet", language: "typescript", content: `import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}` },
      { key: "context-provider", title: "Typed Context provider", type: "snippet", language: "typescript", content: `import { createContext, createElement, useContext, type ReactNode } from "react";

interface Settings { theme: "dark" | "light"; }
const SettingsContext = createContext<Settings | null>(null);
export function SettingsProvider({ children, value }: { children: ReactNode; value: Settings }) {
  return createElement(SettingsContext.Provider, { value }, children);
}
export function useSettings(): Settings {
  const settings = useContext(SettingsContext);
  if (!settings) throw new Error("SettingsProvider is required");
  return settings;
}` },
      { key: "group-by", title: "Group items by key", type: "snippet", language: "typescript", content: `export function groupBy<T, K extends PropertyKey>(items: T[], getKey: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = getKey(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}` },
    ],
  },
  {
    key: "ai-workflows", name: "AI Workflows",
    description: "AI prompts and workflow automations",
    items: [
      { key: "code-review", title: "Code review prompt", type: "prompt", content: "Review the following diff for correctness, security, and performance. For each actionable issue, cite the file and line, explain a concrete failure scenario, and suggest a focused fix. Separate confirmed defects from questions. Code: {{diff}}" },
      { key: "documentation", title: "Generate API documentation", type: "prompt", content: "Document the following API using its implementation as the source of truth. Include parameters, return values, errors, and a minimal usage example. Flag unknown behavior instead of inventing it. Source: {{code}}" },
      { key: "refactoring", title: "Refactoring assistance", type: "prompt", content: "Propose a small refactor of the following code that preserves observable behavior. Explain the duplication or complexity it removes, show the revised code, and identify the checks needed to verify compatibility. Avoid unrelated changes. Code: {{code}}" },
    ],
  },
  {
    key: "devops", name: "DevOps",
    description: "Infrastructure and deployment resources",
    items: [
      { key: "ci-config", title: "Node.js CI workflow", type: "snippet", language: "yaml", content: `name: CI
on: [push, pull_request]
permissions:
  contents: read
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm run build` },
      { key: "deploy", title: "Deploy Docker Compose services", type: "command", content: "docker compose pull && docker compose up -d --remove-orphans && docker compose ps" },
      { key: "docker-docs", title: "Docker documentation", type: "link", url: "https://docs.docker.com/" },
      { key: "actions-docs", title: "GitHub Actions documentation", type: "link", url: "https://docs.github.com/en/actions" },
    ],
  },
];

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo seeding is for development only.");
  }

  const passwordHash = await hash("12345678", 12);
  const counts = await prisma.$transaction(async (tx) => {
    const existingDemo = await tx.user.findUnique({ where: { email: DEMO_EMAIL }, select: { id: true } });
    if (existingDemo) {
      await assertNoBillingForBulkDeletion(tx, existingDemo.id);
      if (process.argv.includes("--reset-demo")) {
        const owner = { userId: existingDemo.id };
        await enqueueAccountStorage(tx, existingDemo.id);
        await tx.item.deleteMany({ where: owner });
        await tx.collection.deleteMany({ where: owner });
      }
    }
    const user = await tx.user.upsert({
      where: { email: DEMO_EMAIL },
      create: { name: "John Doe", email: DEMO_EMAIL, passwordHash, plan: "FREE", emailVerified: new Date() },
      update: { name: "John Doe", passwordHash, plan: "FREE", emailVerified: new Date() },
    });
    const typeIds = new Map<string, string>();
    for (const type of SYSTEM_TYPES) {
      const existing = await tx.itemType.findFirst({ where: { slug: type.slug, isSystem: true, userId: null } });
      const data = { ...type, name: type.slug, isSystem: true, userId: null };
      const record = existing
        ? await tx.itemType.update({ where: { id: existing.id }, data })
        : await tx.itemType.create({ data });
      typeIds.set(type.slug, record.id);
    }
    for (const collection of COLLECTIONS) {
      const existing = await tx.collection.findFirst({
        where: { userId: user.id, name: collection.name },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      if (existing && existing.userId !== user.id) throw new Error("Demo collection ownership conflict.");
      const data = { name: collection.name, description: collection.description, userId: user.id };
      const record = existing
        ? await tx.collection.update({ where: { id: existing.id }, data })
        : await tx.collection.create({ data });
      const id = record.id;
      for (const item of collection.items) {
        const itemId = `demo-${user.id}-${collection.key}-${item.key}`;
        const existingItem = await tx.item.findUnique({ where: { id: itemId } });
        if (existingItem && existingItem.userId !== user.id) throw new Error("Demo item ownership conflict.");
        const typeId = typeIds.get(item.type);
        if (!typeId) throw new Error(`Missing system type: ${item.type}`);
        const fields = { title: item.title, userId: user.id, typeId, content: item.content ?? null, url: item.url ?? null, language: item.language ?? null };
        await tx.item.upsert({ where: { id: itemId }, create: { id: itemId, ...fields }, update: fields });
        await tx.itemCollection.upsert({
          where: { itemId_collectionId: { itemId, collectionId: id } },
          create: { itemId, collectionId: id }, update: {},
        });
      }
    }
    return {
      systemTypes: typeIds.size,
      collections: await tx.collection.count({ where: { userId: user.id } }),
      items: await tx.item.count({ where: { userId: user.id } }),
    };
  }, { timeout: 60000 });
  console.log("Demo seed complete:", counts);
}

main()
  .catch((error: unknown) => {
    const detail = error instanceof BillingDeletionError ? error.message
      : error instanceof Prisma.PrismaClientKnownRequestError ? `Prisma error ${error.code}.`
      : "Check database configuration and seed ownership conflicts.";
    console.error("Demo seed failed; transaction rolled back.", detail);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
