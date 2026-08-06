import type { EntityId } from "../components/DungeonData";
import { DenizenRole } from "../components/entityComponents/entityData";
import type { DenizenData } from "../components/entityComponents/entityData";
import {
    getRoomTypeLabel,
    type CardinalDirection,
} from "../components/mapComponents/DungeonRoom";
import type { BuildableRoomType } from "../construction/DungeonConstruction";
import {
    getDenizenAssignmentCost,
    getResourceLabel,
} from "../denizens/DenizenAssignment";
import type { ResourceSnapshot } from "../resources/ResourceManager";
import type {
    DenizenRosterSnapshot,
    ResourceSlotType,
} from "../rooms/RoomPopulationManager";
import { getRoomSlotUpgradeCost } from "../rooms/RoomSlotUpgrade";
import type {
    DungeonConstructionSnapshot,
    RoomDetails,
} from "../scenes/DungeonScene";

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
    const gathererUpgradeCost = getRoomSlotUpgradeCost("gatherer");
    const defenderUpgradeCost = getRoomSlotUpgradeCost("defender");
    const gathererSlotsMaxed = Boolean(
        capacity?.kind === "resource" &&
            capacity.gatherers >= capacity.maxGatherers,
    );
    const defenderSlotsMaxed = Boolean(
        !capacity || capacity.defenders >= capacity.maxDefenders,
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

            {construction && (
                <RoomConstructionPanel
                    construction={construction}
                    resources={resources}
                    locked={assignmentLocked}
                    onBuildRoom={onBuildRoom}
                    onAddConnection={onAddConnection}
                    onRemoveConnection={onRemoveConnection}
                    onMoveCore={onMoveCore}
                />
            )}

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
                                label="Gatherer slot"
                                cost={gathererUpgradeCost.amount}
                                resource={getResourceLabel(
                                    gathererUpgradeCost.resource,
                                )}
                                canAfford={
                                    resources[gathererUpgradeCost.resource]
                                        .value >= gathererUpgradeCost.amount
                                }
                                locked={assignmentLocked}
                                maxed={gathererSlotsMaxed}
                                disabled={
                                    assignmentLocked ||
                                    gathererSlotsMaxed ||
                                    resources[gathererUpgradeCost.resource]
                                        .value < gathererUpgradeCost.amount
                                }
                                onClick={() => onUpgrade("gatherer")}
                            />
                        )}
                        <UpgradeButton
                            label="Defender slot"
                            cost={defenderUpgradeCost.amount}
                            resource={getResourceLabel(
                                defenderUpgradeCost.resource,
                            )}
                            canAfford={
                                resources[defenderUpgradeCost.resource].value >=
                                defenderUpgradeCost.amount
                            }
                            locked={assignmentLocked}
                            maxed={defenderSlotsMaxed}
                            disabled={
                                assignmentLocked ||
                                defenderSlotsMaxed ||
                                resources[defenderUpgradeCost.resource].value <
                                    defenderUpgradeCost.amount
                            }
                            onClick={() => onUpgrade("defender")}
                        />
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
                                    className="rounded-lg border border-white/8 bg-white/3 px-3 py-2.5 text-left text-[11px] text-[#d8d0da]"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <strong className="block capitalize">
                                                {denizen.type} · {denizen.role}
                                            </strong>
                                            <p className="mt-1 mb-0 text-[9px] text-[#8f8597]">
                                                HP {Math.ceil(denizen.health)} / {denizen.maxHealth} · ATK {denizen.attack} · DEF {denizen.defense}
                                            </p>
                                        </div>
                                        <span className="flex shrink-0 items-center gap-2">
                                            <small className={`text-[9px] ${
                                                denizen.health <= 0
                                                    ? "text-[#d47c76]"
                                                    : "text-[#796f7e]"
                                            }`}>
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
                                                width: `${Math.max(0, Math.min(100, (denizen.health / denizen.maxHealth) * 100))}%`,
                                            }}
                                        />
                                    </div>
                                    {denizen.recoveryRemainingMs > 0 && (
                                        <p className="mt-1.5 mb-0 text-[8px] font-bold text-[#c47d76] uppercase">
                                            Respawn in {Math.ceil(denizen.recoveryRemainingMs / 1000)}s
                                        </p>
                                    )}
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

