export type ActiveFrameInitOptions = {
    process?: (frame: VideoFrame) => void | Promise<void>;
    hardwareAcceleration?: VideoDecoderConfig['hardwareAcceleration'];
    closeFrameAfterProcess?: boolean;
};

export type ActiveFrameManifestFrame = {
    o: number;
    l: number;
    t: number;
    i: number;
    ty: 'key' | 'delta';
    data?: Uint8Array;
};

export type ActiveFrameManifest = {
    codec: string;
    width: number;
    height: number;
    description: string;
    totalFrames: number;
    frames: ActiveFrameManifestFrame[];
};

export type ActiveFramePlayer = {
    loading: Promise<void>;
    manifest: ActiveFrameManifest | null;
    setFrame(index: number): void;
    redraw(): void;
    destroy(): void;
};

export type ActiveFrameCtor = new (src: string, opts: ActiveFrameInitOptions) => ActiveFramePlayer;

export function getActiveFrameConstructor(): ActiveFrameCtor {
    const g = globalThis as typeof globalThis & { ActiveFrame: ActiveFrameCtor };

    return g.ActiveFrame;
}

declare global {
    interface PromiseConstructor {
        create<T = void>(): Promise<T> & {
            resolve: (value?: T | PromiseLike<T>) => void;
            reject: (reason?: unknown) => void;
        };
    }
}

export {};
