import Stats, { type StatsProfiler } from 'stats-gl';
import type { Scene, WebGPURenderer } from 'three/webgpu';
import type { RendererStats } from '../../../lib/RendererStats';
import type { CanvasData } from '../../types';

export class WorldStatsModule {
    stats?: Stats;
    rendererStats?: RendererStats;
    statsProfiler?: StatsProfiler;

    beginProfilerFrame() {
        this.statsProfiler?.begin();
    }

    updateStatsHud() {
        this.stats?.update();
    }

    updateRendererStats(renderer: WebGPURenderer, scene: Scene) {
        this.rendererStats?.update(renderer, scene);
    }

    endProfilerFrame(options: Pick<CanvasData, 'onStatsData'>) {
        if (!this.statsProfiler) {
            return;
        }

        this.statsProfiler.end();
        this.statsProfiler.update();
        options.onStatsData?.(this.statsProfiler.getData());
    }

    disposeDom() {
        this.stats?.dom?.remove?.();
        this.rendererStats?.dispose();
        this.statsProfiler?.dispose();
        this.stats = undefined;
        this.rendererStats = undefined;
        this.statsProfiler = undefined;
    }
}
