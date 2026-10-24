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
