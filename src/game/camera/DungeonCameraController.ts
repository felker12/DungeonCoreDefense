import {
    Geom,
    Math as PhaserMath,
    type GameObjects,
    type Input,
    type Scene,
} from "phaser";

interface DungeonCameraOptions {
    minZoom?: number;
    maxZoom?: number;
    zoomStep?: number;
    worldPadding?: number;
    southWorldPadding?: number;
    initialFitPadding?: number;
    keyboardPanSpeed?: number;
}

export class DungeonCameraController {
    private readonly minZoom: number;
    private readonly maxZoom: number;
    private readonly zoomStep: number;
    private readonly focusBounds: Geom.Rectangle;
    private readonly worldPadding: number;
    private readonly southWorldPadding: number;
    private readonly initialFitPadding: number;
    private readonly keyboardPanSpeed: number;
    private readonly movementKeys: Record<
        "up" | "left" | "down" | "right",
        Input.Keyboard.Key
    >;
    private worldBounds = new Geom.Rectangle();
    private isDragging = false;
    private targetZoom = 1;
    private isZooming = false;

    // Anchor points for zooming toward the cursor
    private zoomAnchorWorldX: number | null = null;
    private zoomAnchorWorldY: number | null = null;
    private zoomAnchorScreenX: number | null = null;
    private zoomAnchorScreenY: number | null = null;

    constructor(
        private readonly scene: Scene,
        focusBounds: Geom.Rectangle,
        options: DungeonCameraOptions = {},
    ) {
        this.minZoom = options.minZoom ?? 0.25;
        this.maxZoom = options.maxZoom ?? 2;
        this.zoomStep = options.zoomStep ?? 0.12;

        this.focusBounds = new Geom.Rectangle(
            focusBounds.x,
            focusBounds.y,
            focusBounds.width,
            focusBounds.height,
        );
        this.worldPadding = options.worldPadding ?? 1400;
        this.southWorldPadding = options.southWorldPadding ?? 2800;
        this.initialFitPadding = options.initialFitPadding ?? 140;
        this.keyboardPanSpeed = options.keyboardPanSpeed ?? 650;
        this.movementKeys = this.scene.input.keyboard!.addKeys({
            up: "W",
            left: "A",
            down: "S",
            right: "D",
        }) as Record<"up" | "left" | "down" | "right", Input.Keyboard.Key>;

        this.configureCamera();
        this.bindInput();
    }

    destroy(): void {
        this.scene.input.off("pointerdown", this.handlePointerDown, this);
        this.scene.input.off("pointermove", this.handlePointerMove, this);
        this.scene.input.off("pointerup", this.handlePointerUp, this);
        this.scene.input.off("pointerupoutside", this.handlePointerUp, this);
        this.scene.input.off("wheel", this.handleWheel, this);
        this.scene.scale.off("resize", this.handleResize, this);
        this.scene.events.off("update", this.handleUpdate, this);
        for (const key of Object.values(this.movementKeys)) key.destroy();
        this.setCursor("default");
    }

    /**
     * Re-center the initial view after the surrounding page layout has settled.
     *
     * This intentionally does not recalculate or change the zoom. Doing so here
     * would interfere with the cursor-anchored zoom behavior used after startup.
     */
    public centerOnDungeon(): void {
        const camera = this.scene.cameras.main;

        this.cancelSmoothZoom();
        this.refreshWorldBounds();
        camera.centerOn(this.focusBounds.centerX, this.focusBounds.centerY);
    }

    /** Perform the one startup fit after the Phaser host has its final size. */
    public initializeViewport(): void {
        const camera = this.scene.cameras.main;

        this.cancelSmoothZoom();
        camera.setSize(this.scene.scale.width, this.scene.scale.height);

        const fitZoom = Math.min(
            camera.width /
                (this.focusBounds.width + this.initialFitPadding * 2),
            camera.height /
                (this.focusBounds.height + this.initialFitPadding * 2),
            1,
        );

        this.targetZoom = PhaserMath.Clamp(fitZoom, this.minZoom, this.maxZoom);
        camera.setZoom(this.targetZoom);
        this.refreshWorldBounds();
        camera.centerOn(this.focusBounds.centerX, this.focusBounds.centerY);
    }

    /**
     * Refresh the camera's focus and panning bounds after the dungeon map grows.
     * The current zoom and position are preserved unless recentering is requested.
     */
    public updateFocusBounds(
        bounds: Geom.Rectangle,
        centerOnDungeon = false,
    ): void {
        this.focusBounds.setTo(bounds.x, bounds.y, bounds.width, bounds.height);
        this.refreshWorldBounds();

        if (centerOnDungeon) {
            this.scene.cameras.main.centerOn(
                this.focusBounds.centerX,
                this.focusBounds.centerY,
            );
        }
    }

    private configureCamera(): void {
        const camera = this.scene.cameras.main;
        const fitZoom = Math.min(
            camera.width /
                (this.focusBounds.width + this.initialFitPadding * 2),
            camera.height /
                (this.focusBounds.height + this.initialFitPadding * 2),
            1,
        );

        this.targetZoom = PhaserMath.Clamp(fitZoom, this.minZoom, this.maxZoom);
        camera.setZoom(this.targetZoom);
        this.refreshWorldBounds();
        camera.centerOn(this.focusBounds.centerX, this.focusBounds.centerY);
    }

    private bindInput(): void {
        this.scene.input.mouse?.disableContextMenu();
        this.scene.input.on("pointerdown", this.handlePointerDown, this);
        this.scene.input.on("pointermove", this.handlePointerMove, this);
        this.scene.input.on("pointerup", this.handlePointerUp, this);
        this.scene.input.on("pointerupoutside", this.handlePointerUp, this);
        this.scene.input.on("wheel", this.handleWheel, this);
        this.scene.scale.on("resize", this.handleResize, this);
        this.scene.events.on("update", this.handleUpdate, this);
        this.setCursor("grab");
    }

