import { Experience } from '../model';

let experience: Experience | null = null;
let isInitialized = false;
let mediaQueryList: MediaQueryList | null = null;
let onMediaChange: (() => void) | null = null;

function findWrapper(): HTMLElement | null {
    return document.querySelector<HTMLElement>('.js-canvas-wrapper');
}

function findCanvas(): HTMLCanvasElement | null {
    return findWrapper()?.querySelector<HTMLCanvasElement>('canvas.js-canvas') ?? null;
}

function ensureCanvas(wrapper: HTMLElement): HTMLCanvasElement {
    let el = wrapper.querySelector<HTMLCanvasElement>('canvas.js-canvas');

    if (!el) {
        el = document.createElement('canvas');
        el.className = 'canvas js-canvas';
        wrapper.appendChild(el);
    }

    return el;
}

function recycleCanvasElement(stale: HTMLCanvasElement) {
    const parent = stale.parentElement;

    if (!parent) {
        return;
    }

    const fresh = document.createElement('canvas');

    fresh.className = 'canvas js-canvas';

    parent.replaceChild(fresh, stale);
}

function mount(canvas: HTMLCanvasElement) {
    if (experience) {
        return;
    }

    experience = new Experience(canvas);
}

function unmount() {
    if (!experience) {
        return;
    }

    experience.dispose();
    experience = null;

    const stale = findCanvas();

    if (stale) {
        recycleCanvasElement(stale);
    }
}

function syncMedia(matches: boolean) {
    const wrapper = findWrapper();

    if (!wrapper) {
        return;
    }

    const canvas = ensureCanvas(wrapper);

    if (matches) {
        mount(canvas);
    } else {
        unmount();
    }
}

function init() {
    if (isInitialized) {
        return;
    }

    const wrapper = findWrapper();

    if (!wrapper) {
        return;
    }

    isInitialized = true;

    const media = wrapper.dataset.media?.trim();

    if (!media) {
        mount(ensureCanvas(wrapper));

        return;
    }

    const mql = window.matchMedia(media);

    mediaQueryList = mql;
    const handler = () => syncMedia(mql.matches);

    onMediaChange = handler;
    syncMedia(mql.matches);
    mql.addEventListener('change', handler);
}

function destroy() {
    if (mediaQueryList && onMediaChange) {
        mediaQueryList.removeEventListener('change', onMediaChange);
    }

    mediaQueryList = null;
    onMediaChange = null;
    unmount();
    findCanvas()?.remove();
    isInitialized = false;
}

export default { init, destroy };
