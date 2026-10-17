import { assert } from "@effect/vitest";
import type { OrchestrationV2ThreadProjection, ProviderReplayTranscript } from "@t3tools/contracts";

import type { OrchestratorV2ScenarioResult } from "../../OrchestratorScenario.ts";
import {
  assertBaseProjection,
  assertNoExtraAppRunsForProviderChildren,
  assertSemanticProjectionIntegrity,
  backgroundNotifications,
  projectionFor,
} from "../shared.ts";

const CHILD_TASK_ID = "a5d7d869cbb05c754";
const GRANDCHILD_TASK_ID = "a412f30077dfd84dd";

// The grandchild ends while the root is idle, but Claude reports that end to
// the child that started it. Only the child's end wakes the root, so it alone
// opens run 2 and names the wake.
export function assertClaudeNestedBackgroundSubagentWakeOutput(
  result: OrchestratorV2ScenarioResult,
  transcript: ProviderReplayTranscript,
) {
  assertBaseProjection({
    result,
    transcript,
    runCount: 2,
    runStatuses: ["completed", "completed"],
  });
  const projection = projectionFor(result, transcript.scenario);
  assertSemanticProjectionIntegrity(projection);
  assertNoExtraAppRunsForProviderChildren({ projection, expectedAppRuns: 2 });

  const byTask = (owner: OrchestrationV2ThreadProjection, taskId: string) => {
    const subagent = owner.subagents.find((agent) => agent.nativeTaskRef?.nativeId === taskId);
    assert.isDefined(subagent, `missing subagent for task ${taskId}`);
    assert.equal(subagent.status, "completed");
    return subagent;
  };
  const child = byTask(projection, CHILD_TASK_ID);
  assert.equal(child.parentNodeId, projection.runs[0]?.rootNodeId);
  if (child.childThreadId === null) {
    throw new Error("The child subagent is missing its child thread.");
  }
  const childThread = result.projections.get(child.childThreadId);
  assert.isDefined(childThread);
  const grandchild = byTask(childThread, GRANDCHILD_TASK_ID);
  assert.equal(
    grandchild.threadId,
    child.childThreadId,
    "the grandchild lives in the child's thread",
  );
  assert.equal(
    grandchild.parentNodeId,
    childThread.nodes.find((node) => node.kind === "root_turn")?.id,
    "the grandchild hangs off the child",
  );

  const wakeMessage = projection.messages.find(
    (message) => message.id === projection.runs[1]?.userMessageId,
  );
  assert.equal(wakeMessage?.text, "CHILD_DONE", "the child's end opens the wake");
  assert.deepEqual(backgroundNotifications(projection), [
    {
      summary: `Subagent "${child.title}" finished`,
      outcome: "completed",
      source: { kind: "subagent", childThreadId: child.childThreadId },
    },
  ]);
}
