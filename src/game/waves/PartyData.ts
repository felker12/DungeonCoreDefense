import type { EntityId } from "../components/DungeonData";
import type { AdventurerData } from "../components/entityComponents/entityData";

export interface AdventurerParty {
    id: EntityId;
    waveNumber: number;
    members: AdventurerData[];
    route: EntityId[];
}
