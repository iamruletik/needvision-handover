import debounce from 'lodash.debounce';
import { scroll } from 'motion';
import { isFirefox } from '@/shared/lib/dom/browser';
import { staticUrl } from '@/shared/lib/static-url';
import { easeOutCubic } from '@/shared/lib/easings';
import { ProxyWorld } from './ProxyWorld';
import { registerWorldForHeaderLogo, unregisterWorldForHeaderLogo } from './header-logo-rect-bridge';
import type { IWorld } from './types';

// Fired on document by the host site when its page becomes visible (see #startRevealWhenSiteVisible)
const SITE_REVEALED_EVENT = 'site-revealed';

class Experience {
    canvasParent: HTMLElement | null;
    world?: IWorld;
    private scrollCleanup?: () => void;
    private revealWaitCleanup?: () => void;

    private targetScrollProgress = 0;

    private rafId = 0;
    private revealAnimRafId = 0;

    prevTime = 0;
    isHoverMq = matchMedia('(any-hover: hover), (hover: hover) and (pointer: fine)');

    // First frame is live ('experience-ready' fired) — a parked scene stays ready
    isReady = false;
    // Host page left home: the world keeps everything built but renders nothing, and this
    // drops every page hook until resume() binds it to the next page's canvas
    private isParked = false;

    constructor(canvas: HTMLCanvasElement) {
        this.onPointermove = this.onPointermove.bind(this);
        this.onPointerdown = this.onPointerdown.bind(this);

        this.canvasParent = canvas.parentElement;
        // DEBUG TOOLS DISABLED — ?debug only forced the main thread so the tweakpane panel could
        // attach; with the panel commented out it would just give up the worker for nothing
        // const isDebug = new URLSearchParams(window.location.search).has('debug');
        const isDebug = false;

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
                this.isReady = true;
                document.dispatchEvent(new Event('experience-ready'));

                // Parked before it got ready — resume() starts the reveal instead
                if (!this.isParked) {
                    this.#startRevealWhenSiteVisible();
                }
            },
        );
        this.#bindToPage(canvas);
    }

    // Everything tied to the host page: scroll section, pointer, resize, header logo, scroll loop
    #bindToPage(canvas: HTMLCanvasElement) {
        this.canvasParent = canvas.parentElement;
        registerWorldForHeaderLogo(this.world as IWorld);

        const scrollSection = canvas.closest('.js-canvas-container');

        if (scrollSection instanceof HTMLElement) {
            this.scrollCleanup = scroll(this.#onScrollFromMotion, { target: scrollSection });
        }

        this.#initEvents();
        this.rafId = requestAnimationFrame(this.#scrollLoop);
    }

    // Safe to call twice — park() then dispose()
    #unbindFromPage() {
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
        this.revealWaitCleanup?.();
        this.revealWaitCleanup = undefined;
        this.debouncedOnWindowResize.cancel();
        window.removeEventListener('resize', this.debouncedOnWindowResize);
        document.removeEventListener('pointermove', this.onPointermove);
        document.removeEventListener('pointerdown', this.onPointerdown);
        unregisterWorldForHeaderLogo();
    }

    // The <canvas> element is detached by the caller — the worker keeps control of it
    park() {
        if (this.isParked) {
            return;
        }

        this.isParked = true;
        this.#unbindFromPage();
        // Back to the unrevealed pose, so the return replays the reveal like a fresh boot did
        this.world?.revealExperience({ reveal: 0, cameraReveal: 0 });
        this.world?.setParked(true);
    }

    // canvas — the same (parked) element, already placed in the new page's wrapper
    resume(canvas: HTMLCanvasElement) {
        if (!this.isParked) {
            return;
        }

        this.isParked = false;
        this.targetScrollProgress = 0;
        this.#bindToPage(canvas);
        this.onWindowResize();
        this.world?.setParked(false);

        if (this.isReady) {
            this.#startRevealWhenSiteVisible();
        }
    }

    get dpr() {
        return Math.min(window.devicePixelRatio, 1);
    }

    #onScrollFromMotion = (progress: number, _info: unknown) => {
        this.targetScrollProgress = progress;
    };

    // The host site (needvision bundle) keeps html[data-site-revealed] = "false" while its
    // preloader / page transition covers the screen, flips it to "true" and fires
    // 'site-revealed' when the page shows — the fade-in waits for that so it's never
    // half-played under the preloader. No flag at all (standalone): start right away.
    #startRevealWhenSiteVisible() {
        const siteRevealed = document.documentElement.dataset.siteRevealed;

        if (siteRevealed === undefined || siteRevealed === 'true') {
            this.#startRevealAnimation();

            return;
        }

        const onSiteRevealed = () => {
            this.revealWaitCleanup = undefined;
            this.#startRevealAnimation();
        };

        document.addEventListener(SITE_REVEALED_EVENT, onSiteRevealed, { once: true });
        this.revealWaitCleanup = () => document.removeEventListener(SITE_REVEALED_EVENT, onSiteRevealed);
    }

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
        this.#unbindFromPage();
        this.world?.dispose();
    }
}

export default Experience;
