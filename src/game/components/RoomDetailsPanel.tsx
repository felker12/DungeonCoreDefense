import type { ReactNode } from "react";
import type { EntityId } from "../components/DungeonData";
import { DenizenRole } from "../components/entityComponents/entityData";
import type { DenizenData } from "../components/entityComponents/entityData";
import { getRoomTypeLabel } from "../components/mapComponents/DungeonRoom";
import {
    getDenizenAssignmentCost,
    getResourceLabel,
} from "../denizens/DenizenAssignment";
import type { ResourceSnapshot } from "../resources/ResourceManager";
import type {
    DenizenRosterSnapshot,
    ResourceSlotType,
} from "../rooms/RoomPopulationManager";
import type { RoomDetails } from "../scenes/DungeonScene";

interface RoomDetailsPanelProps {
    details: RoomDetails;
    roster: DenizenRosterSnapshot;
    resources: ResourceSnapshot["resources"];
    assignmentLocked: boolean;
    onUpgrade: (slot: ResourceSlotType | "defender") => void;
    onAssign: (denizenId: EntityId) => boolean;
    onUnassign: (denizenId: EntityId) => boolean;
    onClose: () => void;
}

export function RoomDetailsPanel({
    details,
    roster,
    resources,
    assignmentLocked,
    onUpgrade,
    onAssign,
    onUnassign,
    onClose,
}: RoomDetailsPanelProps) {
    const { room, population } = details;
    const capacity = population?.capacity;
    const unassignedDefenders = roster.denizens.filter(
        (denizen) =>
            denizen.role === DenizenRole.DEFENDER &&
            denizen.assignedRoomId === null,
    );
    const unassignedProducers = roster.denizens.filter(
        (denizen) =>
            denizen.role === DenizenRole.GATHERER &&
            denizen.assignedRoomId === null,
    );
    const defenderSlotsOpen = Boolean(
        population &&
        capacity &&
        population.assignedDefenders < capacity.defenders,
    );
    const producerSlotsOpen = Boolean(
        population &&
        capacity?.kind === "resource" &&
        population.assignedGatherers < capacity.gatherers,
    );

    return (
        <section>
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

            {!population ? (
                <p className="mt-4.5 rounded-[10px] border border-white/7 bg-white/3 p-3 text-xs leading-normal text-[#968d9b]">
                    This room does not support assigned denizens.
                </p>
            ) : (
                <>
                    <div className="mt-4.5 grid overflow-hidden rounded-xl border border-white/8 bg-white/3">
                        {capacity?.kind === "resource" && (
                            <Stat
                                label="Production"
                                value={`${population.productionPerSecond.toFixed(1)}/sec`}
                            />
                        )}
                        {capacity?.kind === "resource" && (
                            <Stat
                                label="Gatherers"
                                value={`${population.assignedGatherers}/${capacity.gatherers} · max ${capacity.maxGatherers}`}
                            />
                        )}
                        <Stat
                            label="Defenders"
                            value={`${population.assignedDefenders}/${capacity?.defenders} · max ${capacity?.maxDefenders}`}
                        />
                        {population.recoveringGatherers > 0 && (
                            <Stat
                                label="Recovering"
                                value={`${population.recoveringGatherers} gatherers`}
                                warning
                            />
                        )}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        {capacity?.kind === "resource" && (
                            <UpgradeButton
                                disabled={
                                    capacity.gatherers >= capacity.maxGatherers
                                }
                                onClick={() => onUpgrade("gatherer")}
                            >
                                + Gatherer slot
                            </UpgradeButton>
                        )}
                        <UpgradeButton
                            disabled={
                                !capacity ||
                                capacity.defenders >= capacity.maxDefenders
                            }
                            onClick={() => onUpgrade("defender")}
                        >
                            + Defender slot
                        </UpgradeButton>
                    </div>
                    <h3 className="mt-5.5 mb-2 flex items-center gap-2 text-[11px] tracking-[.06em] text-[#d8cfdc] uppercase">
                        <span className="text-[#bd9350]">♟</span> Denizens
                    </h3>
                    {population.denizens.length === 0 ? (
                        <p className="m-0 rounded-[10px] border border-white/7 bg-white/3 p-3 text-center text-xs text-[#968d9b]">
                            No denizens assigned.
                        </p>
                    ) : (
                        <div className="grid gap-2">
                            {population.denizens.map((denizen) => (
                                <div
                                    key={denizen.id}
                                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/3 px-3 py-2.5 text-left text-[11px] text-[#d8d0da]"
                                >
                                    <span>
                                        {denizen.type} · {denizen.role}
                                    </span>
                                    <span className="flex items-center gap-2">
                                        <small className="text-[9px] text-[#796f7e]">
                                            {denizen.status}
                                        </small>
                                        <button
                                            type="button"
                                            disabled={assignmentLocked}
                                            onClick={() =>
                                                onUnassign(denizen.id)
                                            }
                                            className="cursor-pointer rounded-md border border-white/10 bg-white/4 px-2 py-1 text-[8px] font-extrabold tracking-[.06em] text-[#aaa0ae] uppercase transition hover:border-[#bd615b]/30 hover:bg-[#bd615b]/10 hover:text-[#d98a84] disabled:cursor-not-allowed disabled:opacity-35"
                                        >
                                            Remove
                                        </button>
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="mt-4 grid gap-4 border-t border-white/8 pt-4">
                        {assignmentLocked && (
                            <span className="text-right text-[9px] font-bold text-[#c47d76]">
                                Assignment locked during raids
                            </span>
                        )}

                        {capacity?.kind === "resource" && (
                            <AssignmentGroup
                                title="Add a producer"
                                emptyMessage="No unassigned producers. Recruit one from the Denizens tab first."
                                fullMessage="All producer slots in this room are filled."
                                denizens={unassignedProducers}
                                slotsOpen={producerSlotsOpen}
                                resources={resources}
                                assignmentLocked={assignmentLocked}
                                role={DenizenRole.GATHERER}
                                onAssign={onAssign}
                            />
                        )}

                        <AssignmentGroup
                            title="Add a defender"
                            emptyMessage="No unassigned defenders. Recruit one from the Denizens tab first."
                            fullMessage="All defender slots in this room are filled."
                            denizens={unassignedDefenders}
                            slotsOpen={defenderSlotsOpen}
                            resources={resources}
                            assignmentLocked={assignmentLocked}
                            role={DenizenRole.DEFENDER}
                            onAssign={onAssign}
                        />
                    </div>
                </>
            )}
        </section>
    );
}

function AssignmentGroup({
    title,
    emptyMessage,
    fullMessage,
    denizens,
    slotsOpen,
    resources,
    assignmentLocked,
    role,
    onAssign,
}: {
    title: string;
    emptyMessage: string;
    fullMessage: string;
    denizens: readonly DenizenData[];
    slotsOpen: boolean;
    resources: ResourceSnapshot["resources"];
    assignmentLocked: boolean;
    role: DenizenRole;
    onAssign: (denizenId: EntityId) => boolean;
}) {
    const cost = getDenizenAssignmentCost(role);
    const canAfford = resources[cost.resource].value >= cost.amount;

    return (
        <div>
            <div className="mb-2.5 flex items-center justify-between gap-3">
                <h3 className="m-0 text-[9px] font-extrabold tracking-[.14em] text-[#8f8592] uppercase">
                    {title}
                </h3>
                <span
                    className={`text-[9px] font-bold ${canAfford ? "text-[#d9b766]" : "text-[#c47d76]"}`}
                >
                    {cost.amount} {getResourceLabel(cost.resource)}
                </span>
            </div>

            {!slotsOpen ? (
                <p className="m-0 rounded-[10px] border border-white/7 bg-white/3 p-3 text-center text-[10px] text-[#8f8597]">
                    {fullMessage}
                </p>
            ) : denizens.length === 0 ? (
                <p className="m-0 rounded-[10px] border border-white/7 bg-white/3 p-3 text-center text-[10px] leading-relaxed text-[#8f8597]">
                    {emptyMessage}
                </p>
            ) : (
                <div className="grid gap-2">
                    {denizens.map((denizen) => (
                        <div
                            key={denizen.id}
                            className="flex items-center justify-between gap-3 rounded-lg border border-[#a979c6]/16 bg-[#a979c6]/6 px-3 py-2.5"
                        >
                            <div className="min-w-0">
                                <strong className="block truncate text-[11px] text-[#ddd3df] capitalize">
                                    {denizen.type}
                                </strong>
                                <span className="text-[9px] text-[#8f8597]">
                                    {role === DenizenRole.GATHERER
                                        ? `Production +${denizen.gatheringPower.toFixed(1)}/sec`
                                        : `HP ${denizen.health} · ATK ${denizen.attack} · DEF ${denizen.defense}`}
                                </span>
                            </div>
                            <button
                                type="button"
                                disabled={assignmentLocked || !canAfford}
                                onClick={() => onAssign(denizen.id)}
                                className="shrink-0 cursor-pointer rounded-lg border border-[#a979c6]/30 bg-[#a979c6]/10 px-3 py-2 text-[9px] font-extrabold text-[#cda8df] uppercase transition hover:border-[#c99be1]/45 hover:bg-[#a979c6]/18 disabled:cursor-not-allowed disabled:opacity-35"
                            >
                                {!canAfford
                                    ? "Need resources"
                                    : `Add · ${cost.amount}`}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function Stat({
    label,
    value,
    warning = false,
}: {
    label: string;
    value: string;
    warning?: boolean;
}) {
    return (
        <div className="flex justify-between gap-3.5 border-b border-white/6 px-3 py-2.5 text-[11px] last:border-b-0">
            <span className="text-[#908794]">{label}</span>
            <strong className={warning ? "text-[#f0a65e]" : "text-[#eee7dc]"}>
                {value}
            </strong>
        </div>
    );
}

function UpgradeButton({
    disabled,
    onClick,
    children,
}: {
    disabled: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className="cursor-pointer rounded-lg border border-[#b076d7]/25 bg-[#8f52b5]/10 px-2 py-2 text-[10px] font-bold text-[#d6b7ed] hover:border-[#d097ee]/40 hover:bg-[#8f52b5]/20 disabled:cursor-not-allowed disabled:opacity-35"
        >
            {children}
        </button>
    );
}
