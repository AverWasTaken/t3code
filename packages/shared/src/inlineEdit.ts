export const INLINE_EDIT_AWAITING_REVIEW_TITLE = "Changes staged for review";

export function workEntryExpanded(
  override: boolean | undefined,
  itemType: string | undefined,
): boolean {
  return override ?? itemType === "file_change";
}

export function inlineEditPreview(patch: string, truncated = false) {
  const lines = patch.slice(0, 32_768).split("\n");
  const limited = truncated || lines.length > 500 || patch.length > 32_768;
  const text = lines.slice(0, 500).join("\n").slice(0, 32_768);
  return {
    text,
    lines: text.split("\n"),
    limited,
    isPatch: /^@@ /m.test(text) || (limited && /^diff --git /m.test(text)),
  };
}
