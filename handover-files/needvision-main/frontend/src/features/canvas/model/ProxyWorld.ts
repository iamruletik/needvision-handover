import Stats, { type StatsData } from 'stats-gl';
import type { World } from './World';
import type { ExperienceRevealParams, HeaderLogoRect, IWorld } from './types';

export type ProxyWorldInitParams = {
    canvas: HTMLCanvasElement;
    dpr: number;
    width: number;
    height: number;
    isDebug: boolean;
    useCoarsePointer: boolean;
    afSrc: {
        h264: string;
        h265?: string;
    };
};

export class ProxyWorld implements IWorld {
    private worker?: Worker;
    private world?: World;
    private canvasEl: HTMLCanvasElement;
    private readonly initParams: ProxyWorldInitParams;
    private workerStats?: Stats;
    private workerStatsRaf = 0;
    private logoRectBuffer?: HeaderLogoRect | null;

    constructor(
        params: ProxyWorldInitParams,
        forceMainThread: boolean,
        private readonly onReady?: () => void,
    ) {
        this.initParams = params;
        this.canvasEl = params.canvas;

        const supportsOffscreen = 'OffscreenCanvas' in window && 'createImageBitmap' in window;
        const useWorker = !forceMainThread && supportsOffscreen;

        const initFallback = (canvas?: HTMLCanvasElement) => {
            import('./World').then(({ World: WorldCtor }) => {
                this.world = new WorldCtor({
                    ...this.initParams,
                    isWorker: false,
                    canvas: canvas ?? this.canvasEl,
                    onInitialized: () => {
                        this.onReady?.();
                    },
                });
                this.#flushLogoRectBuffer();
            });
        };

        if (useWorker) {
            this.worker = new Worker(new URL('./canvas.worker.ts', import.meta.url), { type: 'module' });
            const offscreen = params.canvas.transferControlToOffscreen();
            const testOffscreen = document.createElement('canvas').transferControlToOffscreen();
            const { canvas, ...rest } = this.initParams;

            this.worker.postMessage(
                {
                    message: 'init',
                    payload: {
                        ...rest,
                        isWorker: true,
                        canvas: offscreen,
                        testCanvas: testOffscreen,
                    },
                },
                [offscreen, testOffscreen],
            );

            this.worker.addEventListener('message', this.#onWorkerMessage);

            if (process.env.NODE_ENV === 'development') {
                this.#startWorkerStatsOverlay();
            }
        } else {
            initFallback();
        }
    }

    #onWorkerMessage = (ev: MessageEvent<{ message: string; payload?: unknown }>) => {
        const { message } = ev.data ?? {};

        switch (message) {
            case 'ready': {
                this.onReady?.();
                break;
            }

            case 'webgpu-error': {
                this.#teardownWorkerOnly();
                const prev = this.canvasEl;
                const newCanvas = document.createElement('canvas');

                newCanvas.className = prev.className;
                prev.insertAdjacentElement('afterend', newCanvas);
                prev.remove();
                this.canvasEl = newCanvas;

                import('./World').then(({ World: WorldCtor }) => {
                    this.world = new WorldCtor({
                        ...this.initParams,
                        isWorker: false,
                        canvas: newCanvas,
                        onInitialized: () => {
                            this.onReady?.();
                        },
                    });
                    this.#flushLogoRectBuffer();
                });
                break;
            }

            case 'stats': {
                this.workerStats?.setData(ev.data.payload as StatsData);
                break;
            }

            default:
                break;
        }
    };

    #startWorkerStatsOverlay() {
        this.workerStats = new Stats({
            trackGPU: true,
            trackCPT: true,
        });
        this.workerStats.domElement.classList.add('stats-gl');
        document.body.appendChild(this.workerStats.dom);

        const tick = () => {
            if (this.workerStats) {
                this.workerStats.begin();
                this.workerStats.update();
            }

            this.workerStatsRaf = requestAnimationFrame(tick);
        };

        this.workerStatsRaf = requestAnimationFrame(tick);
    }

    #stopWorkerStatsOverlay() {
        if (this.workerStatsRaf !== 0) {
            cancelAnimationFrame(this.workerStatsRaf);
            this.workerStatsRaf = 0;
        }
        this.workerStats?.dispose();
        this.workerStats = undefined;
    }

    #flushLogoRectBuffer() {
        if (this.world === undefined) {
            return;
        }

        if (this.logoRectBuffer === undefined) {
            return;
        }

        this.world.setHeaderLogoRect(this.logoRectBuffer);
        this.logoRectBuffer = undefined;
    }

    #teardownWorkerOnly() {
        if (process.env.NODE_ENV === 'development') {
            this.#stopWorkerStatsOverlay();
        }
        const w = this.worker;

        if (!w) {
            return;
        }
        this.worker = undefined;
        w.removeEventListener('message', this.#onWorkerMessage);

        const fallbackMs = 15000;
        const t = window.setTimeout(() => {
            w.removeEventListener('message', onDisposed);
            w.terminate();
        }, fallbackMs);

        const onDisposed = (ev: MessageEvent<{ message?: string }>) => {
            if (ev.data?.message !== 'disposed') {
                return;
            }
            window.clearTimeout(t);
            w.removeEventListener('message', onDisposed);
            w.terminate();
        };

        w.addEventListener('message', onDisposed);
        w.postMessage({ message: 'dispose' });
    }

    onResize(params: [width: number, height: number, dpr: number]) {
        if (this.worker) {
            this.worker.postMessage({ message: 'resize', payload: params });
        } else {
            this.world?.onResize(params);
        }
    }

    setPointerPosition(x: number, y: number) {
        if (this.worker) {
            this.worker.postMessage({ message: 'setPointerPosition', payload: { x, y } });
        } else {
            this.world?.setPointerPosition(x, y);
        }
    }

    setScrollProgress(progress: number) {
        if (this.worker) {
            this.worker.postMessage({ message: 'setScrollProgress', payload: { progress } });
        } else {
            this.world?.setScrollProgress(progress);
        }
    }

    revealExperience(params: ExperienceRevealParams) {
        if (this.worker) {
            this.worker.postMessage({ message: 'revealExperience', payload: params });
        } else {
            this.world?.revealExperience(params);
        }
    }

    setCityHoverColoringEnabled(enabled: boolean) {
        if (this.worker) {
            this.worker.postMessage({ message: 'setCityHoverColoringEnabled', payload: enabled });
        } else {
            this.world?.setCityHoverColoringEnabled(enabled);
        }
    }

    setHeaderLogoRect(rect: HeaderLogoRect | null) {
        if (this.worker) {
            this.worker.postMessage({ message: 'setHeaderLogoRect', payload: rect });
        } else if (this.world) {
            this.world.setHeaderLogoRect(rect);
        } else {
            this.logoRectBuffer = rect;
        }
    }

    dispose() {
        this.#teardownWorkerOnly();
        this.world?.dispose();
        this.world = undefined;
    }
}
