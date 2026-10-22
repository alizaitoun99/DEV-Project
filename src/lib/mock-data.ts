// Static dashboard fixtures. Dates are ISO strings; icons are Lucide icon names.
export interface User {
  id: string;
  name: string;
  email: string;
  image: string | null;
  plan: "FREE" | "PRO";
}

export interface ItemType {
  id: string;
  slug: string;
  name: string;
  icon: string;
  color: string;
  kind: "TEXT" | "URL" | "FILE";
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  isFavorite: boolean;
}

export interface Item {
  id: string;
  typeId: string;
  title: string;
  description: string;
  content?: string;
  url?: string;
  language?: string;
  fileName?: string;
  fileSize?: number;
  fileMimeType?: string;
  collectionIds: string[];
  tags: string[];
  isFavorite: boolean;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
}

// All items and collections below belong to this mock signed-in user.
export const CURRENT_USER: User = {
  id: "user-john",
  name: "John Doe",
  email: "john@example.com",
  image: null,
  plan: "PRO",
};

export const ITEM_TYPES: ItemType[] = [
  { id: "snippet", slug: "snippet", name: "Snippets", icon: "code", color: "#3b82f6", kind: "TEXT" },
  { id: "prompt", slug: "prompt", name: "Prompts", icon: "sparkles", color: "#8b5cf6", kind: "TEXT" },
  { id: "command", slug: "command", name: "Commands", icon: "terminal", color: "#f97316", kind: "TEXT" },
  { id: "note", slug: "note", name: "Notes", icon: "sticky-note", color: "#fde047", kind: "TEXT" },
  { id: "file", slug: "file", name: "Files", icon: "file", color: "#6b7280", kind: "FILE" },
  { id: "image", slug: "image", name: "Images", icon: "image", color: "#ec4899", kind: "FILE" },
  { id: "link", slug: "link", name: "Links", icon: "link", color: "#10b981", kind: "URL" },
];

export const COLLECTIONS: Collection[] = [
  { id: "react-patterns", name: "React Patterns", description: "Common React patterns and hooks", isFavorite: true },
  { id: "python-snippets", name: "Python Snippets", description: "Useful Python code snippets", isFavorite: false },
  { id: "context-files", name: "Context Files", description: "AI context files for projects", isFavorite: true },
  { id: "interview-prep", name: "Interview Prep", description: "Technical interview preparation", isFavorite: false },
  { id: "git-commands", name: "Git Commands", description: "Frequently used git commands", isFavorite: true },
  { id: "ai-prompts", name: "AI Prompts", description: "Curated AI prompts for coding", isFavorite: false },
];

