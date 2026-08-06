// src/game/views/CorridorView.ts

import { GameObjects, Scene } from "phaser";
import type { DungeonConnection } from "../components/mapComponents/DungeonConnection";
import type { DungeonRoom } from "../components/mapComponents/DungeonRoom";
import { getConnectionDirection } from "../construction/DungeonConstruction";

const CORRIDOR_OUTER_SIZE = 54;
const CORRIDOR_FLOOR_SIZE = 36;
const CORRIDOR_RADIUS = 8;
const SEAM_SPACING = 34;

export class CorridorView extends GameObjects.Graphics {
    constructor(
        scene: Scene,
        connection: DungeonConnection,
        roomsById: ReadonlyMap<string, DungeonRoom>,
    ) {
        super(scene);

        const from = roomsById.get(connection.fromRoomId);
        const to = roomsById.get(connection.toRoomId);

        if (!from || !to) {
            throw new Error(`Invalid dungeon connection: ${connection.id}`);
        }

        const direction = getConnectionDirection(from, to);
        if (!direction) {
            throw new Error(
                `Connection ${connection.id} is invalid. Connected rooms must be cardinally aligned.`,
            );
        }

        this.setDepth(0);
        this.drawCorridor(from, to);
    }

    private drawCorridor(from: DungeonRoom, to: DungeonRoom): void {
        const horizontal = from.position.y === to.position.y;
        const forward = horizontal
            ? Math.sign(to.position.x - from.position.x)
            : Math.sign(to.position.y - from.position.y);

        const start = horizontal
            ? from.position.x + forward * (from.size.width / 2)
            : from.position.y + forward * (from.size.height / 2);
        const end = horizontal
            ? to.position.x - forward * (to.size.width / 2)
            : to.position.y - forward * (to.size.height / 2);

        const corridorStart = Math.min(start, end);
        const corridorLength = Math.max(1, Math.abs(end - start));
        const center = horizontal ? from.position.y : from.position.x;

        const outer = horizontal
            ? {
                  x: corridorStart,
                  y: center - CORRIDOR_OUTER_SIZE / 2,
                  width: corridorLength,
                  height: CORRIDOR_OUTER_SIZE,
              }
            : {
                  x: center - CORRIDOR_OUTER_SIZE / 2,
                  y: corridorStart,
                  width: CORRIDOR_OUTER_SIZE,
                  height: corridorLength,
              };

        const floor = horizontal
            ? {
                  x: corridorStart,
                  y: center - CORRIDOR_FLOOR_SIZE / 2,
                  width: corridorLength,
                  height: CORRIDOR_FLOOR_SIZE,
              }
            : {
                  x: center - CORRIDOR_FLOOR_SIZE / 2,
                  y: corridorStart,
                  width: CORRIDOR_FLOOR_SIZE,
                  height: corridorLength,
              };

        // Soft drop shadow beneath the corridor.
        this.fillStyle(0x050407, 0.72);
        this.fillRoundedRect(
            outer.x + (horizontal ? 0 : 5),
            outer.y + (horizontal ? 5 : 0),
            outer.width,
            outer.height,
            CORRIDOR_RADIUS + 2,
        );

        // Dark stone walls, recessed walking surface, and a faint inner bevel.
        this.fillStyle(0x2a2431, 1);
        this.fillRoundedRect(
            outer.x,
            outer.y,
            outer.width,
            outer.height,
            CORRIDOR_RADIUS + 2,
        );
        this.lineStyle(2, 0x574b63, 0.9);
        this.strokeRoundedRect(
            outer.x + 1,
            outer.y + 1,
            Math.max(1, outer.width - 2),
            Math.max(1, outer.height - 2),
            CORRIDOR_RADIUS + 1,
        );

        this.fillStyle(0x17141c, 1);
        this.fillRoundedRect(
            floor.x,
            floor.y,
            floor.width,
            floor.height,
            CORRIDOR_RADIUS - 2,
        );
        this.lineStyle(1, 0x75667f, 0.42);
        this.strokeRoundedRect(
            floor.x + 1,
            floor.y + 1,
            Math.max(1, floor.width - 2),
            Math.max(1, floor.height - 2),
            CORRIDOR_RADIUS - 2,
        );

        this.drawFloorSeams(horizontal, floor, corridorStart, corridorLength);
        this.drawDoorThresholds(
            horizontal,
            floor,
            corridorStart,
            corridorLength,
        );
    }

    private drawFloorSeams(
        horizontal: boolean,
        floor: { x: number; y: number; width: number; height: number },
        corridorStart: number,
        corridorLength: number,
    ): void {
        this.lineStyle(1, 0x8c7a97, 0.18);

        for (
            let offset = SEAM_SPACING;
            offset < corridorLength - 8;
            offset += SEAM_SPACING
        ) {
            const position = corridorStart + offset;
            if (horizontal) {
                this.lineBetween(
                    position,
                    floor.y + 6,
                    position,
                    floor.y + floor.height - 6,
                );
            } else {
                this.lineBetween(
                    floor.x + 6,
                    position,
                    floor.x + floor.width - 6,
                    position,
                );
            }
        }

        this.lineStyle(1, 0xb09cba, 0.22);
        if (horizontal) {
            this.lineBetween(
                floor.x + 8,
                floor.y + floor.height / 2,
                floor.x + floor.width - 8,
                floor.y + floor.height / 2,
            );
        } else {
            this.lineBetween(
                floor.x + floor.width / 2,
                floor.y + 8,
                floor.x + floor.width / 2,
                floor.y + floor.height - 8,
            );
        }
    }

    private drawDoorThresholds(
        horizontal: boolean,
        floor: { x: number; y: number; width: number; height: number },
        corridorStart: number,
        corridorLength: number,
    ): void {
        const thresholdSize = 6;
        this.fillStyle(0x6b5b75, 0.62);

        if (horizontal) {
            this.fillRect(
                corridorStart,
                floor.y + 3,
                thresholdSize,
                floor.height - 6,
            );
            this.fillRect(
                corridorStart + corridorLength - thresholdSize,
                floor.y + 3,
                thresholdSize,
                floor.height - 6,
            );
        } else {
            this.fillRect(
                floor.x + 3,
                corridorStart,
                floor.width - 6,
                thresholdSize,
            );
            this.fillRect(
                floor.x + 3,
                corridorStart + corridorLength - thresholdSize,
                floor.width - 6,
                thresholdSize,
            );
        }
    }
}

