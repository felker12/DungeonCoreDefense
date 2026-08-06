import type { EntityId } from "../components/DungeonData";
import type { AdventurerData } from "../components/entityComponents/entityData";
import type { DungeonRoom } from "../components/mapComponents/DungeonRoom";
import type { AdventurerParty } from "../waves/PartyData";

export type RoomCombatOutcome = "cleared" | "defeated";

export interface PartyCombatPresentation {
    getLivingMembers(): readonly AdventurerData[];
    setFighting(active: boolean): void;
    flashAdventurer(adventurerId: EntityId): void;
    defeatAdventurer(adventurerId: EntityId): void;
}

export type RoomEncounterResolver = (
    party: AdventurerParty,
    room: DungeonRoom,
    presentation: PartyCombatPresentation,
) => Promise<RoomCombatOutcome>;
