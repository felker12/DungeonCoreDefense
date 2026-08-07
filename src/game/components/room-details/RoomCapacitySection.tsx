import {
    getResourceLabel,
} from "../../denizens/DenizenAssignment";
import type { ResourceSnapshot } from "../../resources/ResourceManager";
import type {
    ResourceSlotType,
    RoomPopulationSnapshot,
} from "../../rooms/RoomPopulationManager";
import { getRoomSlotUpgradeCost } from "../../rooms/RoomSlotUpgrade";

interface RoomCapacitySectionProps {
    population: RoomPopulationSnapshot;
    resources: ResourceSnapshot["resources"];
    assignmentLocked: boolean;
    onUpgrade: (slot: ResourceSlotType | "defender") => void;
}

export function RoomCapacitySection({
    population,
    resources,
    assignmentLocked,
    onUpgrade,
}: RoomCapacitySectionProps) {
    const { capacity } = population;
    const gathererUpgradeCost = getRoomSlotUpgradeCost("gatherer");
    const defenderUpgradeCost = getRoomSlotUpgradeCost("defender");
    const gathererSlotsMaxed =
        capacity.kind === "resource" &&
        capacity.gatherers >= capacity.maxGatherers;
    const defenderSlotsMaxed =
        capacity.defenders >= capacity.maxDefenders;

    return (
        <div className="mt-5">
            <h3 className="mb-2 text-[10px] font-extrabold tracking-[.12em] text-[#d8cfdc] uppercase">
                Room capacity
            </h3>

            <div className="grid overflow-hidden rounded-xl border border-white/8 bg-white/3">
                {capacity.kind === "resource" && (
                    <Stat
                        label="Production"
                        value={`${population.productionPerSecond.toFixed(1)}/sec`}
                    />
                )}
                {capacity.kind === "resource" && (
                    <Stat
                        label="Gatherers"
                        value={`${population.assignedGatherers}/${capacity.gatherers} · max ${capacity.maxGatherers}`}
                    />
                )}
                <Stat
                    label="Defenders"
                    value={`${population.assignedDefenders}/${capacity.defenders} · max ${capacity.maxDefenders}`}
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
                {capacity.kind === "resource" && (
                    <UpgradeButton
                        label="Gatherer slot"
                        cost={gathererUpgradeCost.amount}
                        resource={getResourceLabel(
                            gathererUpgradeCost.resource,
                        )}
                        canAfford={
                            resources[gathererUpgradeCost.resource].value >=
                            gathererUpgradeCost.amount
                        }
                        locked={assignmentLocked}
                        maxed={gathererSlotsMaxed}
                        disabled={
                            assignmentLocked ||
                            gathererSlotsMaxed ||
                            resources[gathererUpgradeCost.resource].value <
                                gathererUpgradeCost.amount
                        }
                        onClick={() => onUpgrade("gatherer")}
                    />
                )}

                <UpgradeButton
                    label="Defender slot"
                    cost={defenderUpgradeCost.amount}
                    resource={getResourceLabel(defenderUpgradeCost.resource)}
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
