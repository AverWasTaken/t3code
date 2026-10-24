function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function header(path: string): string {
  return /[\s"\\]/u.test(path) ? JSON.stringify(path) : path;
}

function headers(oldPath: string | null, newPath: string | null): string {
  return `--- ${oldPath === null ? "/dev/null" : header(`a/${oldPath}`)}\n+++ ${newPath === null ? "/dev/null" : header(`b/${newPath}`)}\n`;
}

function fullContent(path: string, content: string, added: boolean): string {
  const lines = content === "" ? [] : content.split("\n");
  const finalNewline = content.endsWith("\n");
  if (finalNewline) lines.pop();
  const count = lines.length;
  return (
    headers(added ? null : path, added ? path : null) +
    (count === 0
      ? ""
      : `@@ -${added ? "0,0" : `1,${count}`} +${added ? `1,${count}` : "0,0"} @@\n` +
        lines.map((line) => `${added ? "+" : "-"}${line}\n`).join("") +
        (finalNewline ? "" : "\\ No newline at end of file\n"))
  );
}

function changedContent(path: string, before: string, after: string): string | undefined {
  if (before === after) return undefined;
  // Include line endings in comparisons so an EOF-newline-only edit survives.
  const oldLines = before.match(/[^\n]*\n|[^\n]+$/gu) ?? [];
  const newLines = after.match(/[^\n]*\n|[^\n]+$/gu) ?? [];
  let prefix = 0;
  while (
    prefix < oldLines.length &&
    prefix < newLines.length &&
    oldLines[prefix] === newLines[prefix]
  )
    prefix++;
  let suffix = 0;
  while (
    suffix < oldLines.length - prefix &&
    suffix < newLines.length - prefix &&
    oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]
  )
    suffix++;
  const start = Math.max(0, prefix - 3);
  const contextAfter = Math.min(3, suffix);
  const oldEnd = oldLines.length - suffix;
  const newEnd = newLines.length - suffix;
  const oldCount = oldEnd + contextAfter - start;
  const newCount = newEnd + contextAfter - start;
  const line = (value: string, sign: string) =>
    `${sign}${value}${value.endsWith("\n") ? "" : "\n\\ No newline at end of file\n"}`;
  return (
    headers(path, path) +
    `@@ -${oldCount === 0 ? start : start + 1},${oldCount} +${newCount === 0 ? start : start + 1},${newCount} @@\n` +
    oldLines
      .slice(start, prefix)
      .map((value) => line(value, " "))
      .join("") +
    oldLines
      .slice(prefix, oldEnd)
      .map((value) => line(value, "-"))
      .join("") +
    newLines
      .slice(prefix, newEnd)
      .map((value) => line(value, "+"))
      .join("") +
    oldLines
      .slice(oldEnd, oldEnd + contextAfter)
      .map((value) => line(value, " "))
      .join("")
  );
}

type CodexChange = {
  readonly path: string;
  readonly kind: { readonly type: "add" | "delete" | "update"; readonly move_path?: string | null };
  readonly diff: string;
};

/** Native update bodies contain hunks; add/delete bodies contain whole file contents. */
export function codexFileChangePatch(changes: ReadonlyArray<CodexChange>): string | undefined {
  const patches = changes.map((change) => {
    if (change.kind.type !== "update")
      return fullContent(change.path, change.diff, change.kind.type === "add");
    const destination = change.kind.move_path ?? change.path;
    const suffix = `\n\nMoved to: ${destination}`;
    const diff =
      change.kind.move_path && change.diff.endsWith(suffix)
        ? change.diff.slice(0, -suffix.length)
        : change.diff;
    // No hunk can also be an accepted rename without content changes.
    if (diff !== "" && !validHunks(diff)) return undefined;
    return (
      headers(change.path, destination) + (diff === "" || diff.endsWith("\n") ? diff : `${diff}\n`)
    );
  });
  return patches.some((patch) => patch === undefined) ? undefined : patches.join("");
}

function validHunks(diff: string): boolean {
  const lines = diff.split("\n");
  if (lines.at(-1) === "") lines.pop();
  let oldRemaining = 0;
  let newRemaining = 0;
  let found = false;
  for (const line of lines) {
    const hunk = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@.*$/u.exec(line);
    if (hunk) {
      if (oldRemaining !== 0 || newRemaining !== 0) return false;
      oldRemaining = Number(hunk[2] ?? 1);
      newRemaining = Number(hunk[4] ?? 1);
      found = true;
    } else if (line === "\\ No newline at end of file") {
      if (!found) return false;
    } else {
      if (!found) return false;
      if (line.startsWith(" ")) {
        oldRemaining--;
        newRemaining--;
      } else if (line.startsWith("-")) oldRemaining--;
      else if (line.startsWith("+")) newRemaining--;
      else return false;
      if (oldRemaining < 0 || newRemaining < 0) return false;
    }
  }
  return found && oldRemaining === 0 && newRemaining === 0;
}

/** Only accepted, structured native results establish the actual edit. */
export function claudeFileChangePatch(output: unknown): string | undefined {
  if (
    !record(output) ||
    output.staged === true ||
    (typeof output.error === "string" && output.error.trim())
  )
    return undefined;
  if (
    typeof output.notebook_path === "string" &&
    output.notebook_path.trim() &&
    typeof output.original_file === "string" &&
    typeof output.updated_file === "string"
  ) {
    return changedContent(output.notebook_path, output.original_file, output.updated_file);
  }
  if (typeof output.filePath !== "string" || !output.filePath.trim()) return undefined;
  if (Array.isArray(output.structuredPatch) && output.structuredPatch.length > 0) {
    const hunks: string[] = [];
    for (const hunk of output.structuredPatch) {
      if (
        !record(hunk) ||
        ![hunk.oldStart, hunk.oldLines, hunk.newStart, hunk.newLines].every(
          (value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0,
        ) ||
        !Array.isArray(hunk.lines) ||
        !hunk.lines.every((line) => typeof line === "string" && !line.includes("\n"))
      )
        return undefined;
      hunks.push(
        `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n${hunk.lines.join("\n")}\n`,
      );
    }
    const diff = hunks.join("");
    return validHunks(diff)
      ? headers(output.type === "create" ? null : output.filePath, output.filePath) + diff
      : undefined;
  }
  if (typeof output.content !== "string") return undefined;
  if (output.type === "create") return fullContent(output.filePath, output.content, true);
  return output.type === "update" && typeof output.originalFile === "string"
    ? changedContent(output.filePath, output.originalFile, output.content)
    : undefined;
}
