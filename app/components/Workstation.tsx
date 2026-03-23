import { Tabs, ActionIcon, Tooltip } from "@mantine/core";
import type { NavNode, BetSummary } from "~/types/navigation";
import type { DeliveryEpic, SelectedItem } from "~/hooks/useDelivery";
import { DiscoveryView } from "./DiscoveryView";
import { Delivery } from "./Delivery";

interface WorkstationProps {
  selectedNode: NavNode | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSelectItem: (item: SelectedItem | null) => void;
  selectedItemKey: string | null;
  onOpenSettings: () => void;
  deliveryEpics: DeliveryEpic[];
  deliveryLoading: boolean;
  bets: BetSummary[];
}

export function Workstation({
  selectedNode,
  activeTab,
  onTabChange,
  onSelectItem,
  selectedItemKey,
  onOpenSettings,
  deliveryEpics,
  deliveryLoading,
  bets,
}: WorkstationProps) {
  // Filter delivery epics based on selected node
  const filterByIdeaKeys = getIdeaFilterKeys(selectedNode, deliveryEpics, bets);

  return (
    <Tabs
      value={activeTab}
      onChange={(v) => onTabChange(v ?? "discovery")}
      variant="outline"
      className="flex flex-1 flex-col overflow-hidden"
      styles={{
        root: { display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" },
        panel: { flex: 1, overflow: "hidden" },
        list: {
          borderBottom: "1px solid var(--mantine-color-dark-4)",
          backgroundColor: "var(--mantine-color-dark-8)",
        },
      }}
    >
      <Tabs.List px="sm" pt={4} className="flex items-center">
        <Tabs.Tab value="discovery">Discovery</Tabs.Tab>
        <Tabs.Tab value="delivery">Delivery</Tabs.Tab>
        <div className="ml-auto pr-1">
          <Tooltip label="Settings">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={onOpenSettings}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </ActionIcon>
          </Tooltip>
        </div>
      </Tabs.List>
      <Tabs.Panel value="discovery">
        <DiscoveryView selectedNode={selectedNode} />
      </Tabs.Panel>
      <Tabs.Panel value="delivery">
        <Delivery
          onSelectItem={onSelectItem}
          selectedItemKey={selectedItemKey}
          filterByIdeaKeys={filterByIdeaKeys}
        />
      </Tabs.Panel>
    </Tabs>
  );
}

/**
 * Determine which idea keys to filter delivery by, based on the selected nav node.
 * Returns undefined = show all, string[] = show only matching (empty = show none).
 */
function getIdeaFilterKeys(
  node: NavNode | null,
  deliveryEpics: DeliveryEpic[],
  bets: BetSummary[]
): string[] | undefined {
  if (!node) return [];

  switch (node.type) {
    case "jira-idea":
      return [node.key];
    case "jira-epic": {
      const epic = deliveryEpics.find((e) => e.key === node.key);
      return epic?.idea ? [epic.idea.key] : [node.key];
    }
    case "jira-story": {
      const parentEpic = deliveryEpics.find((e) =>
        e.children.some((c) => c.key === node.key || c.children?.some((s) => s.key === node.key))
      );
      return parentEpic?.idea ? [parentEpic.idea.key] : [];
    }
    case "bet": {
      // Use the bet's linked idea keys to scope delivery
      const bet = bets.find((b) => b.slug === node.slug);
      return bet?.ideaKeys.length ? bet.ideaKeys : [];
    }
    case "bet-file": {
      const bet = bets.find((b) => b.slug === node.slug);
      return bet?.ideaKeys.length ? bet.ideaKeys : [];
    }
    default:
      return [];
  }
}
