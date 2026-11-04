import { connection } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseEditorPreferences } from "@/lib/editor-preferences";
import { EditorPreferencesProvider } from "./EditorPreferencesContext";

interface EditorPreferencesLoaderProps { children: React.ReactNode }

export async function EditorPreferencesLoader({ children }: EditorPreferencesLoaderProps) {
  await connection();
  const session = await auth();
  const user = session?.user.id ? await prisma.user.findUnique({
    where: { id: session.user.id }, select: { editorPreferences: true },
  }) : null;
  return <EditorPreferencesProvider key={session?.user.id ?? "guest"} initialPreferences={parseEditorPreferences(user?.editorPreferences)}>{children}</EditorPreferencesProvider>;
}
