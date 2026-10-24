import { describe, expect, it } from "vite-plus/test";
import { inlineEditPreview, workEntryExpanded } from "./inlineEdit.js";

describe("inline edit disclosure", () => {
  it("keeps a manual collapse across item revisions and remounts", () => {
    const overrides = new Map<string, boolean>();
    expect(workEntryExpanded(overrides.get("edit"), "file_change")).toBe(true);
    overrides.set("edit", false);
    expect(workEntryExpanded(overrides.get("edit"), "file_change")).toBe(false);
    expect(workEntryExpanded(new Map(overrides).get("edit"), "file_change")).toBe(false);
    expect(workEntryExpanded(undefined, "command_execution")).toBe(false);
  });
  it("bounds short lines and marks incomplete patches before parsing", () => {
    expect(inlineEditPreview("+x\n".repeat(1000)).lines).toHaveLength(500);
    expect(inlineEditPreview("+x\n".repeat(1000)).limited).toBe(true);
    expect(inlineEditPreview("-old\n+new", true).limited).toBe(true);
    expect(inlineEditPreview("x".repeat(40000)).text.length).toBe(32768);
    expect(inlineEditPreview("-old\n+new").limited).toBe(false);
  });
});

it("recognizes ordinary and multi-file patches while rejecting historical output", () => {
  const file = "diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-old\n+new";
  expect(inlineEditPreview(file).isPatch).toBe(true);
  expect(inlineEditPreview(`${file}\n${file.replaceAll("a.ts", "b.ts")}`).isPatch).toBe(true);
  expect(inlineEditPreview("Edit succeeded").isPatch).toBe(false);
  expect(inlineEditPreview('{"success":true}').isPatch).toBe(false);
  expect(inlineEditPreview("Binary files a/image.png and b/image.png differ").isPatch).toBe(false);
  expect(inlineEditPreview("diff --git a/a.ts b/a.ts", true).isPatch).toBe(true);
  expect(inlineEditPreview("diff --git a/a.ts b/a.ts\n@@ malformed hunk").isPatch).toBe(true);
});
