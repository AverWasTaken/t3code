import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";

import type * as Electron from "electron";

import { makeComponentLogger } from "../app/DesktopObservability.ts";
import * as DesktopState from "../app/DesktopState.ts";
import * as ElectronDialog from "../electron/ElectronDialog.ts";
import * as DesktopAppSettings from "../settings/DesktopAppSettings.ts";

const { logWarning } = makeComponentLogger("desktop-window");

export const decideWindowClose = Effect.fn("DesktopWindow.decideWindowClose")(function* (input: {
  readonly window: Electron.BrowserWindow;
  readonly displayName: string;
  readonly quit: Effect.Effect<void>;
  readonly hideToTray: Effect.Effect<void>;
}) {
  const desktopSettings = yield* DesktopAppSettings.DesktopAppSettings;
  const desktopState = yield* DesktopState.DesktopState;
  const electronDialog = yield* ElectronDialog.ElectronDialog;
  const { window } = input;

  const { windowCloseAction } = yield* desktopSettings.get;
  if (windowCloseAction !== "ask") {
    yield* windowCloseAction === "quit" ? input.quit : input.hideToTray;
    return;
  }

  // Taskbar right-click Close reaches a minimized window, and the prompt needs it on screen.
  if (window.isMinimized()) window.restore();
  const { action, remember } = yield* electronDialog
    .showMessageBox(
      {
        type: "question",
        title: input.displayName,
        message: `Quit ${input.displayName} or minimize it to the tray?`,
        detail: "Quitting stops running sessions.",
        buttons: ["Minimize to tray", "Quit", "Cancel"],
        defaultId: 0,
        cancelId: 2,
        noLink: true,
        checkboxLabel: "Remember my choice",
        checkboxChecked: false,
      },
      window,
    )
    .pipe(
      Effect.map(({ response, checkboxChecked }) => ({
        action: response === 0 ? ("tray" as const) : response === 1 ? ("quit" as const) : null,
        remember: checkboxChecked,
      })),
      Effect.catch((error) =>
        logWarning("close prompt failed; quitting", { message: error.message }).pipe(
          Effect.as({ action: "quit" as const, remember: false }),
        ),
      ),
    );

  // A tray or shortcut quit may have run while the prompt was open.
  if (window.isDestroyed() || (yield* Ref.get(desktopState.quitting)) || action === null) return;
  if (remember) {
    yield* desktopSettings
      .setWindowCloseAction(action)
      .pipe(
        Effect.catch((error) =>
          logWarning("failed to save window close action", { message: error.message }),
        ),
      );
  }
  yield* action === "quit" ? input.quit : input.hideToTray;
});
