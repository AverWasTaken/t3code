import { RunId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import { deriveMessagesTimelineRows, liveWorkEntryLabel } from "./MessagesTimeline.logic";

describe("long active tool groups", () => {
  it.each([false, true])(
    "preserves chronological order and the latest activity, expanded=%s",
    (expanded) => {
      const runId = RunId.make("long-active-run");
      const createdAt = "2026-10-12T00:00:00Z";
      const timelineEntries = Array.from({ length: 1_000 }, (_, index) => ({
        id: `work-entry-${index}`,
        kind: "work" as const,
        createdAt,
        entry: {
          id: `work-${index}`,
          createdAt,
          runId,
          label: `Tool ${index}`,
          tone: index % 2 === 0 ? ("thinking" as const) : ("tool" as const),
          itemType: index % 2 === 0 ? ("reasoning" as const) : ("command_execution" as const),
          ...(index % 2 === 0 ? { detail: `Thought ${index}` } : {}),
          toolLifecycleStatus: index === 999 ? ("inProgress" as const) : ("completed" as const),
        },
      }));
      const rows = deriveMessagesTimelineRows({
        timelineEntries,
        isWorking: true,
        runningRunId: runId,
        activeTurnStartedAt: createdAt,
        turnDiffSummaries: [],
        supportsConversationRollback: false,
        expandedWorkGroupIds: new Set(expanded ? ["work-group:work-entry-0"] : []),
      });
      const live = rows.find((row) => row.kind === "work-live");
      expect(live).toBeDefined();
      expect(live?.entry.id).toBe("work-999");
      expect(live && liveWorkEntryLabel(live.entry, undefined, live.active)).toContain("999");
      expect(live?.thought?.id).toBe("work-998");
      expect(live?.groupedEntries.map(({ id }) => id)).toEqual(
        timelineEntries.map(({ entry }) => entry.id),
      );
      expect(live?.groupId).toBe("work-group:work-entry-0");
      const details = rows.filter((row) => row.kind === "work");
      expect(details).toHaveLength(expanded ? 1 : 0);
      if (expanded) {
        expect(details[0]?.groupedEntries).toEqual(live?.groupedEntries);
      }
    },
  );
});

describe("inline edits", () => {
  it.each([false, true])("keeps edits outside collapsed live groups, expanded=%s", (expanded) => {
    const runId = RunId.make("edit-run");
    const createdAt = "2026-10-12T00:00:00Z";
    const timelineEntries = [
      "command_execution",
      "file_change",
      "command_execution",
      "file_change",
      "file_change",
    ].map((itemType, index) => ({
      id: `entry-${index}`,
      kind: "work" as const,
      createdAt,
      entry: {
        id: `work-${index}`,
        createdAt,
        runId,
        label: `Tool ${index}`,
        tone: "tool" as const,
        itemType: itemType as "command_execution" | "file_change",
        toolLifecycleStatus: "completed" as const,
      },
    }));
    const rows = deriveMessagesTimelineRows({
      timelineEntries,
      isWorking: true,
      runningRunId: runId,
      activeTurnStartedAt: createdAt,
      turnDiffSummaries: [],
      supportsConversationRollback: false,
      expandedWorkGroupIds: new Set(expanded ? ["work-group:entry-0", "work-group:entry-2"] : []),
    });
    const editRows = rows.filter(
      (row) =>
        row.kind === "work" && row.groupedEntries.some((entry) => entry.itemType === "file_change"),
    );
    expect(
      editRows.map((row) =>
        row.kind === "work" ? row.groupedEntries.map((entry) => entry.id) : [],
      ),
    ).toEqual([["work-1"], ["work-3"], ["work-4"]]);
  });
});
