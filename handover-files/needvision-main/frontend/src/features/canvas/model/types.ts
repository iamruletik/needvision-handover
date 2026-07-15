import type { StatsData } from 'stats-gl';

export type CanvasData = {
    isWorker: boolean;
    canvas: HTMLCanvasElement | OffscreenCanvas;
    dpr: number;
    width: number;
    height: number;
    isDebug: boolean;
    useCoarsePointer: boolean;
    afSrc: {
        h264: string;
        h265?: string;
    };
    onInitialized?: () => void;
    onStatsData?: (data: StatsData) => void;
};

export type ExperienceRevealParams = {
    reveal: number;
    cameraReveal?: number;
    center?: { x: number; y: number };
    maxRadius?: number;
    edgeSoftness?: number;
};

export type HeaderLogoRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export interface IWorld {
    onResize: (params: [width: number, height: number, dpr: number]) => void;
    setPointerPosition: (x: number, y: number) => void;
    setScrollProgress: (progress: number) => void;
    revealExperience: (params: ExperienceRevealParams) => void;
    setCityHoverColoringEnabled: (enabled: boolean) => void;
    setHeaderLogoRect: (rect: HeaderLogoRect | null) => void;
    dispose: () => void;
}
