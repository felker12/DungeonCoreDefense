import { AUTO, Game, Scale } from "phaser";
import { DungeonScene } from "./scenes/DungeonScene";

//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: 1024,
    height: 768,
    parent: "game-container",
    backgroundColor: "#111018",
    scale: {
        mode: Scale.RESIZE,
        autoCenter: Scale.CENTER_BOTH,
    },
    scene: [DungeonScene],
};

const StartGame = (parent: string): Phaser.Game => {
    return new Game({ ...config, parent });
};

export default StartGame;
