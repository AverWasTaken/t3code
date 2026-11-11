import { MonitorIcon } from "lucide-react";

import {
  Menu,
  MenuCheckboxItem,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "../ui/menu";
import { resolveSidebarEnvironmentFilterMenu } from "./environmentVisibility";
import { SidebarHeaderIconButton } from "./SidebarThreadHeader";

export function SidebarEnvironmentFilter(props: {
  environments: ReadonlyArray<{ readonly environmentId: string; readonly label: string }>;
  hiddenEnvironmentIds: readonly string[];
  onToggleEnvironment: (environmentId: string) => void;
  onShowAll: () => void;
}) {
  const { items, hiddenCount, showButton } = resolveSidebarEnvironmentFilterMenu(
    props.environments,
    props.hiddenEnvironmentIds,
  );
  if (!showButton) return null;
  return (
    <Menu>
      <MenuTrigger
        render={
          <SidebarHeaderIconButton
            label={
              hiddenCount > 0
                ? `Filter threads by machine: ${hiddenCount} hidden`
                : "Filter threads by machine"
            }
          />
        }
      >
        <MonitorIcon className="size-4" />
        {hiddenCount > 0 ? (
          <span
            aria-hidden
            data-testid="sidebar-environment-filter-active"
            className="pointer-events-none absolute top-1 right-1 size-1.5 rounded-full bg-primary"
          />
        ) : null}
      </MenuTrigger>
      <MenuPopup align="end" side="bottom">
        <MenuGroup>
          <MenuGroupLabel>Machines</MenuGroupLabel>
          {items.map((item) => (
            <MenuCheckboxItem
              key={item.environmentId}
              checked={item.visible}
              disabled={item.disabled}
              onCheckedChange={() => props.onToggleEnvironment(item.environmentId)}
            >
              {item.label}
            </MenuCheckboxItem>
          ))}
        </MenuGroup>
        <MenuSeparator />
        <MenuItem disabled={hiddenCount === 0} onClick={props.onShowAll}>
          Show all machines
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}
