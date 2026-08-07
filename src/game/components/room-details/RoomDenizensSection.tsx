import type { EntityId } from "../../components/DungeonData";
import {
    DenizenRole,
    type DenizenData,
} from "../../components/entityComponents/entityData";
import {
    getDenizenAssignmentCost,
    getResourceLabel,
} from "../../denizens/DenizenAssignment";
import type { ResourceSnapshot } from "../../resources/ResourceManager";
import type {
    DenizenRosterSnapshot,
    RoomPopulationSnapshot,
} from "../../rooms/RoomPopulationManager";

interface RoomDenizensSectionProps {
    population: RoomPopulationSnapshot;
    roster: DenizenRosterSnapshot;
    resources: ResourceSnapshot["resources"];
    assignmentLocked: boolean;
    onAssign: (denizenId: EntityId) => boolean;
    onUnassign: (denizenId: EntityId) => boolean;
}

export function RoomDenizensSection({
    population,
    roster,
    resources,
    assignmentLocked,
    onAssign,
    onUnassign,
}: RoomDenizensSectionProps) {
    const { capacity } = population;

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

    const defenderSlotsOpen =
        population.assignedDefenders < capacity.defenders;
    const producerSlotsOpen =
        capacity.kind === "resource" &&
        population.assignedGatherers < capacity.gatherers;

    return (
        <div className="mt-4.5">
            <h3 className="mb-2 flex items-center gap-2 text-[11px] tracking-[.06em] text-[#d8cfdc] uppercase">
                <span className="text-[#bd9350]">♟</span> Denizens
            </h3>

            {population.denizens.length === 0 ? (
                <p className="m-0 rounded-[10px] border border-white/7 bg-white/3 p-3 text-center text-xs text-[#968d9b]">
                    No denizens assigned.
                </p>
            ) : (
                <div className="grid gap-2">
                    {population.denizens.map((denizen) => (
                        <DenizenCard
                            key={denizen.id}
                            denizen={denizen}
                            assignmentLocked={assignmentLocked}
                            onUnassign={onUnassign}
                        />
                    ))}
                </div>
            )}

            <div className="mt-4 grid gap-4 border-t border-white/8 pt-4">
                {assignmentLocked && (
                    <span className="text-right text-[9px] font-bold text-[#c47d76]">
                        Assignment locked during raids
                    </span>
                )}

                {capacity.kind === "resource" && (
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
        </div>
    );
}

function DenizenCard({
    denizen,
    assignmentLocked,
    onUnassign,
}: {
    denizen: DenizenData;
    assignmentLocked: boolean;
    onUnassign: (denizenId: EntityId) => boolean;
}) {
    return (
        <div className="rounded-lg border border-white/8 bg-white/3 px-3 py-2.5 text-left text-[11px] text-[#d8d0da]">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <strong className="block capitalize">
                        {denizen.type} · {denizen.role}
                    </strong>
                    <p className="mt-1 mb-0 text-[9px] text-[#8f8597]">
                        HP {Math.ceil(denizen.health)} / {denizen.maxHealth} · ATK{" "}
                        {denizen.attack} · DEF {denizen.defense}
                    </p>
                </div>
                <span className="flex shrink-0 items-center gap-2">
                    <small
                        className={`text-[9px] ${
                            denizen.health <= 0
                                ? "text-[#d47c76]"
                                : "text-[#796f7e]"
                        }`}
                    >
                        {denizen.status}
                    </small>
                    <button
                        type="button"
                        disabled={assignmentLocked}
                        onClick={() => onUnassign(denizen.id)}
                        className="cursor-pointer rounded-md border border-white/10 bg-white/4 px-2 py-1 text-[8px] font-extrabold tracking-[.06em] text-[#aaa0ae] uppercase transition hover:border-[#bd615b]/30 hover:bg-[#bd615b]/10 hover:text-[#d98a84] disabled:cursor-not-allowed disabled:opacity-35"
                    >
                        Remove
                    </button>
                </span>
            </div>

            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/35">
                <div
                    className={`h-full rounded-full transition-[width] duration-200 ${
                        denizen.health <= 0
                            ? "bg-[#8a4650]"
                            : denizen.health / denizen.maxHealth <= 0.35
                              ? "bg-[#d46550]"
                              : "bg-linear-to-r from-[#7d4ca6] to-[#b47ad5]"
                    }`}
                    style={{
                        width: `${Math.max(
                            0,
                            Math.min(
                                100,
                                (denizen.health / denizen.maxHealth) * 100,
                            ),
                        )}%`,
                    }}
                />
            </div>

            {denizen.recoveryRemainingMs > 0 && (
                <p className="mt-1.5 mb-0 text-[8px] font-bold text-[#c47d76] uppercase">
                    Respawn in {Math.ceil(denizen.recoveryRemainingMs / 1000)}s
                </p>
            )}
        </div>
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
