import type { World } from '../../World';
import type { createWorldPostProcessing } from '../create-post-processing';

export class PostProcessingModule {
    private postProcessing?: ReturnType<typeof createWorldPostProcessing>['postProcessing'];

    constructor(private readonly world: World) {}

    setPostProcessing(pp: ReturnType<typeof createWorldPostProcessing>['postProcessing'] | undefined) {
        this.postProcessing = pp;
    }

    get(): ReturnType<typeof createWorldPostProcessing>['postProcessing'] | undefined {
        return this.postProcessing;
    }

    render() {
        const p = this.postProcessing;

        if (p) {
            p.render();
        } else {
            const { renderer, scene, camera } = this.world;

            if (camera) {
                renderer.render(scene, camera);
            }
        }
    }

    markNeedsUpdate() {
        if (this.postProcessing) {
            this.postProcessing.needsUpdate = true;
        }
    }
}
