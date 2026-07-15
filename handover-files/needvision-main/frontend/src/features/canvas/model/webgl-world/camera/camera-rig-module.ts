import { MathUtils, Vector3 } from 'three/webgpu';
import { remap } from '@/shared/lib/math/remap';
import type { World } from '../../World';
import { SCROLL_TRANSITION_START } from '../constants';
import type { WorldFrameContext } from '../core/world-frame-context';

export class CameraRigModule {
    private readonly cameraRevealOrigin = new Vector3(120, 120, 50);
    private readonly cameraScrollPositionScratch = new Vector3();

    constructor(private readonly world: World) {}

    update(_ctx: WorldFrameContext) {
        const w = this.world;
        const cam = w.camera;

        if (!cam) {
            return;
        }

        const cameraScrollT = MathUtils.clamp(
            remap(w.scrollProgress, [0, SCROLL_TRANSITION_START + 0.12], [0, 1]),
            0,
            1,
        );

        this.cameraScrollPositionScratch.lerpVectors(w.cameraPositionInitial, w.cameraPositionFinal, cameraScrollT);
        const experienceRevealT = w.experienceRevealUniforms !== undefined ? w.experienceCameraRevealBlend : 1;

        cam.position.lerpVectors(this.cameraRevealOrigin, this.cameraScrollPositionScratch, experienceRevealT);
        cam.lookAt(w.cameraLookAt);
        cam.updateMatrixWorld(true);
    }
}
