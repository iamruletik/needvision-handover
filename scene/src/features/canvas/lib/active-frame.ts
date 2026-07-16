/**
 * Active Frame browser runtime (MIT)
 * Source: https://github.com/activetheory/activeframe/blob/main/docs/ActiveFrame.js
 */
/* eslint-disable no-console */
import type {
    ActiveFrameInitOptions,
    ActiveFrameManifest,
    ActiveFrameManifestFrame,
    ActiveFramePlayer,
} from '../model/active-frame-types';
import '../model/active-frame-types';

type BinaryLoad = { manifest: ActiveFrameManifest; data: ArrayBuffer };

const cacheActiveFrameList = new Map<string, Promise<BinaryLoad>>();

Promise.create = function <T = void>() {
    let resolve: ((value: T | PromiseLike<T>) => void) | null = null;
    let reject: ((reason?: unknown) => void) | null = null;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    const p = promise as Promise<T> & {
        resolve: (value?: T | PromiseLike<T>) => void;
        reject: (reason?: unknown) => void;
    };

    p.resolve = (value?: T | PromiseLike<T>) => {
        resolve!(value as T);
    };
    p.reject = reject!;

    return p;
};

const DECODE_QUEUE_SOFT_LIMIT = 8;

class ActiveFrame implements ActiveFramePlayer {
    file: string | null = null;
    manifest: ActiveFrameManifest | null = null;
    data: ArrayBuffer | null = null;
    decoder: VideoDecoder | null = null;
    frame: number | null = null;
    desideredFrame = 0;
    enabled = true;
    framesByTimestamp = new Map<number, number>();
    frameProcessed: number | null = null;
    loading: Promise<void> & { resolve: () => void; reject: (reason?: unknown) => void };
    process: (frame: VideoFrame) => void | Promise<void>;
    hardwareAcceleration: VideoDecoderConfig['hardwareAcceleration'];
    private closeFrameAfterProcess: boolean;
    private config: VideoDecoderConfig | null = null;
    private _pendingFrame?: number;
    private lastEnqueuedFrame: number | null = null;
    private seekTargetFrame: number | null = null;

    constructor(
        file: string,
        {
            process = () => {},
            hardwareAcceleration = 'prefer-hardware',
            closeFrameAfterProcess = true,
        }: ActiveFrameInitOptions = {},
    ) {
        this.loading = Promise.create<void>();
        this.process = process;
        this.hardwareAcceleration = hardwareAcceleration;
        this.closeFrameAfterProcess = closeFrameAfterProcess;

        this.file = file;
        this.init();
    }

    private async init(): Promise<void> {
        if (!this.file) {
            return;
        }
        cacheActiveFrameList.set(this.file, this.loadBinary(this.file));

        const loading = await cacheActiveFrameList.get(this.file)!;
        const { manifest, data } = loading;

        this.manifest = manifest;
        this.data = data;

        for (const frame of this.manifest.frames) {
            frame.data = new Uint8Array(this.data, frame.o, frame.l);
            this.framesByTimestamp.set(frame.t, frame.i);
        }

        await this.initDecoder();
        this.loading.resolve();
    }

    private async loadBinary(file: string): Promise<BinaryLoad> {
        const res = await fetch(file);
        const fullBuffer = await res.arrayBuffer();

        const footer = new DataView(fullBuffer, fullBuffer.byteLength - 4);
        const manifestOffset = footer.getUint32(0, true);

        const manifestBytes = new Uint8Array(fullBuffer, manifestOffset, fullBuffer.byteLength - 4 - manifestOffset);
        const manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as ActiveFrameManifest;

        return {
            manifest,
            data: fullBuffer,
        };
    }

    private decodeDescription(description: string): Uint8Array {
        const binaryString = atob(description);
        const bytes = new Uint8Array(binaryString.length);

        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        return bytes;
    }

    private async initDecoder(): Promise<void> {
        if (!this.manifest) {
            return;
        }

        const baseConfig: VideoDecoderConfig = {
            codec: this.manifest.codec,
            codedWidth: this.manifest.width,
            codedHeight: this.manifest.height,
            colorSpace: {
                primaries: 'bt709',
                transfer: 'bt709',
                matrix: 'bt709',
                fullRange: false,
            },
            description: this.decodeDescription(this.manifest.description),
        };

        const candidates: VideoDecoderConfig[] = [
            { ...baseConfig, hardwareAcceleration: this.hardwareAcceleration, optimizeForLatency: true },
            { ...baseConfig, hardwareAcceleration: this.hardwareAcceleration },
            { ...baseConfig, optimizeForLatency: true },
            { ...baseConfig },
        ];

        this.config = null;

        for (const candidate of candidates) {
            const support = await VideoDecoder.isConfigSupported(candidate);

            if (support.supported) {
                this.config = candidate;
                break;
            }
        }

        if (!this.config) {
            throw new Error('Decoder not supported');
        }

        this.decoder = new VideoDecoder({
            output: this.outputFrame.bind(this),
            error: (e) => {
                console.log(this.file);
                console.log(this.config);
                console.error('Decoder error:', e);
            },
        });

        this.decoder.configure(this.config);
    }

