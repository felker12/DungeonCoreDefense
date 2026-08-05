import type { Scene } from "phaser";
import type { EntityId, Position } from "../components/DungeonData";
import type { DungeonRoom } from "../components/mapComponents/DungeonRoom";
import { EventBus } from "../EventBus";
import { AdventurerView } from "../views/AdventurerView";
import type { AdventurerParty } from "../waves/PartyData";

export interface PartyMovementOptions {
    travelDuration?: number;
    roomPauseDuration?: number;
}

const FORMATION_COLUMN_SPACING = 34;
const FORMATION_ROW_SPACING = 32;

function createFormationOffsets(memberCount: number): readonly Position[] {
    if (memberCount < 1) return [];

    const columnCount = Math.ceil(Math.sqrt(memberCount));
    const rowCount = Math.ceil(memberCount / columnCount);
    const offsets: Position[] = [];

    for (let row = 0; row < rowCount; row += 1) {
        const membersAlreadyPlaced = row * columnCount;
        const membersInRow = Math.min(
            columnCount,
            memberCount - membersAlreadyPlaced,
        );
        const y = (row - (rowCount - 1) / 2) * FORMATION_ROW_SPACING;

        for (let column = 0; column < membersInRow; column += 1) {
            offsets.push({
                x:
                    (column - (membersInRow - 1) / 2) *
                    FORMATION_COLUMN_SPACING,
                y,
            });
        }
    }

    return offsets;
}

export class PartyController {
    private readonly views: AdventurerView[];
    private readonly formationOffsets: readonly Position[];
    private readonly travelDuration: number;
    private readonly roomPauseDuration: number;

    constructor(
        private readonly scene: Scene,
        private readonly party: AdventurerParty,
        private readonly roomsById: ReadonlyMap<EntityId, DungeonRoom>,
        options: PartyMovementOptions = {},
    ) {
        this.travelDuration = options.travelDuration ?? 700;
        this.roomPauseDuration = options.roomPauseDuration ?? 450;
        this.views = party.members.map((member) => new AdventurerView(scene, member));
        this.formationOffsets = createFormationOffsets(party.members.length);
    }

    async advance(): Promise<void> {
        for (let routeIndex = 0; routeIndex < this.party.route.length; routeIndex += 1) {
            const roomId = this.party.route[routeIndex];
            const room = this.roomsById.get(roomId);
            if (!room) throw new Error(`Party route references missing room ${roomId}.`);

            if (routeIndex === 0) this.placeParty(room.position);
            else await this.moveParty(room.position);

            for (const member of this.party.members) member.currentRoomId = room.id;
            EventBus.emit("party-room-entered", { party: this.party, room });
            for (const member of this.party.members) {
                EventBus.emit("adventurer-room-entered", { adventurer: member, room });
            }
            await this.wait(this.roomPauseDuration);
        }

        EventBus.emit("party-core-reached", this.party);
        for (const member of this.party.members) {
            EventBus.emit("adventurer-core-reached", member);
        }
        this.destroyViews();
    }

    destroy(): void {
        for (const view of this.views) this.scene.tweens.killTweensOf(view);
        this.destroyViews();
    }

    private placeParty(center: Position): void {
        this.views.forEach((view, index) => {
            const offset = this.formationOffsets[index];
            view.setPosition(center.x + offset.x, center.y + offset.y);
        });
    }

    private moveParty(center: Position): Promise<void> {
        return Promise.all(
            this.views.map((view, index) => new Promise<void>((resolve) => {
                const offset = this.formationOffsets[index];
                this.scene.tweens.add({
                    targets: view,
                    x: center.x + offset.x,
                    y: center.y + offset.y,
                    duration: this.travelDuration,
                    ease: "Sine.easeInOut",
                    onComplete: () => resolve(),
                });
            })),
        ).then(() => undefined);
    }

    private wait(duration: number): Promise<void> {
        return new Promise((resolve) => this.scene.time.delayedCall(duration, resolve));
    }

    private destroyViews(): void {
        for (const view of this.views) view.destroy();
    }
}
