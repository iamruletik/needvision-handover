/// <reference lib="webworker" />
/// <reference types="@webgpu/types" />
import { World } from './World';
import type { CanvasData, ExperienceRevealParams, HeaderLogoRect } from './types';

type InitPayload = Omit<CanvasData, 'isWorker' | 'onInitialized' | 'onStatsData'> & {
    isWorker: boolean;
    canvas: OffscreenCanvas;
    testCanvas: OffscreenCanvas;
    afSrc?: {
        h264: string;
        h265: string;
    };
};

let world: World | undefined;
let headerLogoRectPending: HeaderLogoRect | null | undefined;

self.onmessage = async (event: MessageEvent<{ message: string; payload?: unknown }>) => {
    const { message, payload } = event.data;

    switch (message) {
        case 'init': {
            if (!payload || typeof payload !== 'object') {
                return;
            }

            const p = payload as InitPayload;

            if (!(p.canvas instanceof OffscreenCanvas) || !(p.testCanvas instanceof OffscreenCanvas)) {
                postMessage({ message: 'webgpu-error' });

                return;
            }

            try {
                const adapter = await navigator.gpu?.requestAdapter?.();

                if (!adapter) {
                    postMessage({ message: 'webgpu-error' });

                    return;
                }
            } catch {
                postMessage({ message: 'webgpu-error' });

                return;
            }

            const { testCanvas, ...rest } = p;

            world = new World({
                ...rest,
                isWorker: true,
                onInitialized: () => postMessage({ message: 'ready' }),
                onStatsData:
                    process.env.NODE_ENV === 'development'
                        ? (data) => postMessage({ message: 'stats', payload: data })
                        : undefined,
            });

            if (headerLogoRectPending !== undefined) {
                world.setHeaderLogoRect(headerLogoRectPending);
                headerLogoRectPending = undefined;
            }

            break;
        }

        case 'resize': {
            world?.onResize(payload as [number, number, number]);
            break;
        }

        case 'setPointerPosition': {
            const pl = payload as { x: number; y: number };

            world?.setPointerPosition(pl.x, pl.y);
            break;
        }

        case 'setScrollProgress': {
            const pl = payload as number | { progress: number; snap?: boolean };

            if (typeof pl === 'number') {
                world?.setScrollProgress(pl);
            } else {
                world?.setScrollProgress(pl.progress, pl.snap ? { snap: true } : undefined);
            }
            break;
        }

        case 'revealExperience': {
            world?.revealExperience(payload as ExperienceRevealParams);
            break;
        }

        case 'setCityHoverColoringEnabled': {
            world?.setCityHoverColoringEnabled(Boolean(payload));
            break;
        }

        case 'setHeaderLogoRect': {
            const r = payload as HeaderLogoRect | null;

            if (world) {
                world.setHeaderLogoRect(r);
            } else {
                headerLogoRectPending = r;
            }

            break;
        }

        case 'dispose': {
            const w = world;

            world = undefined;
            headerLogoRectPending = undefined;

            if (w) {
                await w.beginDispose();
            }
            postMessage({ message: 'disposed' });
            break;
        }

        default:
            break;
    }
};
