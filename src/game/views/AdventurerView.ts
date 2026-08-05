import { GameObjects, Scene } from "phaser";
import type { AdventurerData } from "../components/entityComponents/entityData";
import { AdventurerClass } from "../components/entityComponents/entityData";

const CLASS_COLORS: Record<AdventurerData["class"], number> = {
    [AdventurerClass.WARRIOR]: 0xdc2626,
    [AdventurerClass.ROGUE]: 0x16a34a,
    [AdventurerClass.CLERIC]: 0xfacc15,
    [AdventurerClass.ARCANIST]: 0x2563eb,
};

const CLASS_LABELS: Record<AdventurerData["class"], string> = {
    [AdventurerClass.WARRIOR]: "W",
    [AdventurerClass.ROGUE]: "R",
    [AdventurerClass.CLERIC]: "C",
    [AdventurerClass.ARCANIST]: "A",
};

export class AdventurerView extends GameObjects.Container {
    constructor(scene: Scene, adventurer: AdventurerData) {
        super(scene, adventurer.position.x, adventurer.position.y);
        const marker = new GameObjects.Arc(
            scene,
            0,
            0,
            15,
            0,
            360,
            false,
            CLASS_COLORS[adventurer.class],
        ).setStrokeStyle(3, 0xffffff);
        const label = new GameObjects.Text(scene, 0, 0, CLASS_LABELS[adventurer.class], {
            color: "#ffffff",
            fontFamily: "Arial, sans-serif",
            fontSize: "15px",
            fontStyle: "bold",
        }).setOrigin(0.5);

        this.add([marker, label]);
        this.setDepth(10);
        scene.add.existing(this);
    }
}
