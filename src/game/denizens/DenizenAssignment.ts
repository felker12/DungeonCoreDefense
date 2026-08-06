import { DenizenRole } from "../components/entityComponents/entityData";
import type { DungeonResourceId } from "../resources/ResourceManager";

export interface DenizenAssignmentCost {
    resource: DungeonResourceId;
    amount: number;
}

export const DENIZEN_ASSIGNMENT_COSTS: Readonly<
    Record<DenizenRole, DenizenAssignmentCost>
> = {
    [DenizenRole.DEFENDER]: { resource: "supplies", amount: 5 },
    [DenizenRole.GATHERER]: { resource: "stone", amount: 10 },
};

export function getDenizenAssignmentCost(
    role: DenizenRole,
): DenizenAssignmentCost {
    return DENIZEN_ASSIGNMENT_COSTS[role];
}

export function getResourceLabel(resource: DungeonResourceId): string {
    return resource.charAt(0).toUpperCase() + resource.slice(1);
}
