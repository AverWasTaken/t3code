import { useGT } from "gt-react";
import type { DesktopBridge, DesktopWindowCloseAction } from "@t3tools/contracts";
import { useEffect, useState } from "react";

import { isWindowsPlatform } from "../../lib/utils";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { SettingResetButton, SettingsRow } from "./settingsLayout";
import { useSearchableSetting } from "./settingsSearch";

function WindowCloseActionRow({ bridge }: { readonly bridge: DesktopBridge }) {
  const gt = useGT();
  const searchableSetting = useSearchableSetting();
  const labels: Record<DesktopWindowCloseAction, string> = {
    ask: gt("Ask every time"),
    quit: gt("Quit"),
    tray: gt("Minimize to tray"),
  };
  const [action, setAction] = useState(() => bridge.getWindowCloseAction());

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- "Remember my choice" writes this in the main process while the row can stay mounted behind the hidden window.
  useEffect(() => {
    const syncFromMain = () => setAction(bridge.getWindowCloseAction());
    window.addEventListener("focus", syncFromMain);
    return () => window.removeEventListener("focus", syncFromMain);
  }, [bridge]);

  const changeAction = (next: DesktopWindowCloseAction) => {
    setAction(next);
    void bridge.setWindowCloseAction(next).catch(() => setAction(bridge.getWindowCloseAction()));
  };

  return (
    <SettingsRow
      {...searchableSetting("window-close-action")}
      description={gt("What happens when you close the window with the X button.")}
      resetAction={
        action !== "ask" ? (
          <SettingResetButton
            ariaLabel={gt("Reset close button behavior to default")}
            onClick={() => changeAction("ask")}
          />
        ) : null
      }
      control={
        <Select
          value={action}
          onValueChange={(value) => {
            if (value === "ask" || value === "quit" || value === "tray") changeAction(value);
          }}
        >
          <SelectTrigger
            size="sm"
            className="w-full sm:w-40"
            aria-label={gt("Close button behavior")}
          >
            <SelectValue>{labels[action]}</SelectValue>
          </SelectTrigger>
          <SelectPopup align="end" alignItemWithTrigger={false}>
            {Object.entries(labels).map(([value, label]) => (
              <SelectItem hideIndicator key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      }
    />
  );
}

export function WindowCloseActionSetting() {
  const bridge = window.desktopBridge;
  if (!bridge?.setWindowCloseAction || !isWindowsPlatform(navigator.platform)) return null;
  return <WindowCloseActionRow bridge={bridge} />;
}
