import type { EntityId } from "../components/DungeonData";
import type { CardinalDirection } from "../components/mapComponents/DungeonRoom";
import type { BuildableRoomType } from "../construction/DungeonConstruction";
import type { ResourceSnapshot } from "../resources/ResourceManager";
import type {
    DenizenRosterSnapshot,
    ResourceSlotType,
} from "../rooms/RoomPopulationManager";
import type {
    DungeonConstructionSnapshot,
    RoomDetails,
} from "../scenes/DungeonScene";
import { CoreRelocationSection } from "./room-details/CoreRelocationSection";
import { RoomCapacitySection } from "./room-details/RoomCapacitySection";
import { RoomConnectionsSection } from "./room-details/RoomConnectionsSection";
import { RoomConstructionSection } from "./room-details/RoomConstructionSection";
import { RoomDenizensSection } from "./room-details/RoomDenizensSection";
import { RoomDetailsHeader } from "./room-details/RoomDetailsHeader";

interface RoomDetailsPanelProps {
    details: RoomDetails;
    roster: DenizenRosterSnapshot;
    resources: ResourceSnapshot["resources"];
    assignmentLocked: boolean;
    construction: DungeonConstructionSnapshot | null;
    onUpgrade: (slot: ResourceSlotType | "defender") => void;
    onAssign: (denizenId: EntityId) => boolean;
    onUnassign: (denizenId: EntityId) => boolean;
    onBuildRoom: (
        roomType: BuildableRoomType,
        direction: CardinalDirection,
    ) => boolean;
    onAddConnection: (roomId: EntityId) => boolean;
    onRemoveConnection: (connectionId: EntityId) => boolean;
    onMoveCore: () => boolean;
    onClose: () => void;
}

export function RoomDetailsPanel({
    details,
    roster,
    resources,
    assignmentLocked,
    construction,
    onUpgrade,
    onAssign,
    onUnassign,
    onBuildRoom,
    onAddConnection,
    onRemoveConnection,
    onMoveCore,
    onClose,
}: RoomDetailsPanelProps) {
    const { room, population } = details;

    return (
        <section>
            <RoomDetailsHeader room={room} onClose={onClose} />

            {population ? (
                <>
                    <RoomDenizensSection
                        population={population}
                        roster={roster}
                        resources={resources}
                        assignmentLocked={assignmentLocked}
                        onAssign={onAssign}
                        onUnassign={onUnassign}
                    />

                    <RoomCapacitySection
                        population={population}
                        resources={resources}
                        assignmentLocked={assignmentLocked}
                        onUpgrade={onUpgrade}
                    />
                </>
            ) : (
                <p className="mt-4.5 rounded-[10px] border border-white/7 bg-white/3 p-3 text-xs leading-normal text-[#968d9b]">
                    This room does not support assigned denizens.
                </p>
            )}

            {construction && (
                <div className="mt-5 grid gap-4 border-y border-white/8 py-4">
                    <RoomConstructionSection
                        construction={construction}
                        resources={resources}
                        locked={assignmentLocked}
                        onBuildRoom={onBuildRoom}
                    />

                    <RoomConnectionsSection
                        construction={construction}
                        locked={assignmentLocked}
                        onAddConnection={onAddConnection}
                        onRemoveConnection={onRemoveConnection}
                    />

                    <CoreRelocationSection
                        construction={construction}
                        onMoveCore={onMoveCore}
                    />
                </div>
            )}
        </section>
    );
}
