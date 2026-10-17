import { assert } from "@effect/vitest";
import type { OrchestrationV2ThreadProjection, ProviderReplayTranscript } from "@t3tools/contracts";

import type { OrchestratorV2ScenarioResult } from "../../OrchestratorScenario.ts";
import {
  assertAssistantTextIncludes,
  assertBaseProjection,
  assertNoExtraAppRunsForProviderChildren,
  assertSemanticProjectionIntegrity,
  projectionFor,
} from "../shared.ts";

const OUTER_TASK_ID = "a457ca677bc1ecd82";
const NESTED_TASK_ID = "aac1d7a2af5371c7d";
const SUBAGENT_MODEL = "claude-haiku-4-5";

export function assertClaudeNestedSubagentModelOutput(
  result: OrchestratorV2ScenarioResult,
  transcript: ProviderReplayTranscript,
) {
  assertBaseProjection({ result, transcript, runCount: 1, runStatuses: ["completed"] });
  const projection = projectionFor(result, transcript.scenario);
  assertSemanticProjectionIntegrity(projection);
  assertNoExtraAppRunsForProviderChildren({ projection, expectedAppRuns: 1 });
  assertAssistantTextIncludes(projection, "NESTED_LEAF_OK");
  assert.lengthOf(result.shellSnapshot.threads, 3);

  const rootNodeId = projection.runs[0]?.rootNodeId;
  assert.isDefined(rootNodeId);
  const byTask = (owner: OrchestrationV2ThreadProjection, taskId: string) => {
    const subagent = owner.subagents.find((agent) => agent.nativeTaskRef?.nativeId === taskId);
    assert.isDefined(subagent, `missing subagent for task ${taskId}`);
    assert.equal(subagent.status, "completed");
    return subagent;
  };
  const outer = byTask(projection, OUTER_TASK_ID);
  if (outer.childThreadId === null) {
    throw new Error("outer subagent is missing its child thread");
  }
  const outerChild = result.projections.get(outer.childThreadId);
  assert.isDefined(outerChild);
  assert.isUndefined(
    projection.subagents.find((agent) => agent.nativeTaskRef?.nativeId === NESTED_TASK_ID),
    "a nested subagent is not listed on the root thread",
  );
  const nested = byTask(outerChild, NESTED_TASK_ID);

  assert.equal(outer.parentNodeId, rootNodeId);
  assert.equal(outer.model, SUBAGENT_MODEL);

  const outerChildRoot = outerChild.nodes.find((node) => node.kind === "root_turn");
  assert.isDefined(outerChildRoot);
  assert.equal(
    nested.threadId,
    outer.childThreadId,
    "a nested subagent lives in its owner's thread",
  );
  assert.isNull(nested.runId);
  assert.equal(nested.parentNodeId, outerChildRoot.id, "a nested subagent hangs off its owner");
  assert.equal(nested.model, SUBAGENT_MODEL, "a nested subagent runs on its owner's model");
  const subagentSelection = { instanceId: outer.providerInstanceId, model: SUBAGENT_MODEL };
  assert.deepEqual(outer.modelSelection, subagentSelection);
  assert.deepEqual(nested.modelSelection, subagentSelection);
  const nestedNode = outerChild.nodes.find((node) => node.id === nested.id);
  assert.isDefined(nestedNode);
  assert.equal(nestedNode.parentNodeId, outerChildRoot.id);
  assert.equal(nestedNode.rootNodeId, outerChildRoot.id);
  const nestedItem = outerChild.turnItems.find(
    (item) => item.type === "subagent" && item.subagentId === nested.id,
  );
  assert.isDefined(nestedItem, "the owner's thread shows the nested subagent");
  assert.include(nested.result ?? "", "NESTED_LEAF_OK");

  if (nested.childThreadId === null) {
    throw new Error("nested subagent is missing its child thread");
  }
  const nestedChild = result.projections.get(nested.childThreadId);
  assert.isDefined(nestedChild);
  assert.equal(nestedChild.thread.modelSelection.model, SUBAGENT_MODEL);
  assert.equal(nestedChild.thread.lineage.parentThreadId, outer.childThreadId);
}
