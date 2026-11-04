"use client";

import { createContext, useContext, useState } from "react";
import { DEFAULT_EDITOR_PREFERENCES, type EditorPreferences } from "@/lib/editor-preferences";

interface EditorPreferencesContextValue {
  preferences: EditorPreferences;
  setPreferences: (preferences: EditorPreferences) => void;
}

const EditorPreferencesContext = createContext<EditorPreferencesContextValue>({
  preferences: DEFAULT_EDITOR_PREFERENCES, setPreferences: () => {},
});

interface EditorPreferencesProviderProps {
  initialPreferences: EditorPreferences;
  children: React.ReactNode;
}

export function EditorPreferencesProvider({ initialPreferences, children }: EditorPreferencesProviderProps) {
  const [preferences, setPreferences] = useState(initialPreferences);
  return <EditorPreferencesContext.Provider value={{ preferences, setPreferences }}>{children}</EditorPreferencesContext.Provider>;
}

export function useEditorPreferences() {
  return useContext(EditorPreferencesContext);
}
