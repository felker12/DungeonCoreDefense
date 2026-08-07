import {
    getRoomTypeLabel,
    type DungeonRoom,
} from "../../components/mapComponents/DungeonRoom";

interface RoomDetailsHeaderProps {
    room: DungeonRoom;
    onClose: () => void;
}

export function RoomDetailsHeader({
    room,
    onClose,
}: RoomDetailsHeaderProps) {
    return (
        <div className="flex items-start justify-between gap-3">
            <div>
                <p className="m-0 text-[11px] font-extrabold tracking-[.18em] text-[#d9b766] uppercase">
                    Selected room
                </p>
                <h2 className="mt-2 mb-0 font-serif text-[25px] text-[#f4eee4]">
                    {getRoomTypeLabel(room.type)}
                </h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded border border-white/8 bg-white/4 px-2 py-1 text-[9px] text-[#a99eac]">
                        Level {room.level}
                    </span>
                    <span className="rounded border border-white/8 bg-white/4 px-2 py-1 text-[9px] text-[#a99eac]">
                        {room.deadEnd
                            ? "Dead end"
                            : room.terminal
                              ? "Final room"
                              : "Connected room"}
                    </span>
                </div>
            </div>

            <button
                type="button"
                onClick={onClose}
                className="grid size-7.5 cursor-pointer place-items-center rounded-lg border-0 bg-transparent p-0 text-[19px] text-[#7f7583] hover:bg-white/6 hover:text-white"
                aria-label="Close room details"
            >
                ×
            </button>
        </div>
    );
}
