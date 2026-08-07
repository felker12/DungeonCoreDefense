import type { CardinalDirection } from "../../components/mapComponents/DungeonRoom";
import type { BuildableRoomType } from "../../construction/DungeonConstruction";
import { getResourceLabel } from "../../denizens/DenizenAssignment";
import type { ResourceSnapshot } from "../../resources/ResourceManager";
import type { DungeonConstructionSnapshot } from "../../scenes/DungeonScene";

interface RoomConstructionSectionProps {
    construction: DungeonConstructionSnapshot;
    resources: ResourceSnapshot["resources"];
    locked: boolean;
    onBuildRoom: (
        roomType: BuildableRoomType,
        direction: CardinalDirection,
    ) => boolean;
}

export function RoomConstructionSection({
    construction,
    resources,
    locked,
    onBuildRoom,
}: RoomConstructionSectionProps) {
    return (
        <div>
            <div className="flex items-center justify-between gap-3">
                <h3 className="m-0 text-[10px] font-extrabold tracking-[.12em] text-[#d8cfdc] uppercase">
                    Dungeon construction
                </h3>
                <span className="rounded border border-[#d9b766]/20 bg-[#d9b766]/8 px-2 py-1 text-[9px] font-bold text-[#e4c87f]">
                    {construction.functionalRoomCount} functional rooms
                </span>
            </div>

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
                                        {direction.direction
                                            .slice(0, 1)
                                            .toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
