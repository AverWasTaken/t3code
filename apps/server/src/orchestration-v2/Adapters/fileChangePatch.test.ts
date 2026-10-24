import { describe, expect, it } from "@effect/vitest";
import { claudeFileChangePatch, codexFileChangePatch } from "./fileChangePatch.ts";

describe("native file change patches", () => {
  it("combines every Codex file and removes only the native rename suffix", () => {
    expect(
      codexFileChangePatch([
        { path: "new.txt", kind: { type: "add" }, diff: "new\n" },
        { path: "old.txt", kind: { type: "delete" }, diff: "old" },
        {
          path: "from.txt",
          kind: { type: "update", move_path: "to.txt" },
          diff: "@@ -1 +1 @@\n-a\n+b\n\nMoved to: to.txt",
        },
      ]),
    ).toBe(
      "--- /dev/null\n+++ b/new.txt\n@@ -0,0 +1,1 @@\n+new\n--- a/old.txt\n+++ /dev/null\n@@ -1,1 +0,0 @@\n-old\n\\ No newline at end of file\n--- a/from.txt\n+++ b/to.txt\n@@ -1 +1 @@\n-a\n+b\n",
    );
  });

  it("quotes unusual filenames and preserves CRLF and empty additions", () => {
    expect(
      codexFileChangePatch([{ path: "a\tb\n\\c.txt", kind: { type: "add" }, diff: "one\r\n" }]),
    ).toContain('+++ "b/a\\tb\\n\\\\c.txt"\n@@ -0,0 +1,1 @@\n+one\r\n');
    expect(codexFileChangePatch([{ path: "empty", kind: { type: "add" }, diff: "" }])).toBe(
      "--- /dev/null\n+++ b/empty\n",
    );
  });

  it("uses accepted Claude hunks without reconstructing from input", () => {
    const result = {
      filePath: "/a",
      userModified: true,
      structuredPatch: [
        {
          oldStart: 1,
          oldLines: 2,
          newStart: 1,
          newLines: 2,
          lines: ["-old", "+accepted", " same"],
        },
      ],
    };
    expect(claudeFileChangePatch(result)).toBe(
      "--- a//a\n+++ b//a\n@@ -1,2 +1,2 @@\n-old\n+accepted\n same\n",
    );
    expect(claudeFileChangePatch({ ...result, staged: true })).toBeUndefined();
    expect(
      claudeFileChangePatch({
        ...result,
        structuredPatch: [
          { oldStart: 1, oldLines: 99, newStart: 1, newLines: 2, lines: ["+wrong"] },
        ],
      }),
    ).toBeUndefined();
  });

  it("only falls back to actual Claude create content", () => {
    expect(
      claudeFileChangePatch({ type: "create", filePath: "a", content: "ok", structuredPatch: [] }),
    ).toContain("+ok\n\\ No newline at end of file\n");
    expect(
      claudeFileChangePatch({
        type: "update",
        filePath: "a",
        originalFile: null,
        content: "ok",
        structuredPatch: [],
      }),
    ).toBeUndefined();
    expect(claudeFileChangePatch("File updated successfully")).toBeUndefined();
  });

  it("uses actual Write and NotebookEdit before-and-after contents when native hunks are unavailable", () => {
    expect(
      claudeFileChangePatch({
        type: "update",
        filePath: "a",
        originalFile: "before\n",
        content: "accepted\n",
        structuredPatch: [],
      }),
    ).toBe("--- a/a\n+++ b/a\n@@ -1,1 +1,1 @@\n-before\n+accepted\n");
    expect(
      claudeFileChangePatch({
        notebook_path: "a.ipynb",
        original_file: "same\nbefore",
        updated_file: "same\nafter",
      }),
    ).toBe(
      "--- a/a.ipynb\n+++ b/a.ipynb\n@@ -1,2 +1,2 @@\n same\n-before\n\\ No newline at end of file\n+after\n\\ No newline at end of file\n",
    );
    expect(
      claudeFileChangePatch({
        notebook_path: "a.ipynb",
        original_file: "before",
        updated_file: "after",
        error: "Edit failed",
      }),
    ).toBeUndefined();
  });

  it.each([
    ["line", "line\n", "-line\n\\ No newline at end of file\n+line\n"],
    ["line\n", "line", "-line\n+line\n\\ No newline at end of file\n"],
    ["", "line\n", "@@ -0,0 +1,1 @@\n+line\n"],
    ["line\n", "", "@@ -1,1 +0,0 @@\n-line\n"],
  ])("preserves fallback EOF changes from %j to %j", (before, after, expected) => {
    expect(
      claudeFileChangePatch({
        type: "update",
        filePath: "a",
        originalFile: before,
        content: after,
        structuredPatch: [],
      }),
    ).toContain(expected);
  });
});
