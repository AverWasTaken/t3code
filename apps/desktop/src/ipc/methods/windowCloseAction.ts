import { DesktopWindowCloseActionSchema } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import * as DesktopAppSettings from "../../settings/DesktopAppSettings.ts";
import * as IpcChannels from "../channels.ts";
import { makeIpcMethod, makeSyncIpcMethod } from "../DesktopIpc.ts";

export const getWindowCloseAction = makeSyncIpcMethod({
  channel: IpcChannels.GET_WINDOW_CLOSE_ACTION_CHANNEL,
  result: DesktopWindowCloseActionSchema,
  handler: Effect.fn("desktop.ipc.windowCloseAction.get")(function* () {
    const appSettings = yield* DesktopAppSettings.DesktopAppSettings;
    return (yield* appSettings.get).windowCloseAction;
  }),
});

export const setWindowCloseAction = makeIpcMethod({
  channel: IpcChannels.SET_WINDOW_CLOSE_ACTION_CHANNEL,
  payload: DesktopWindowCloseActionSchema,
  result: Schema.Void,
  handler: Effect.fn("desktop.ipc.windowCloseAction.set")(function* (action) {
    const appSettings = yield* DesktopAppSettings.DesktopAppSettings;
    yield* appSettings.setWindowCloseAction(action);
  }),
});
