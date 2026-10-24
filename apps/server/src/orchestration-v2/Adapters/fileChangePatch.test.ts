import { describe, expect, it } from "@effect/vitest";
import { codexFileChangePatch } from "./fileChangePatch.ts";

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
});