    private handleUpdate(_time: number, delta: number): void {
        this.updateSmoothZoom(delta);

        const horizontal =
            (this.movementKeys.right.isDown ? 1 : 0) -
            (this.movementKeys.left.isDown ? 1 : 0);
        const vertical =
            (this.movementKeys.down.isDown ? 1 : 0) -
            (this.movementKeys.up.isDown ? 1 : 0);

        if (horizontal === 0 && vertical === 0) return;

        this.cancelSmoothZoom();

        const camera = this.scene.cameras.main;
        const length = Math.hypot(horizontal, vertical);
        const distance =
            (this.keyboardPanSpeed * Math.min(delta, 50)) / 1000 / camera.zoom;

        camera.scrollX += (horizontal / length) * distance;
        camera.scrollY += (vertical / length) * distance;
    }

    private handlePointerDown(pointer: Input.Pointer): void {
        if (pointer.leftButtonDown() || pointer.middleButtonDown()) {
            this.cancelSmoothZoom();
            this.isDragging = true;
            this.setCursor("grabbing");
        }
    }

    private handlePointerMove(pointer: Input.Pointer): void {
        if (!this.isDragging || !pointer.isDown) {
            return;
        }

        const camera = this.scene.cameras.main;
        camera.scrollX -= (pointer.x - pointer.prevPosition.x) / camera.zoom;
        camera.scrollY -= (pointer.y - pointer.prevPosition.y) / camera.zoom;
    }

    private handlePointerUp(): void {
        this.isDragging = false;
        this.setCursor("grab");
    }

    private handleWheel(
        pointer: Input.Pointer,
        _gameObjects: GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number,
    ): void {
        if (deltaY === 0) return;

        const camera = this.scene.cameras.main;

        // Capture the world point and screen position under the cursor
        const worldPoint = camera.getWorldPoint(pointer.x, pointer.y);
        this.zoomAnchorWorldX = worldPoint.x;
        this.zoomAnchorWorldY = worldPoint.y;
        this.zoomAnchorScreenX = pointer.x;
        this.zoomAnchorScreenY = pointer.y;

        const direction = deltaY > 0 ? -1 : 1;
        this.targetZoom = PhaserMath.Clamp(
            this.targetZoom + direction * this.zoomStep,
            this.minZoom,
            this.maxZoom,
        );

        this.isZooming = Math.abs(this.targetZoom - camera.zoom) > 0.001;
    }

    private handleResize(): void {
        const camera = this.scene.cameras.main;
        const centerX = camera.midPoint.x;
        const centerY = camera.midPoint.y;

        this.cancelSmoothZoom();
        camera.setSize(this.scene.scale.width, this.scene.scale.height);
        this.refreshWorldBounds();
        camera.centerOn(centerX, centerY);
    }

    private refreshWorldBounds(): void {
        const camera = this.scene.cameras.main;

        const maximumViewportWidth = camera.width / this.minZoom;
        const maximumViewportHeight = camera.height / this.minZoom;

        const left =
            this.focusBounds.left -
            this.worldPadding -
            maximumViewportWidth / 2;
        const right =
            this.focusBounds.right +
            this.worldPadding +
            maximumViewportWidth / 2;
        const top =
            this.focusBounds.top -
            this.worldPadding -
            maximumViewportHeight / 2;
        const bottom =
            this.focusBounds.bottom +
            this.southWorldPadding +
            maximumViewportHeight / 2;

        this.worldBounds.setTo(left, top, right - left, bottom - top);

        camera.setBounds(
            this.worldBounds.x,
            this.worldBounds.y,
            this.worldBounds.width,
            this.worldBounds.height,
        );
    }

    private updateSmoothZoom(delta: number): void {
        if (!this.isZooming) return;

        const camera = this.scene.cameras.main;
        const frameSeconds = Math.min(delta, 50) / 1000;
        const easing = 1 - Math.exp(-10 * frameSeconds);
        const nextZoom = PhaserMath.Linear(
            camera.zoom,
            this.targetZoom,
            easing,
        );

        camera.setZoom(nextZoom);

        // Adjust scroll coordinates so the world point under the cursor stays fixed
        if (
            this.zoomAnchorWorldX !== null &&
            this.zoomAnchorWorldY !== null &&
            this.zoomAnchorScreenX !== null &&
            this.zoomAnchorScreenY !== null
        ) {
            const halfW = camera.width / 2;
            const halfH = camera.height / 2;

            camera.scrollX =
                this.zoomAnchorWorldX -
                halfW -
                (this.zoomAnchorScreenX - halfW) / camera.zoom;
            camera.scrollY =
                this.zoomAnchorWorldY -
                halfH -
                (this.zoomAnchorScreenY - halfH) / camera.zoom;
        }

        const zoomSettled = Math.abs(camera.zoom - this.targetZoom) < 0.001;

        if (zoomSettled) {
            camera.setZoom(this.targetZoom);
            this.isZooming = false;
            this.clearZoomAnchor();
        }
    }

    private clearZoomAnchor(): void {
        this.zoomAnchorWorldX = null;
        this.zoomAnchorWorldY = null;
        this.zoomAnchorScreenX = null;
        this.zoomAnchorScreenY = null;
    }

    private cancelSmoothZoom(): void {
        this.targetZoom = this.scene.cameras.main.zoom;
        this.isZooming = false;
        this.clearZoomAnchor();
    }

    private setCursor(cursor: "default" | "grab" | "grabbing"): void {
        this.scene.game.canvas.style.cursor = cursor;
    }
}
