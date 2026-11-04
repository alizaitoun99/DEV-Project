import { expect, it } from "vitest";
import { DEFAULT_EDITOR_PREFERENCES, parseEditorPreferences } from "./editor-preferences";

it.each([null, undefined, {}, { fontSize: "huge" }])("uses safe defaults for missing or malformed stored JSON: %j", (value) => {
  expect(parseEditorPreferences(value)).toEqual(DEFAULT_EDITOR_PREFERENCES);
});

it("preserves stored settings including false toggles", () => {
  const settings = { fontSize: 24, tabSize: 8, wordWrap: false, minimap: true, theme: "github-dark" };
  expect(parseEditorPreferences(settings)).toEqual(settings);
});
