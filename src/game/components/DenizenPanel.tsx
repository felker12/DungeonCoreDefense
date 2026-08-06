import { useState } from "react";
import type { EntityId } from "./DungeonData";
import type { DenizenType } from "./entityComponents/entityData";
import type { DenizenRosterSnapshot } from "../rooms/RoomPopulationManager";
import type { DefenderRoomOption } from "../scenes/DungeonScene";
import {
    DEFENDER_OFFERS,
    type DefenderOffer,
} from "../denizens/DenizenRecruitment";

interface DenizenPanelProps {
    roster: DenizenRosterSnapshot;
    rooms: readonly DefenderRoomOption[];
    supplies: number;
    assignmentLocked: boolean;
    onRecruit: (type: DenizenType) => boolean;
    onAssign: (denizenId: EntityId, roomId: EntityId) => boolean;
    onUnassign: (denizenId: EntityId) => boolean;
}

const formatNumber = new Intl.NumberFormat("en-US");

export function DenizenPanel({
    roster,
    rooms,
    supplies,
    assignmentLocked,
    onRecruit,
    onAssign,
    onUnassign,
}: DenizenPanelProps) {
    const [selectedRooms, setSelectedRooms] = useState<
        Record<EntityId, EntityId>
    >({});
    const full = roster.denizens.length >= roster.capacity;

    return (
        <section aria-labelledby="denizen-roster-title">
            <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                    <p className="m-0 text-[9px] font-extrabold tracking-[.18em] text-[#d9b766] uppercase">
                        Permanent roster
                    </p>
                    <h2
                        id="denizen-roster-title"
                        className="mt-1.5 mb-0 font-serif text-[24px] text-[#f5efe4]"
                    >
                        Recruit defenders
                    </h2>
                </div>
                <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${full ? "border-[#bd615b]/35 bg-[#bd615b]/10 text-[#db8982]" : "border-[#d8aa4f]/30 bg-[#d8aa4f]/8 text-[#e7cb89]"}`}
                >
                    {roster.denizens.length} / {roster.capacity}
                </span>
            </div>

            <div className="mb-4 flex items-center justify-between rounded-xl border border-white/8 bg-white/3 px-3.5 py-3">
                <span className="text-[10px] font-bold tracking-[.08em] text-[#958b99] uppercase">
                    Available supplies
                </span>
                <strong className="text-sm text-[#e6be67]">
                    ● {formatNumber.format(supplies)}
                </strong>
            </div>

            <div className="grid gap-3">
                {DEFENDER_OFFERS.map((offer) => (
                    <RecruitCard
                        key={offer.type}
                        offer={offer}
                        disabled={full || supplies < offer.cost}
                        reason={
                            full
                                ? "Roster full"
                                : supplies < offer.cost
                                  ? "Need more supplies"
                                  : null
                        }
                        onRecruit={() => onRecruit(offer.type)}
                    />
                ))}
            </div>

            {roster.denizens.length > 0 && (
                <div className="mt-5 border-t border-white/8 pt-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="m-0 text-[9px] font-extrabold tracking-[.14em] text-[#8f8592] uppercase">
                            Owned defenders
                        </h3>
                        {assignmentLocked && (
                            <span className="text-[9px] font-bold text-[#c47d76]">
                                Locked during raids
                            </span>
                        )}
                    </div>

                    <div className="grid gap-2.5">
                        {roster.denizens.map((denizen) => {
                            const assignedRoom = rooms.find(
                                (room) => room.id === denizen.assignedRoomId,
                            );
                            const availableRooms = rooms.filter(
                                (room) => room.assigned < room.capacity,
                            );
                            const savedRoomId = selectedRooms[denizen.id];
                            const selectedRoomId = availableRooms.some(
                                (room) => room.id === savedRoomId,
                            )
                                ? savedRoomId
                                : (availableRooms[0]?.id ?? "");

                            return (
                                <article
                                    key={denizen.id}
                                    className="rounded-xl border border-white/8 bg-black/15 p-3"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <strong className="text-[11px] text-[#ddd3df] capitalize">
                                                {denizen.type}
                                            </strong>
                                            <p className="mt-1 mb-0 text-[9px] text-[#8f8597]">
                                                HP {denizen.health} · ATK{" "}
                                                {denizen.attack} · DEF{" "}
                                                {denizen.defense}
                                            </p>
                                        </div>
                                        <span
                                            className={`rounded-full px-2 py-1 text-[8px] font-bold uppercase ${assignedRoom ? "bg-[#6f9f73]/12 text-[#8fc394]" : "bg-[#d8aa4f]/10 text-[#dabb72]"}`}
                                        >
                                            {assignedRoom
                                                ? assignedRoom.name
                                                : "Unassigned"}
                                        </span>
                                    </div>

                                    {assignedRoom ? (
                                        <button
                                            type="button"
                                            disabled={assignmentLocked}
                                            onClick={() =>
                                                onUnassign(denizen.id)
                                            }
                                            className="mt-2.5 w-full cursor-pointer rounded-lg border border-white/10 bg-white/4 py-2 text-[9px] font-extrabold tracking-[.08em] text-[#bdb3c1] uppercase disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            Remove from room
                                        </button>
                                    ) : (
                                        <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                                            <select
                                                aria-label={`Room for ${denizen.type}`}
                                                value={selectedRoomId}
                                                disabled={
                                                    assignmentLocked ||
                                                    availableRooms.length === 0
                                                }
                                                onChange={(event) =>
                                                    setSelectedRooms(
                                                        (current) => ({
                                                            ...current,
                                                            [denizen.id]:
                                                                event.target
                                                                    .value,
                                                        }),
                                                    )
                                                }
                                                className="min-w-0 rounded-lg border border-white/10 bg-[#17121b] px-2.5 py-2 text-[9px] text-[#cfc5d2] disabled:opacity-40"
                                            >
                                                {availableRooms.length === 0 ? (
                                                    <option value="">
                                                        No open defender slots
                                                    </option>
                                                ) : (
                                                    availableRooms.map(
                                                        (room) => (
                                                            <option
                                                                key={room.id}
                                                                value={room.id}
                                                            >
                                                                {room.name} (
                                                                {room.assigned}/
                                                                {room.capacity})
                                                            </option>
                                                        ),
                                                    )
                                                )}
                                            </select>
                                            <button
                                                type="button"
                                                disabled={
                                                    assignmentLocked ||
                                                    !selectedRoomId
                                                }
                                                onClick={() =>
                                                    onAssign(
                                                        denizen.id,
                                                        selectedRoomId,
                                                    )
                                                }
                                                className="cursor-pointer rounded-lg border border-[#a979c6]/30 bg-[#a979c6]/10 px-3 text-[9px] font-extrabold text-[#cda8df] uppercase disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                Assign
                                            </button>
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                </div>
            )}
        </section>
    );
}

function RecruitCard({
    offer,
    disabled,
    reason,
    onRecruit,
}: {
    offer: DefenderOffer;
    disabled: boolean;
    reason: string | null;
    onRecruit: () => void;
}) {
    return (
        <article className="rounded-xl border border-white/8 bg-linear-to-br from-white/4 to-white/1 p-3.5">
            <div className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-[#a979c6]/25 bg-[#a979c6]/10 font-serif text-lg text-[#c79be1]">
                    {offer.mark}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <strong className="text-[13px] text-[#f0e9df]">
                            {offer.name}
                        </strong>
                        <span className="shrink-0 text-[11px] font-bold text-[#d9ad59]">
                            ● {offer.cost}
                        </span>
                    </div>
                    <p className="mt-1 mb-2 text-[10px] leading-relaxed text-[#8e8592]">
                        {offer.description}
                    </p>
                    <div className="flex gap-3 text-[9px] font-bold text-[#9d94a1]">
                        <span>HP {offer.health}</span>
                        <span>ATK {offer.attack}</span>
                        <span>DEF {offer.defense}</span>
                    </div>
                </div>
            </div>
            <button
                type="button"
                disabled={disabled}
                onClick={onRecruit}
                className="mt-3 w-full cursor-pointer rounded-lg border border-[#d8aa4f]/35 bg-[#d8aa4f]/10 py-2 text-[10px] font-extrabold tracking-[.08em] text-[#e7cb89] uppercase transition hover:bg-[#d8aa4f]/18 disabled:cursor-not-allowed disabled:border-white/7 disabled:bg-white/3 disabled:text-[#6f6874]"
            >
                {reason ?? "Recruit defender"}
            </button>
        </article>
    );
}

