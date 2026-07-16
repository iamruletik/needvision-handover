//Eye-blink page transition. Injects a fixed SVG-mask overlay and drives it through
//state classes (CSS owns all animation): idle -> closing -> covered -> opening -> idle.
//Promises resolve on animationend, so Barba can await close(), swap the page under
//a black screen, then await open(). Reduced motion snaps states instantly.
//Timings and easings live in main.css as --transition-* custom properties.

const OVERLAY_MARKUP = `
<div class="eye-transition is-idle" data-eye-transition aria-hidden="true">
    <svg class="eye-transition__svg" viewBox="0 0 1366 768" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <defs>
            <mask id="eye-transition-mask" maskUnits="userSpaceOnUse">
                <rect class="eye-mask-cover" width="1366" height="768" fill="#fff"></rect>
                <g class="eye-cover-scale">
                    <g class="eye-aperture-scale">
                        <path class="eye-path" fill="#000" d="M1354.53,367.56c-145.56,0-446.78,239.56-671.53,239.56-224.75,0-525.97-239.56-671.53-239.56,145.56,0,446.78-239.56,671.53-239.56,224.75,0,525.97,239.56,671.53,239.56Z"></path>
                    </g>
                </g>
            </mask>
        </defs>
        <rect width="1366" height="768" fill="#000" mask="url(#eye-transition-mask)"></rect>
    </svg>
</div>`

const STATE_CLASSES = ['is-idle', 'is-closing', 'is-covered', 'is-opening']
const CLOSE_ANIMATIONS = ['eye-cover-close', 'eye-aperture-close']
const OPEN_ANIMATIONS = ['eye-cover-open', 'eye-aperture-open']

export class EyeTransition {

    constructor() {
        this.root = document.querySelector('[data-eye-transition]') || this.injectOverlay()
        this.state = 'idle'
        this.pendingPhase = null
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

        this.root.addEventListener('animationend', (event) => this.onAnimationEnd(event))
    }

    injectOverlay() {
        let holder = document.createElement('div')
        holder.innerHTML = OVERLAY_MARKUP
        let overlay = holder.firstElementChild
        document.body.appendChild(overlay)
        return overlay
    }

    setState(state) {
        this.state = state
        STATE_CLASSES.forEach((className) => this.root.classList.remove(className))
        this.root.classList.add(`is-${state}`)
    }

    onAnimationEnd(event) {
        if (!this.pendingPhase || !this.pendingPhase.animationNames.has(event.animationName)) return

        this.pendingPhase.animationNames.delete(event.animationName)
        if (this.pendingPhase.animationNames.size > 0) return

        let finished = this.pendingPhase
        this.pendingPhase = null
        this.setState(finished.phase === 'closing' ? 'covered' : 'idle')
        finished.resolve()
    }

    //Blink shut — resolves when the screen is fully black
    close() {
        if (this.state !== 'idle') return Promise.resolve()

        if (this.reducedMotion.matches) {
            this.setState('covered')
            return Promise.resolve()
        }

        return new Promise((resolve) => {
            this.pendingPhase = { phase: 'closing', resolve, animationNames: new Set(CLOSE_ANIMATIONS) }
            this.setState('closing')
        })
    }

    //Hold on black — gap from CSS unless overridden
    wait(durationMs) {
        let gap = typeof durationMs === 'number' ? durationMs : this.readGapMs()
        if (this.reducedMotion.matches || gap <= 0) return Promise.resolve()
        return new Promise((resolve) => setTimeout(resolve, gap))
    }

    //Blink open — resolves when fully visible again
    open() {
        if (this.state !== 'covered') return Promise.resolve()

        if (this.reducedMotion.matches) {
            this.setState('idle')
            return Promise.resolve()
        }

        return new Promise((resolve) => {
            this.pendingPhase = { phase: 'opening', resolve, animationNames: new Set(OPEN_ANIMATIONS) }
            this.setState('opening')
        })
    }

    readGapMs() {
        let value = getComputedStyle(this.root).getPropertyValue('--transition-gap').trim()
        let numeric = parseFloat(value)
        if (!Number.isFinite(numeric)) return 0
        return value.endsWith('s') && !value.endsWith('ms') ? numeric * 1000 : numeric
    }
}