    private async outputFrame(frame: VideoFrame): Promise<void> {
        if (!this.enabled) {
            frame.close();

            return;
        }

        const frameId = this.framesByTimestamp.get(frame.timestamp);

        if (frameId === undefined) {
            frame.close();

            return;
        }

        if (this.seekTargetFrame !== null) {
            if (frameId !== this.seekTargetFrame) {
                frame.close();

                return;
            }
            this.seekTargetFrame = null;
        } else {
            const lastProcessed = this.frameProcessed ?? -1;

            if (frameId <= lastProcessed || frameId > this.desideredFrame) {
                frame.close();

                return;
            }
        }

        this.frame = frameId;

        if (this.process) {
            await this.process(frame);
        }

        this.frameProcessed = frameId;

        if (this.closeFrameAfterProcess) {
            frame.close();
        }
    }

    setFrame(desideredFrame: number): void {
        if (!this.manifest) return;

        if (!this.enabled) return;

        if (!this.decoder || !this.config) return;

        let target = Math.round(Number(desideredFrame));
        const maxFrame = Math.max(0, this.manifest.totalFrames - 1);

        target = Math.min(Math.max(target, 0), maxFrame);
        this.desideredFrame = target;

        if (this.desideredFrame === this.frame) return;

        if (this.desideredFrame === this._pendingFrame) return;

        this._pendingFrame = this.desideredFrame;

        const frameMeta = this.manifest.frames[this.desideredFrame];

        if (!frameMeta?.data) {
            return;
        }

        const isSequential =
            this.lastEnqueuedFrame !== null &&
            this.desideredFrame === this.lastEnqueuedFrame + 1 &&
            frameMeta.ty === 'delta';

        if (isSequential) {
            if (this.decoder.decodeQueueSize >= DECODE_QUEUE_SOFT_LIMIT) {
                this._pendingFrame = undefined;

                return;
            }

            this.decoder.decode(
                new EncodedVideoChunk({
                    type: frameMeta.ty,
                    timestamp: frameMeta.t,
                    data: frameMeta.data,
                }),
            );
            this.lastEnqueuedFrame = this.desideredFrame;

            return;
        }

        if (this.decoder.decodeQueueSize > 0) {
            this.decoder.reset();
            this.decoder.configure(this.config);
        }
        this.seekTargetFrame = this.desideredFrame;
        this.frameProcessed = null;
        this.frame = null;

        if (frameMeta.ty === 'key') {
            this.decoder.decode(
                new EncodedVideoChunk({
                    type: frameMeta.ty,
                    timestamp: frameMeta.t,
                    data: frameMeta.data,
                }),
            );
            this.lastEnqueuedFrame = this.desideredFrame;
        } else {
            let keyFrame: ActiveFrameManifestFrame | null = null;

            for (let i = this.desideredFrame; i >= 0; i--) {
                const f = this.manifest.frames[i];

                if (f.ty === 'key') {
                    keyFrame = f;
                    break;
                }
            }

            if (!keyFrame?.data) {
                console.error('No key frame found');

                return;
            }

            this.decoder.decode(
                new EncodedVideoChunk({
                    type: keyFrame.ty,
                    timestamp: keyFrame.t,
                    data: keyFrame.data,
                }),
            );
            this.lastEnqueuedFrame = keyFrame.i;

            for (let i = keyFrame.i + 1; i <= this.desideredFrame; i++) {
                const f = this.manifest.frames[i];

                if (f.ty === 'delta' && f.data) {
                    this.decoder.decode(
                        new EncodedVideoChunk({
                            type: f.ty,
                            timestamp: f.t,
                            data: f.data,
                        }),
                    );
                    this.lastEnqueuedFrame = i;
                } else {
                    break;
                }
            }
        }
    }

    redraw(): void {
        if (!this.manifest) {
            return;
        }

        if (!this.enabled) {
            return;
        }

        if (!this.decoder || !this.config) {
            return;
        }

        const idx = this.desideredFrame;

        this.frame = null;
        this.frameProcessed = null;
        this.lastEnqueuedFrame = null;
        this.seekTargetFrame = null;
        this._pendingFrame = undefined;
        this.setFrame(idx);
    }

    stop(): void {}

    destroy(): void {
        if (this.file) {
            cacheActiveFrameList.delete(this.file);
        }
        this.stop();

        if (this.decoder) {
            try {
                this.decoder.close();
            } catch {
                /* ignore */
            }
            this.decoder = null;
        }
        this.data = null;
        this.manifest = null;
        this.file = null;
        this.process = () => {};
        this.frameProcessed = null;
        this.enabled = false;
        this.framesByTimestamp.clear();
    }
}

const g = globalThis as typeof globalThis & { ActiveFrame: typeof ActiveFrame };

g.ActiveFrame = ActiveFrame;
