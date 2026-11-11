import { describe, expect, it } from "vite-plus/test";

import {
  allOnHiddenEnvironments,
  filterHiddenEnvironmentThreads,
  releaseTasksOfHiddenParents,
  resolveSidebarEnvironmentFilterMenu,
  visibleEnvironmentIds,
} from "./environmentVisibility";

const keyOf = (thread: { environmentId: string; id: string }) =>
  `${thread.environmentId}:${thread.id}`;

describe("filterHiddenEnvironmentThreads", () => {
  const threads = [
    { environmentId: "pc", id: "a" },
    { environmentId: "hp", id: "b" },
    { environmentId: "hp", id: "c" },
    { environmentId: "think", id: "d" },
  ];

  it("drops threads on hidden machines but keeps the open thread", () => {
    expect(filterHiddenEnvironmentThreads(threads, ["hp"], null, keyOf)).toEqual([
      { environmentId: "pc", id: "a" },
      { environmentId: "think", id: "d" },
    ]);
    expect(filterHiddenEnvironmentThreads(threads, ["hp", "think"], "hp:c", keyOf)).toEqual([
      { environmentId: "pc", id: "a" },
      { environmentId: "hp", id: "c" },
    ]);
  });

  it("returns the same list when nothing it holds is hidden", () => {
    expect(filterHiddenEnvironmentThreads(threads, [], null, keyOf)).toBe(threads);
    expect(filterHiddenEnvironmentThreads(threads, ["gone"], null, keyOf)).toBe(threads);
  });
});

describe("releaseTasksOfHiddenParents", () => {
  type Task = { environmentId: string; id: string; parent: string | null };
  const taskKeys = {
    thread: (task: Task) => `${task.environmentId}:${task.id}`,
    parent: (task: Task) =>
      task.parent === null ? null : { environmentId: task.parent.split(":")[0]!, key: task.parent },
  };
  const tasks: Task[] = [
    { environmentId: "hp", id: "parent", parent: null },
    { environmentId: "pc", id: "task", parent: "hp:parent" },
    { environmentId: "think", id: "other", parent: "pc:root" },
  ];
  const underParent = new Set(["pc:task", "think:other"]);

  it("lists a task on its own when its parent's machine is hidden", () => {
    expect([...releaseTasksOfHiddenParents(tasks, underParent, ["hp"], null, taskKeys)]).toEqual([
      "think:other",
    ]);
  });

  it("keeps tasks under an open parent and returns the same set when nothing moves", () => {
    expect(releaseTasksOfHiddenParents(tasks, underParent, ["hp"], "hp:parent", taskKeys)).toBe(
      underParent,
    );
    expect(releaseTasksOfHiddenParents(tasks, underParent, ["think"], null, taskKeys)).toBe(
      underParent,
    );
  });
});

describe("visibleEnvironmentIds", () => {
  it("removes hidden machines and keeps the list when none are hidden", () => {
    const ids = ["pc", "hp", "think"];
    expect(visibleEnvironmentIds(ids, ["hp"])).toEqual(["pc", "think"]);
    expect(visibleEnvironmentIds(ids, ["gone"])).toBe(ids);
  });
});

describe("allOnHiddenEnvironments", () => {
  it("is true only when every member is on a hidden machine", () => {
    const hpOnly = [{ environmentId: "hp" }];
    const mixed = [{ environmentId: "hp" }, { environmentId: "pc" }];
    expect(allOnHiddenEnvironments(hpOnly, ["hp"])).toBe(true);
    expect(allOnHiddenEnvironments(mixed, ["hp"])).toBe(false);
    expect(allOnHiddenEnvironments([], ["hp"])).toBe(false);
    expect(allOnHiddenEnvironments(hpOnly, [])).toBe(false);
  });
});

describe("resolveSidebarEnvironmentFilterMenu", () => {
  const environments = [
    { environmentId: "pc", label: "Windows PC" },
    { environmentId: "hp", label: "hp" },
    { environmentId: "think", label: " " },
  ];

  it("checks visible machines and locks the last visible one", () => {
    expect(resolveSidebarEnvironmentFilterMenu(environments, ["hp", "think", "gone"])).toEqual({
      items: [
        { environmentId: "pc", label: "Windows PC", visible: true, disabled: true },
        { environmentId: "hp", label: "hp", visible: false, disabled: false },
        { environmentId: "think", label: "think", visible: false, disabled: false },
      ],
      hiddenCount: 2,
      showButton: true,
    });
  });

  it("shows the button for two machines, or for one that is hidden", () => {
    expect(resolveSidebarEnvironmentFilterMenu(environments.slice(0, 1), []).showButton).toBe(
      false,
    );
    expect(resolveSidebarEnvironmentFilterMenu(environments.slice(0, 1), ["pc"]).showButton).toBe(
      true,
    );
    expect(resolveSidebarEnvironmentFilterMenu(environments.slice(0, 2), []).showButton).toBe(true);
  });
});
