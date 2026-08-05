import type { Scene } from "phaser";
import type { EntityId } from "../components/DungeonData";
import type { AdventurerData } from "../components/entityComponents/entityData";
import type { DungeonRoom } from "../components/mapComponents/DungeonRoom";
import { EventBus } from "../EventBus";
import { AdventurerView } from "../views/AdventurerView";

export interface AdventurerMovementOptions {
    travelDuration?: number;
    roomPauseDuration?: number;
}

export class AdventurerController {
    private readonly view: AdventurerView;
    private readonly travelDuration: number;
    private readonly roomPauseDuration: number;

    constructor(
        private readonly scene: Scene,
        private readonly adventurer: AdventurerData,
        private readonly route: EntityId[],
        private readonly roomsById: ReadonlyMap<EntityId, DungeonRoom>,
        options: AdventurerMovementOptions = {},
    ) {
        this.travelDuration = options.travelDuration ?? 700;
        this.roomPauseDuration = options.roomPauseDuration ?? 450;
        this.view = new AdventurerView(scene, adventurer);
    }

    async advance(): Promise<void> {
        for (let index = 0; index < this.route.length; index += 1) {
            const room = this.roomsById.get(this.route[index]);
            if (!room) throw new Error(`Route references missing room ${this.route[index]}.`);

            if (index === 0) {
                this.view.setPosition(room.position.x, room.position.y);
            } else {
                await this.moveTo(room.position.x, room.position.y);
            }

            this.adventurer.currentRoomId = room.id;
            EventBus.emit("adventurer-room-entered", { adventurer: this.adventurer, room });
            await this.wait(this.roomPauseDuration);
        }

        EventBus.emit("adventurer-core-reached", this.adventurer);
        this.view.destroy();
    }

    destroy(): void {
        this.scene.tweens.killTweensOf(this.view);
        this.view.destroy();
    }

    private moveTo(x: number, y: number): Promise<void> {
        return new Promise((resolve) => {
            this.scene.tweens.add({
                targets: this.view,
                x,
                y,
                duration: this.travelDuration,
                ease: "Sine.easeInOut",
                onComplete: () => resolve(),
            });
        });
    }

    private wait(duration: number): Promise<void> {
        return new Promise((resolve) => {
            this.scene.time.delayedCall(duration, resolve);
        });
    }
}
