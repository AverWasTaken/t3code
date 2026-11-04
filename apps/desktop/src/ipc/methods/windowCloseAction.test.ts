import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import * as DesktopAppSettings from "../../settings/DesktopAppSettings.ts";
import { getWindowCloseAction, setWindowCloseAction } from "./windowCloseAction.ts";

describe("window close action IPC", () => {
  it.effect("reads back the saved action and keeps other settings", () =>
    Effect.gen(function* () {
      assert.equal(yield* getWindowCloseAction.handler(), "ask");
      yield* setWindowCloseAction.handler("tray");
      assert.equal(yield* getWindowCloseAction.handler(), "tray");
      const appSettings = yield* DesktopAppSettings.DesktopAppSettings;
      assert.isTrue((yield* appSettings.get).wslBackendEnabled);
    }).pipe(
      Effect.provide(
        DesktopAppSettings.layerTest({
          ...DesktopAppSettings.DEFAULT_DESKTOP_SETTINGS,
          wslBackendEnabled: true,
        }),
      ),
    ),
  );
});
