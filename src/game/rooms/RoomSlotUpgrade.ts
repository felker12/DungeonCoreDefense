import type { ResourceCost } from "../resources/ResourceManager";
import type { ResourceSlotType } from "./RoomPopulationManager";

export type RoomSlotUpgradeType = ResourceSlotType;

const ROOM_SLOT_UPGRADE_COSTS: Record<
    RoomSlotUpgradeType,
    ResourceCost
> = {
    gatherer: { resource: "stone", amount: 25 },
    defender: { resource: "stone", amount: 20 },
};

export function getRoomSlotUpgradeCost(
    slot: RoomSlotUpgradeType,
): ResourceCost {
    return { ...ROOM_SLOT_UPGRADE_COSTS[slot] };
}
