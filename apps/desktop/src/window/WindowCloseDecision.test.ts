import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import type * as Electron from "electron";
import { vi } from "vite-plus/test";

import * as DesktopState from "../app/DesktopState.ts";
import * as ElectronDialog from "../electron/ElectronDialog.ts";
import * as DesktopAppSettings from "../settings/DesktopAppSettings.ts";
import { decideWindowClose } from "./WindowCloseDecision.ts";

type WindowCloseAction = DesktopAppSettings.DesktopSettings["windowCloseAction"];
type ShowMessageBox = ElectronDialog.ElectronDialog["Service"]["showMessageBox"];

const answer = (response: number, checkboxChecked = false) => ({ response, checkboxChecked });

function runDecision(input: {
  readonly saved?: WindowCloseAction;
  readonly showMessageBox?: ShowMessageBox;
  readonly quitDuringPrompt?: boolean;
  readonly setWindowCloseAction?: DesktopAppSettings.DesktopAppSettings["Service"]["setWindowCloseAction"];
  readonly minimized?: boolean;
  readonly destroyed?: boolean;
}) {
  const window = {
    isDestroyed: vi.fn(() => input.destroyed ?? false),
    isMinimized: vi.fn(() => input.minimized ?? false),
    restore: vi.fn(),
  };
  const outcome = { quit: 0, hidden: 0, prompts: 0, restoredBeforePrompt: false };
  let saved = input.saved ?? "ask";
  const currentSettings = () => ({
    ...DesktopAppSettings.DEFAULT_DESKTOP_SETTINGS,
    windowCloseAction: saved,
  });
  const layerSettings = Layer.mock(DesktopAppSettings.DesktopAppSettings)({
    get: Effect.sync(currentSettings),
    setWindowCloseAction:
      input.setWindowCloseAction ??
      ((action) =>
        Effect.sync(() => {
          saved = action;
          return { settings: currentSettings(), changed: true };
        })),
  });
  return Effect.gen(function* () {
    const state = yield* DesktopState.DesktopState;
    const showMessageBox: ShowMessageBox = (options, owner) => {
      outcome.prompts += 1;
      outcome.restoredBeforePrompt = window.restore.mock.calls.length > 0;
      const shown = input.showMessageBox?.(options, owner) ?? Effect.die("unexpected prompt");
      return input.quitDuringPrompt ? Effect.andThen(Ref.set(state.quitting, true), shown) : shown;
    };
    yield* decideWindowClose({
      window: window as unknown as Electron.BrowserWindow,
      displayName: "T3 Code",
      quit: Effect.sync(() => {
        outcome.quit += 1;
      }),
      hideToTray: Effect.sync(() => {
        outcome.hidden += 1;
      }),
    }).pipe(Effect.provide(Layer.mock(ElectronDialog.ElectronDialog)({ showMessageBox })));
    return { ...outcome, saved };
  }).pipe(Effect.provide(Layer.mergeAll(layerSettings, DesktopState.layer)));
}

describe("decideWindowClose", () => {
  it.effect.each([
    { name: "tray", response: 0, remember: false, quit: 0, hidden: 1, saved: "ask" },
    { name: "tray, remembered", response: 0, remember: true, quit: 0, hidden: 1, saved: "tray" },
    { name: "quit", response: 1, remember: false, quit: 1, hidden: 0, saved: "ask" },
    { name: "quit, remembered", response: 1, remember: true, quit: 1, hidden: 0, saved: "quit" },
    { name: "cancel", response: 2, remember: false, quit: 0, hidden: 0, saved: "ask" },
    { name: "cancel, box ticked", response: 2, remember: true, quit: 0, hidden: 0, saved: "ask" },
  ] as const)("applies the prompt's answer: $name", (row) =>
    Effect.gen(function* () {
      const result = yield* runDecision({
        showMessageBox: () => Effect.succeed(answer(row.response, row.remember)),
      });
      assert.equal(result.prompts, 1);
      assert.equal(result.quit, row.quit);
      assert.equal(result.hidden, row.hidden);
      assert.equal(result.saved, row.saved);
    }),
  );

  it.effect.each([
    { saved: "quit", quit: 1, hidden: 0 },
    { saved: "tray", quit: 0, hidden: 1 },
  ] as const)("does not prompt when $saved is saved", (row) =>
    Effect.gen(function* () {
      const result = yield* runDecision({ saved: row.saved });
      assert.equal(result.prompts, 0);
      assert.equal(result.quit, row.quit);
      assert.equal(result.hidden, row.hidden);
    }),
  );

  it.effect("quits when the prompt cannot be shown", () =>
    Effect.gen(function* () {
      const result = yield* runDecision({
        showMessageBox: () =>
          Effect.fail(
            new ElectronDialog.ElectronDialogShowMessageBoxError({
              type: "question",
              titleLength: null,
              messageLength: 0,
              detailLength: null,
              buttonCount: 3,
              cause: new Error("simulated dialog failure"),
            }),
          ),
      });
      assert.equal(result.quit, 1);
    }),
  );

  it.effect("still acts on the answer when saving the choice fails", () =>
    Effect.gen(function* () {
      const result = yield* runDecision({
        showMessageBox: () => Effect.succeed(answer(0, true)),
        setWindowCloseAction: () =>
          Effect.fail(
            new DesktopAppSettings.DesktopSettingsWriteError({
              operation: "write-temporary-file",
              path: "/settings.json",
              cause: new Error("simulated write failure"),
            }),
          ),
      });
      assert.equal(result.hidden, 1);
      assert.equal(result.saved, "ask");
    }),
  );

  it.effect("restores a minimized window before prompting", () =>
    Effect.gen(function* () {
      const result = yield* runDecision({
        minimized: true,
        showMessageBox: () => Effect.succeed(answer(2)),
      });
      assert.isTrue(result.restoredBeforePrompt);
    }),
  );

  it.effect("does nothing further when a quit ran while the prompt was open", () =>
    Effect.gen(function* () {
      const result = yield* runDecision({
        quitDuringPrompt: true,
        showMessageBox: () => Effect.succeed(answer(0, true)),
      });
      assert.equal(result.hidden, 0);
      assert.equal(result.saved, "ask");
    }),
  );

  it.effect("does nothing further when the window was destroyed during the prompt", () =>
    Effect.gen(function* () {
      const result = yield* runDecision({
        destroyed: true,
        showMessageBox: () => Effect.succeed(answer(1, true)),
      });
      assert.equal(result.quit, 0);
      assert.equal(result.saved, "ask");
    }),
  );
});