function RoomConstructionPanel({
    construction,
    resources,
    locked,
    onBuildRoom,
    onAddConnection,
    onRemoveConnection,
    onMoveCore,
}: {
    construction: DungeonConstructionSnapshot;
    resources: ResourceSnapshot["resources"];
    locked: boolean;
    onBuildRoom: (
        roomType: BuildableRoomType,
        direction: CardinalDirection,
    ) => boolean;
    onAddConnection: (roomId: EntityId) => boolean;
    onRemoveConnection: (connectionId: EntityId) => boolean;
    onMoveCore: () => boolean;
}) {
    return (
        <div className="mt-5 grid gap-4 border-y border-white/8 py-4">
            <div className="rounded-xl border border-[#a979c6]/20 bg-[#a979c6]/7 p-3">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h3 className="m-0 text-[10px] font-extrabold tracking-[.12em] text-[#d2afe1] uppercase">
                            Core relocation
                        </h3>
                        <p className="mt-1.5 mb-0 text-[9px] leading-relaxed text-[#97889e]">
                            Swap this room with the Dungeon Core while preserving
                            both locations, all corridors, and this room&apos;s upgrades.
                        </p>
                    </div>
                    <button
                        type="button"
                        disabled={!construction.coreRelocation.available}
                        title={
                            construction.coreRelocation.reason ??
                            "Move the Dungeon Core to this room."
                        }
                        onClick={onMoveCore}
                        className="shrink-0 cursor-pointer rounded-md border border-[#a979c6]/35 bg-[#a979c6]/12 px-2.5 py-1.5 text-[8px] font-extrabold text-[#d8b5e7] uppercase hover:bg-[#a979c6]/22 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                        Move Core Here
                    </button>
                </div>
                {construction.coreRelocation.reason && (
                    <p className="mt-2 mb-0 text-[9px] leading-relaxed text-[#776c7c]">
                        {construction.coreRelocation.reason}
                    </p>
                )}
            </div>

            <div>
                <div className="flex items-center justify-between gap-3">
                    <h3 className="m-0 text-[10px] font-extrabold tracking-[.12em] text-[#d8cfdc] uppercase">
                        Dungeon construction
                    </h3>
                    <span
                        className={`rounded border px-2 py-1 text-[9px] font-bold ${
                            construction.atOrAboveLimit
                                ? "border-[#bd615b]/25 bg-[#bd615b]/8 text-[#d98a84]"
                                : "border-[#d9b766]/20 bg-[#d9b766]/8 text-[#e4c87f]"
                        }`}
                    >
                        Rooms {construction.functionalRoomCount} / {construction.roomLimit}
                    </span>
                </div>

                {construction.atOrAboveLimit ? (
                    <p className="mt-2 mb-0 rounded-lg border border-[#bd615b]/18 bg-[#bd615b]/6 p-2.5 text-[10px] leading-relaxed text-[#c99490]">
                        This dungeon is at or above its Level room limit. Existing
                        custom rooms remain valid; raise the Dungeon Level before
                        constructing more.
                    </p>
                ) : (
                    <div className="mt-3 grid gap-3">
                        {construction.catalog.map((option) => {
                            const affordable = option.costs.every(
                                (cost) =>
                                    resources[cost.resource].value >= cost.amount,
                            );

                            return (
                                <div
                                    key={option.type}
                                    className="rounded-xl border border-white/8 bg-white/3 p-3"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <strong className="text-[11px] text-[#eee7dc]">
                                                {option.label}
                                            </strong>
                                            <p className="mt-1 mb-0 text-[9px] leading-relaxed text-[#8f8597]">
                                                {option.description}
                                            </p>
                                        </div>
                                        <span
                                            className={`shrink-0 text-right text-[9px] font-bold ${affordable ? "text-[#d9b766]" : "text-[#c47d76]"}`}
                                        >
                                            {option.costs
                                                .map(
                                                    (cost) =>
                                                        `${cost.amount} ${getResourceLabel(cost.resource)}`,
                                                )
                                                .join(" + ")}
                                        </span>
                                    </div>
                                    <div className="mt-3 grid grid-cols-4 gap-1.5">
                                        {option.directions.map((direction) => (
                                            <button
                                                key={direction.direction}
                                                type="button"
                                                disabled={
                                                    locked ||
                                                    !direction.available ||
                                                    !affordable
                                                }
                                                title={
                                                    !affordable
                                                        ? "Gather the required construction resources."
                                                        : direction.reason ??
                                                          `Build to the ${direction.direction}.`
                                                }
                                                onClick={() =>
                                                    onBuildRoom(
                                                        option.type,
                                                        direction.direction,
                                                    )
                                                }
                                                className="cursor-pointer rounded-md border border-[#a979c6]/25 bg-[#a979c6]/9 px-1 py-2 text-[8px] font-extrabold text-[#cda8df] uppercase hover:bg-[#a979c6]/18 disabled:cursor-not-allowed disabled:opacity-30"
                                            >
                                                {direction.direction.slice(0, 1).toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

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
                                {!canAfford ? "Need resources" : `Add · ${cost.amount}`}
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
    label,
    cost,
    resource,
    canAfford,
    locked,
    maxed,
    disabled,
    onClick,
}: {
    label: string;
    cost: number;
    resource: string;
    canAfford: boolean;
    locked: boolean;
    maxed: boolean;
    disabled: boolean;
    onClick: () => void;
}) {
    const text = maxed
        ? `${label} maxed`
        : !canAfford
          ? `Need ${cost} ${resource}`
          : `+ ${label} · ${cost} ${resource}`;

    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            title={
                maxed
                    ? `${label} capacity is already at its maximum.`
                    : locked
                      ? "Room upgrades are locked during raids."
                      : `${label} costs ${cost} ${resource}.`
            }
            className="cursor-pointer rounded-lg border border-[#b076d7]/25 bg-[#8f52b5]/10 px-2 py-2 text-[10px] font-bold text-[#d6b7ed] hover:border-[#d097ee]/40 hover:bg-[#8f52b5]/20 disabled:cursor-not-allowed disabled:opacity-35"
        >
            {text}
        </button>
    );
}
