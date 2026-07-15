import type { World } from '../../World';
import type { createWaterReflectorPlane } from '../create-water-reflector-plane';
import type { WorldFrameContext } from '../core/world-frame-context';

export type WaterRef = ReturnType<typeof createWaterReflectorPlane>;

export class WaterSurfaceModule {
    private water?: WaterRef;

    constructor(_world: World) {}

    setWater(w: WaterRef) {
        this.water = w;
    }

    getWater(): WaterRef | undefined {
        return this.water;
    }

    update(ctx: WorldFrameContext) {
        this.water?.update(ctx.elapsedTime * 0.005);
    }

    dispose() {
        this.water?.dispose();
        this.water = undefined;
    }
}
