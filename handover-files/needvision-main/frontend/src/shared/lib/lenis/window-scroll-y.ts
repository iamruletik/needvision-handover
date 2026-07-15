import type Lenis from 'lenis';

let lenisRef: Lenis | null = null;

export function registerLenis(lenis: Lenis) {
    lenisRef = lenis;
}

export function getLenis(): Lenis | null {
    return lenisRef;
}

export function setWindowScrollY(y: number) {
    if (lenisRef) {
        lenisRef.scrollTo(y, { immediate: true });
    } else {
        window.scrollTo(0, y);
    }
}
