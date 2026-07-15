import { MathUtils } from 'three/webgpu';
import { remap } from '@/shared/lib/math/remap';
import type { World } from '../../World';
import {
    SCROLL_TRANSITION_END,
    SCROLL_TRANSITION_START,
    SCROLL_VIDEO_END,
    SCROLL_VIDEO_START,
} from '../constants';
import type { WorldFrameContext } from '../core/world-frame-context';

export class ScrollTransitionModule {
    private afLastFrameIndex = -1;

    constructor(private readonly world: World) {}

    resetAfFrameIndex() {
        this.afLastFrameIndex = -1;
    }

    update(ctx: WorldFrameContext) {
        const w = this.world;
        const prog = w.scrollTransitionProgress;
        const timeU = w.scrollTransitionTime;

        if (prog && timeU) {
            const transitionP = MathUtils.clamp(
                remap(w.scrollProgress, [SCROLL_TRANSITION_START, SCROLL_TRANSITION_END], [0, 1]),
                0,
                1,
            );

            prog.value = transitionP;
            timeU.value = ctx.elapsedTime;

            const manifest = w.afPlayer?.manifest;

            if (manifest) {
                const max = Math.max(0, manifest.totalFrames - 1);
                const videoP = MathUtils.clamp(
                    remap(w.scrollProgress, [SCROLL_VIDEO_START, SCROLL_VIDEO_END], [0, 1]),
                    0,
                    1,
                );
                const idx = Math.round(videoP * max);

                if (idx !== this.afLastFrameIndex && w.afPlayer) {
                    this.afLastFrameIndex = idx;
                    w.afPlayer.setFrame(idx);
                }
            }
        }
    }
}
