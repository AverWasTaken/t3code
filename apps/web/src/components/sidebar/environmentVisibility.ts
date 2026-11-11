interface EnvironmentScoped {
  readonly environmentId: string;
}

/**
 * Drops threads on machines the user hid. The open thread stays, so a thread opened from the
 * palette, a link or a notification still shows its row without un-hiding its machine.
 */
export function filterHiddenEnvironmentThreads<T extends EnvironmentScoped>(
  threads: readonly T[],
  hiddenEnvironmentIds: readonly string[],
  keptThreadKey: string | null,
  threadKey: (thread: T) => string,
): readonly T[] {
  if (hiddenEnvironmentIds.length === 0) return threads;
  const hidden = new Set(hiddenEnvironmentIds);
  if (!threads.some((thread) => hidden.has(thread.environmentId))) return threads;
  return threads.filter(
    (thread) =>
      !hidden.has(thread.environmentId) ||
      (keptThreadKey !== null && threadKey(thread) === keptThreadKey),
  );
}

export function visibleEnvironmentIds<T extends string>(
  environmentIds: readonly T[],
  hiddenEnvironmentIds: readonly string[],
): readonly T[] {
  if (hiddenEnvironmentIds.length === 0) return environmentIds;
  const hidden = new Set(hiddenEnvironmentIds);
  return environmentIds.some((id) => hidden.has(id))
    ? environmentIds.filter((id) => !hidden.has(id))
    : environmentIds;
}

/** True when every member lives on a hidden machine, so a kept-empty folder has nothing to offer. */
export function allOnHiddenEnvironments(
  members: readonly EnvironmentScoped[],
  hiddenEnvironmentIds: readonly string[],
): boolean {
  return (
    members.length > 0 &&
    hiddenEnvironmentIds.length > 0 &&
    members.every((member) => hiddenEnvironmentIds.includes(member.environmentId))
  );
}

export interface SidebarEnvironmentFilterItem {
  readonly environmentId: string;
  readonly label: string;
  readonly visible: boolean;
  /** The last visible machine cannot be hidden; "Show all machines" is the way back. */
  readonly disabled: boolean;
}

export interface SidebarEnvironmentFilterMenu {
  readonly items: readonly SidebarEnvironmentFilterItem[];
  /** Hidden machines that are still listed. Stored ids for machines no longer listed don't count. */
  readonly hiddenCount: number;
  readonly showButton: boolean;
}

export function resolveSidebarEnvironmentFilterMenu(
  environments: ReadonlyArray<{ readonly environmentId: string; readonly label: string }>,
  hiddenEnvironmentIds: readonly string[],
): SidebarEnvironmentFilterMenu {
  const hidden = new Set(hiddenEnvironmentIds);
  const visibleCount = environments.filter(
    (environment) => !hidden.has(environment.environmentId),
  ).length;
  const items = environments.map((environment) => {
    const visible = !hidden.has(environment.environmentId);
    return {
      environmentId: environment.environmentId,
      label: environment.label.trim() || environment.environmentId,
      visible,
      disabled: visible && visibleCount <= 1,
    };
  });
  const hiddenCount = environments.length - visibleCount;
  return { items, hiddenCount, showButton: environments.length >= 2 || hiddenCount > 0 };
}

/**
 * Tasks normally show under the thread that delegated them. When that thread's machine is hidden,
 * the task would vanish with it, so it is listed on its own instead.
 */
export function releaseTasksOfHiddenParents<T extends EnvironmentScoped>(
  threads: readonly T[],
  delegatedUnderParent: ReadonlySet<string>,
  hiddenEnvironmentIds: readonly string[],
  keptThreadKey: string | null,
  keys: {
    readonly thread: (thread: T) => string;
    readonly parent: (thread: T) => { readonly environmentId: string; readonly key: string } | null;
  },
): ReadonlySet<string> {
  if (hiddenEnvironmentIds.length === 0 || delegatedUnderParent.size === 0) {
    return delegatedUnderParent;
  }
  const hidden = new Set(hiddenEnvironmentIds);
  const released = new Set<string>();
  for (const thread of threads) {
    const key = keys.thread(thread);
    if (!delegatedUnderParent.has(key)) continue;
    const parent = keys.parent(thread);
    if (parent !== null && hidden.has(parent.environmentId) && parent.key !== keptThreadKey) {
      released.add(key);
    }
  }
  if (released.size === 0) return delegatedUnderParent;
  return new Set([...delegatedUnderParent].filter((key) => !released.has(key)));
}
