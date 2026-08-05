import { Scene } from "phaser";
import { EventBus } from "../EventBus";

export class DungeonScene extends Scene {
    constructor() {
        super("DungeonScene");
    }

    create(): void {
        this.cameras.main.setBackgroundColor("#111018");

        this.add
            .text(512, 384, "Dungeon Core Defense", {
                color: "#ffffff",
                fontFamily: "Arial",
                fontSize: "32px",
            })
            .setOrigin(0.5);

        EventBus.emit("current-scene-ready", this);
    }
}
