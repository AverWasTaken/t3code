import { useState } from "react";
import { expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser";

import { render } from "../../../test/render";
import { SidebarProvider } from "../ui/sidebar";
import { SidebarEnvironmentFilter } from "./SidebarEnvironmentFilter";

const ENVIRONMENTS = [
  { environmentId: "pc", label: "Windows PC" },
  { environmentId: "hp", label: "hp" },
  { environmentId: "think", label: "think" },
];

function Harness() {
  const [hidden, setHidden] = useState<readonly string[]>([]);
  return (
    <SidebarProvider defaultOpen>
      <SidebarEnvironmentFilter
        environments={ENVIRONMENTS}
        hiddenEnvironmentIds={hidden}
        onToggleEnvironment={(id) =>
          setHidden((current) =>
            current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
          )
        }
        onShowAll={() => setHidden([])}
      />
    </SidebarProvider>
  );
}

it("hides machines from an open menu, keeps the last one, and shows them all again", async () => {
  await using screen = await render(<Harness />);
  await screen.getByRole("button", { name: "Filter threads by machine" }).click();

  const hp = page.getByRole("menuitemcheckbox", { name: "hp" });
  const think = page.getByRole("menuitemcheckbox", { name: "think" });
  const pc = page.getByRole("menuitemcheckbox", { name: "Windows PC" });
  const showAll = page.getByRole("menuitem", { name: "Show all machines" });
  await expect.element(showAll).toHaveAttribute("aria-disabled", "true");

  await hp.click();
  await expect.element(hp).toHaveAttribute("aria-checked", "false");
  await think.click();
  await expect.element(think).toHaveAttribute("aria-checked", "false");
  await expect.element(pc).toHaveAttribute("aria-disabled", "true");
  await expect
    .element(screen.getByRole("button", { name: "Filter threads by machine: 2 hidden" }))
    .toBeInTheDocument();

  await showAll.click();
  await expect
    .element(screen.getByRole("button", { name: "Filter threads by machine" }))
    .toBeInTheDocument();
});
