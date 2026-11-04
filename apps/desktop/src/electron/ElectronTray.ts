import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import * as Electron from "electron";

export class ElectronTrayCreateError extends Schema.TaggedError<ElectronTrayCreateError>()(
  "ElectronTrayCreateError",
  {
    iconPath: Schema.String,
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Failed to create the tray icon from ${this.iconPath}.`;
  }
}

export interface ElectronTrayInput {
  readonly iconPath: string;
  readonly tooltip: string;
  readonly showLabel: string;
  readonly quitLabel: string;
  readonly onShow: () => void;
  readonly onQuit: () => void;
}

export class ElectronTray extends Context.Service<
  ElectronTray,
  {
    readonly ensure: (input: ElectronTrayInput) => Effect.Effect<void, ElectronTrayCreateError>;
    readonly destroy: Effect.Effect<void>;
  }
>()("@t3tools/desktop/electron/ElectronTray") {}

/** @public */
export const make = Effect.sync(() => {
  // Electron garbage-collects an unreferenced Tray, which removes its icon.
  let tray: Electron.Tray | null = null;

  return ElectronTray.of({
    ensure: Effect.fn("ElectronTray.ensure")(function (input) {
      return Effect.try({
        try: () => {
          if (tray !== null) return;
          const created = new Electron.Tray(input.iconPath);
          created.setToolTip(input.tooltip);
          created.setContextMenu(
            Electron.Menu.buildFromTemplate([
              { label: input.showLabel, click: input.onShow },
              { label: input.quitLabel, click: input.onQuit },
            ]),
          );
          created.on("click", input.onShow);
          tray = created;
        },
        catch: (cause) => new ElectronTrayCreateError({ iconPath: input.iconPath, cause }),
      });
    }),
    // Windows keeps showing an undestroyed icon until the mouse passes over it.
    destroy: Effect.sync(() => {
      const current = tray;
      tray = null;
      current?.destroy();
    }),
  });
});

export const layer = Layer.effect(ElectronTray, make);
