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
            if (game.current === null) {
                game.current = StartGame("game-container");

                const initialRefValue: IRefPhaserGame = {
                    game: game.current,
                    scene: null,
                };

                if (typeof ref === "function") {
                    ref(initialRefValue);
                } else if (ref) {
                    ref.current = initialRefValue;
                }
            }

            return () => {
                if (game.current) {
                    game.current.destroy(true);
                    game.current = null;
                }

                const clearedRefValue: IRefPhaserGame = {
                    game: null,
                    scene: null,
                };

                if (typeof ref === "function") {
                    ref(clearedRefValue);
                } else if (ref) {
                    ref.current = clearedRefValue;
                }
            };
        }, [ref]);

        useEffect(() => {
            const handleSceneReady = (scene: Phaser.Scene): void => {
                currentActiveScene?.(scene);

                const updatedRefValue: IRefPhaserGame = {
                    game: game.current,
                    scene,
                };

                if (typeof ref === "function") {
                    ref(updatedRefValue);
                } else if (ref) {
                    ref.current = updatedRefValue;
                }
            };

            EventBus.on("current-scene-ready", handleSceneReady);

            return () => {
                EventBus.off("current-scene-ready", handleSceneReady);
            };
        }, [currentActiveScene, ref]);

        return <div id="game-container" />;
    },
);
