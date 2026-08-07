import { useEffect, useState } from "react";
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
    const [selectedRoomType, setSelectedRoomType] =
        useState<BuildableRoomType | null>(
            construction.catalog[0]?.type ?? null,
        );

    useEffect(() => {
        const selectedStillExists = construction.catalog.some(
            (option) => option.type === selectedRoomType,
        );

        if (!selectedStillExists) {
            setSelectedRoomType(construction.catalog[0]?.type ?? null);
        }
    }, [construction.catalog, selectedRoomType]);

    const selectedOption =
        construction.catalog.find(
            (option) => option.type === selectedRoomType,
        ) ?? construction.catalog[0];

    const affordable =
        selectedOption?.costs.every(
            (cost) => resources[cost.resource].value >= cost.amount,
        ) ?? false;

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

            <div className="mt-3 rounded-xl border border-white/8 bg-white/3 p-3">
                {!selectedOption ? (
                    <p className="m-0 text-[10px] text-[#8f8597]">
                        No room types are currently available to build.
                    </p>
                ) : (
                    <>
                        <label
                            htmlFor="room-construction-type"
                            className="mb-1.5 block text-[8px] font-extrabold tracking-[.12em] text-[#8f8592] uppercase"
                        >
                            Room type
                        </label>

                        <select
                            id="room-construction-type"
                            value={selectedOption.type}
                            disabled={locked}
                            onChange={(event) =>
                                setSelectedRoomType(
                                    event.target.value as BuildableRoomType,
                                )
                            }
                            className="w-full cursor-pointer rounded-lg border border-[#a979c6]/25 bg-[#17131d] px-3 py-2 text-[11px] font-bold text-[#eee7dc] outline-none transition focus:border-[#c99be1]/50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {construction.catalog.map((option) => (
                                <option key={option.type} value={option.type}>
                                    {option.label}
                                </option>
                            ))}
                        </select>

                        <div className="mt-3 flex items-start justify-between gap-3">
                            <p className="m-0 flex-1 text-[9px] leading-relaxed text-[#8f8597]">
                                {selectedOption.description}
                            </p>
                            <span
                                className={`shrink-0 text-right text-[9px] font-bold ${
                                    affordable
                                        ? "text-[#d9b766]"
                                        : "text-[#c47d76]"
                                }`}
                            >
                                {selectedOption.costs
                                    .map(
                                        (cost) =>
                                            `${cost.amount} ${getResourceLabel(
                                                cost.resource,
                                            )}`,
                                    )
                                    .join(" + ")}
                            </span>
                        </div>

                        <div className="mt-3">
                            <span className="mb-1.5 block text-[8px] font-extrabold tracking-[.12em] text-[#8f8592] uppercase">
                                Build direction
                            </span>

                            <div className="grid grid-cols-4 gap-1.5">
                                {selectedOption.directions.map((direction) => (
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
                                                : (direction.reason ??
                                                  `Build to the ${direction.direction}.`)
                                        }
                                        onClick={() =>
                                            onBuildRoom(
                                                selectedOption.type,
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
                    </>
                )}
            </div>
        </div>
    );
}

