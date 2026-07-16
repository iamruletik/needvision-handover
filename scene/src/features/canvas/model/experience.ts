import debounce from 'lodash.debounce';
import { scroll } from 'motion';
import { isFirefox } from '@/shared/lib/dom/browser';
import { staticUrl } from '@/shared/lib/static-url';
import { easeOutCubic } from '@/shared/lib/easings';
import { ProxyWorld } from './ProxyWorld';
import { registerWorldForHeaderLogo, unregisterWorldForHeaderLogo } from './header-logo-rect-bridge';
import type { IWorld } from './types';

class Experience {
    canvasParent: HTMLElement | null;
    world?: IWorld;
    private scrollCleanup?: () => void;

    private targetScrollProgress = 0;

    private rafId = 0;
    private revealAnimRafId = 0;

    prevTime = 0;
    isHoverMq = matchMedia('(any-hover: hover), (hover: hover) and (pointer: fine)');

    constructor(canvas: HTMLCanvasElement) {
        this.onPointermove = this.onPointermove.bind(this);
        this.onPointerdown = this.onPointerdown.bind(this);

        this.canvasParent = canvas.parentElement;
        const isDebug = new URLSearchParams(window.location.search).has('debug');

        this.world = new ProxyWorld(
            {
                canvas,
                dpr: this.dpr,
                width: canvas.offsetWidth,
                height: canvas.offsetHeight,
                isDebug,
                useCoarsePointer: matchMedia('(pointer: coarse)').matches,
                afSrc: {
                    h264: staticUrl(isFirefox() ? '/static/videos/underwater2_264_gov1.af' : '/static/videos/underwater2_264.af'),
                    h265: staticUrl(isFirefox() ? '/static/videos/underwater2_265_gov1.af' : '/static/videos/underwater2_265.af'),
                },
            },
            isDebug,
            () => {
                document.dispatchEvent(new Event('experience-ready'));
                this.#startRevealAnimation();
            },
        );
        registerWorldForHeaderLogo(this.world);

        const scrollSection = canvas.closest('.js-canvas-container');

        if (scrollSection instanceof HTMLElement) {
            this.scrollCleanup = scroll(this.#onScrollFromMotion, { target: scrollSection });
        }

        this.#initEvents();
        this.rafId = requestAnimationFrame(this.#scrollLoop);
    }

    get dpr() {
        return Math.min(window.devicePixelRatio, 1);
    }

    #onScrollFromMotion = (progress: number, _info: unknown) => {
        this.targetScrollProgress = progress;
    };

    #startRevealAnimation() {
        if (this.revealAnimRafId !== 0) {
            cancelAnimationFrame(this.revealAnimRafId);
            this.revealAnimRafId = 0;
        }

        const durationMs = 10000;
        const start = performance.now();
        const cameraRevealSpeed = 3;

        const tick = (now: number) => {
            const t = Math.min(1, (now - start) / durationMs);
            const cameraT = Math.min(1, t * cameraRevealSpeed);

            this.world?.revealExperience({
                reveal: easeOutCubic(t),
                cameraReveal: easeOutCubic(cameraT),
            });

            if (t < 1) {
                this.revealAnimRafId = requestAnimationFrame(tick);
            } else {
                this.revealAnimRafId = 0;
            }
        };

        this.revealAnimRafId = requestAnimationFrame(tick);
    }

    #scrollLoop = () => {
        this.rafId = requestAnimationFrame(this.#scrollLoop);
        const p = this.targetScrollProgress >= 1 - 1e-5 ? 1 : this.targetScrollProgress;

        this.world?.setScrollProgress(p);
    };

    private onWindowResize() {
        const width = this.canvasParent?.offsetWidth || 1;
        const height = this.canvasParent?.offsetHeight || 1;

        this.world?.onResize([width, height, this.dpr]);
    }

    debouncedOnWindowResize = debounce(() => {
        this.onWindowResize();
    }, 100);

    private onPointermove(event: PointerEvent) {
        if (this.isHoverMq.matches || event.pointerType === 'touch') {
            this.world?.setCityHoverColoringEnabled(true);
            this.world?.setPointerPosition(event.clientX, event.clientY);
        }
    }

    private onPointerdown(event: PointerEvent) {
        this.world?.setPointerPosition(event.clientX, event.clientY);
    }

    #initEvents() {
        window.addEventListener('resize', this.debouncedOnWindowResize);
        document.addEventListener('pointermove', this.onPointermove);
        document.addEventListener('pointerdown', this.onPointerdown);
    }

    dispose() {
        if (this.rafId !== 0) {
            cancelAnimationFrame(this.rafId);
            this.rafId = 0;
        }

        if (this.revealAnimRafId !== 0) {
            cancelAnimationFrame(this.revealAnimRafId);
            this.revealAnimRafId = 0;
        }

        this.scrollCleanup?.();
        this.scrollCleanup = undefined;
        this.debouncedOnWindowResize.cancel();
        window.removeEventListener('resize', this.debouncedOnWindowResize);
        document.removeEventListener('pointermove', this.onPointermove);
        document.removeEventListener('pointerdown', this.onPointerdown);
        unregisterWorldForHeaderLogo();
        this.world?.dispose();
    }
}

export default Experience;
