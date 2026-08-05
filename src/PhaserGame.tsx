import { forwardRef, useEffect, useLayoutEffect, useRef } from "react";
import StartGame from "./game/main";
import { EventBus } from "./game/EventBus";

export interface IRefPhaserGame {
    game: Phaser.Game | null;
    scene: Phaser.Scene | null;
}

interface IProps {
    currentActiveScene?: (scene: Phaser.Scene) => void;
}

export const PhaserGame = forwardRef<IRefPhaserGame, IProps>(
    function PhaserGame({ currentActiveScene }, ref) {
        const game = useRef<Phaser.Game | null>(null);

        useLayoutEffect(() => {
            game.current ??= StartGame("game-container");

            if (typeof ref === "function") {
                ref({ game: game.current, scene: null });
            } else if (ref) {
                ref.current = { game: game.current, scene: null };
            }

            return () => {
                game.current?.destroy(true);
                game.current = null;

                if (typeof ref === "function") {
                    ref({ game: null, scene: null });
                } else if (ref) {
                    ref.current = { game: null, scene: null };
                }
            };
        }, [ref]);

        useEffect(() => {
            const handleSceneReady = (scene: Phaser.Scene): void => {
                currentActiveScene?.(scene);

                if (typeof ref === "function") {
                    ref({ game: game.current, scene });
                } else if (ref) {
                    ref.current = { game: game.current, scene };
                }
            };

            EventBus.on("current-scene-ready", handleSceneReady);
            return () => {
                EventBus.off("current-scene-ready", handleSceneReady);
            };
        }, [currentActiveScene, ref]);

        return <div id="game-container" style={{ width: "100vw", height: "100vh" }} />;
    },
);