// File/image entries contain display metadata only; no upload or download backend exists yet.
export const ITEMS: Item[] = [
  {
    id: "use-auth-hook",
    typeId: "snippet",
    title: "useAuth Hook",
    description: "Custom authentication hook for React applications",
    content: "export function useAuth() {\n  return useContext(AuthContext);\n}",
    language: "typescript",
    collectionIds: ["react-patterns"],
    tags: ["react", "auth", "hooks"],
    isFavorite: true,
    isPinned: true,
    createdAt: "2026-01-10T09:00:00Z",
    updatedAt: "2026-01-15T09:00:00Z",
    lastOpenedAt: "2026-01-15T10:00:00Z",
  },
  {
    id: "api-error-handling",
    typeId: "snippet",
    title: "API Error Handling Pattern",
    description: "Fetch wrapper with exponential backoff retry logic",
    content: "async function fetchWithRetry(url: string, retries = 3): Promise<Response> {\n  for (let attempt = 0; ; attempt++) {\n    try {\n      const response = await fetch(url);\n      if (!response.ok) throw new Error(`HTTP ${response.status}`);\n      return response;\n    } catch (error) {\n      if (attempt >= retries) throw error;\n      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));\n    }\n  }\n}",
    language: "typescript",
    collectionIds: ["react-patterns", "interview-prep"],
    tags: ["api", "fetch", "error-handling"],
    isFavorite: false,
    isPinned: true,
    createdAt: "2026-01-11T09:00:00Z",
    updatedAt: "2026-01-12T09:00:00Z",
    lastOpenedAt: "2026-01-14T11:00:00Z",
  },
  {
    id: "python-flatten-list",
    typeId: "snippet",
    title: "Flatten a Nested List",
    description: "Flatten one level of nested lists with a comprehension",
    content: "flat = [item for group in groups for item in group]",
    language: "python",
    collectionIds: ["python-snippets", "interview-prep"],
    tags: ["python", "lists"],
    isFavorite: false,
    isPinned: false,
    createdAt: "2026-01-08T09:00:00Z",
    updatedAt: "2026-01-08T09:00:00Z",
    lastOpenedAt: "2026-01-13T14:00:00Z",
  },
  {
    id: "code-review-prompt",
    typeId: "prompt",
    title: "Code Review Assistant",
    description: "Review code for correctness, readability, and edge cases",
    content: "Review the following code. Identify bugs, explain edge cases, and suggest focused improvements.\n\n[Paste code here]",
    collectionIds: ["ai-prompts", "interview-prep"],
    tags: ["ai", "code-review"],
    isFavorite: true,
    isPinned: false,
    createdAt: "2026-01-09T09:00:00Z",
    updatedAt: "2026-01-14T09:00:00Z",
    lastOpenedAt: "2026-01-15T08:00:00Z",
  },
  {
    id: "git-log",
    typeId: "command",
    title: "Visual Git History",
    description: "Show a compact graph of all branches",
    content: "git log --oneline --graph --decorate --all",
    language: "bash",
    collectionIds: ["git-commands"],
    tags: ["git", "history"],
    isFavorite: true,
    isPinned: false,
    createdAt: "2026-01-07T09:00:00Z",
    updatedAt: "2026-01-13T09:00:00Z",
    lastOpenedAt: "2026-01-14T16:00:00Z",
  },
  {
    id: "interview-checklist",
    typeId: "note",
    title: "Technical Interview Checklist",
    description: "A quick checklist for approaching coding problems",
    content: "## Before coding\n- Clarify inputs and constraints.\n- Walk through an example.\n- Explain the approach.\n\n## After coding\n- Check edge cases.\n- Discuss time and space complexity.",
    collectionIds: ["interview-prep"],
    tags: ["interview", "checklist"],
    isFavorite: false,
    isPinned: false,
    createdAt: "2026-01-06T09:00:00Z",
    updatedAt: "2026-01-12T10:00:00Z",
    lastOpenedAt: "2026-01-13T09:00:00Z",
  },
  {
    id: "project-context-file",
    typeId: "file",
    title: "Project Context",
    description: "Architecture and conventions for AI coding sessions",
    fileName: "project-context.md",
    fileSize: 4096,
    fileMimeType: "text/markdown",
    collectionIds: ["context-files"],
    tags: ["context", "architecture"],
    isFavorite: false,
    isPinned: false,
    createdAt: "2026-01-05T09:00:00Z",
    updatedAt: "2026-01-11T09:00:00Z",
    lastOpenedAt: null,
  },
  {
    id: "dashboard-wireframe",
    typeId: "image",
    title: "Dashboard Wireframe",
    description: "Layout reference for the developer knowledge hub",
    fileName: "dashboard-wireframe.png",
    fileSize: 184320,
    fileMimeType: "image/png",
    collectionIds: [],
    tags: ["design", "dashboard"],
    isFavorite: false,
    isPinned: false,
    createdAt: "2026-01-04T09:00:00Z",
    updatedAt: "2026-01-10T09:00:00Z",
    lastOpenedAt: null,
  },
  {
    id: "react-docs",
    typeId: "link",
    title: "React Documentation",
    description: "Official guides and API reference for React",
    url: "https://react.dev",
    content: "Reference for hooks and component patterns.",
    collectionIds: ["react-patterns"],
    tags: ["react", "documentation"],
    isFavorite: true,
    isPinned: false,
    createdAt: "2026-01-03T09:00:00Z",
    updatedAt: "2026-01-09T09:00:00Z",
    lastOpenedAt: "2026-01-14T08:00:00Z",
  },
];
