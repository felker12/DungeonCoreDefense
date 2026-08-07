import type { EntityId } from "../../components/DungeonData";
import type { DungeonConstructionSnapshot } from "../../scenes/DungeonScene";

interface RoomConnectionsSectionProps {
    construction: DungeonConstructionSnapshot;
    locked: boolean;
    onAddConnection: (roomId: EntityId) => boolean;
    onRemoveConnection: (connectionId: EntityId) => boolean;
}

export function RoomConnectionsSection({
    construction,
    locked,
    onAddConnection,
    onRemoveConnection,
}: RoomConnectionsSectionProps) {
    return (
        <div>
            <h3 className="m-0 text-[9px] font-extrabold tracking-[.14em] text-[#8f8592] uppercase">
                Connections
            </h3>

            <div className="mt-2 grid gap-2">
                {construction.connections.map((connection) => (
                    <div
                        key={connection.connectionId}
                        className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/3 px-3 py-2"
                    >
                        <span className="min-w-0 truncate text-[10px] text-[#bdb2c0]">
                            <b className="mr-1 text-[#d9b766] uppercase">
                                {connection.direction.slice(0, 1)}
                            </b>
                            {connection.roomName}
                        </span>
                        <button
                            type="button"
                            disabled={locked || !connection.removable}
                            title={
                                connection.removalReason ??
                                "Remove this corridor."
                            }
                            onClick={() =>
                                onRemoveConnection(connection.connectionId)
                            }
                            className="shrink-0 cursor-pointer rounded-md border border-[#bd615b]/25 bg-[#bd615b]/8 px-2 py-1 text-[8px] font-bold text-[#d98a84] hover:bg-[#bd615b]/15 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                            Remove
                        </button>
                    </div>
                ))}

                {construction.adjacentRooms.map((room) => (
                    <div
                        key={room.roomId}
                        className="flex items-center justify-between gap-3 rounded-lg border border-[#78a7c9]/18 bg-[#78a7c9]/6 px-3 py-2"
                    >
                        <span className="min-w-0 truncate text-[10px] text-[#b9cddd]">
                            Adjacent {room.direction}: {room.roomName}
                        </span>
                        <button
                            type="button"
                            disabled={locked || construction.locked}
                            onClick={() => onAddConnection(room.roomId)}
                            className="shrink-0 cursor-pointer rounded-md border border-[#78a7c9]/30 bg-[#78a7c9]/10 px-2 py-1 text-[8px] font-bold text-[#acd3ea] hover:bg-[#78a7c9]/18 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                            Connect
                        </button>
                    </div>
                ))}
            </div>

            <p className="mt-2 mb-0 text-[9px] leading-relaxed text-[#756d79]">
                A corridor cannot be removed if any room would become
                unreachable from the Entrance.
            </p>
        </div>
    );
}
