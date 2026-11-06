import { gsap } from '../core/gsap'
import { Module } from '../core/Module'
import { TRANSITIONING_CLASS } from './HeaderCompact'

//Light cone — a glow from the header logo's #theDot down to the footer light's hole (FooterLight).
//Owned by FooterLight; lives inside .footer-interactive-image, so it shows only where the image
//does (main.css "Footer Interactive Image") and is clipped to its box.
//
//No blurred triangle: the cone is a conic-gradient with its apex on the dot, opaque only over a
//narrow band of angles; soft stops either side stand in for the blur. A radial mask from the dot
//fades it along its length — --cone-start-alpha at the dot, --cone-end-alpha at the light
//(main.css "Light Cone"). JS only writes the geometry vars below.
//
//Re-aimed when the light moves (aimAt), on scroll / resize, and frame by frame while the dot
//itself moves: the header compacting / spreading (TRANSITIONING_CLASS) and the header intro.
//No aimAt (touch) — aims at the gradient's authored position, re-read on resize (Webflow can
//place it differently per breakpoint).

const CONE_CLASS = 'footer-light-cone'
const DOT_ID = 'theDot'

//Geometry
const CONE_WIDTH_SHARE = 1 //cone width at the light, as a share of the light's hole diameter
const CONE_EDGE_SOFTNESS_DEG = 4 //soft fade either side of the cone — the designer's blur
const CONE_TAIL_SHARE = 0.15 //past the light, the cone fades out over this share of its length
const FALLBACK_HOLE_STOP_PERCENT = 30 //when the light's gradient can't be read

//Reveal — fades in with the page, following the dot while the header intro moves it
const REVEAL_DELAY = 0.6
const REVEAL_DURATION = 1.2
const REVEAL_EASE = 'power2.out'
const REVEAL_TRACK_MS = 2500

export class LightCone extends Module {

    constructor(container, light) {
        super()
        this.container = container
        this.light = light
    }

    setup() {
        this.dot = document.getElementById(DOT_ID)
        if (!this.container || !this.light || !this.dot) return

        this.element = document.createElement('div')
        this.element.className = CONE_CLASS
        this.element.setAttribute('aria-hidden', 'true')
        this.container.appendChild(this.element)
        gsap.set(this.element, { autoAlpha: 0 })

        this.target = null //{ x, y } in % of the light box; null = authored position
        this.trackUntil = 0
        this.isTracking = false
        this.updateFrame = 0
        this.readAuthoredGradient()

        this.listen(window, 'scroll', () => this.requestUpdate(), { passive: true })
        this.listen(window, 'resize', () => {
            this.readAuthoredGradient()
            this.requestUpdate()
        })
        //Header compacting / spreading moves the dot — follow it until the class drops
        this.isHeaderTransitioning = document.documentElement.classList.contains(TRANSITIONING_CLASS)
        this.observe(new MutationObserver(() => {
            let isTransitioning = document.documentElement.classList.contains(TRANSITIONING_CLASS)
            if (isTransitioning === this.isHeaderTransitioning) return //some other class on <html>
            this.isHeaderTransitioning = isTransitioning
            this.track(isTransitioning ? Infinity : 0)
        })).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

        this.update()
    }

    //Called once the screen is visible (FooterLight.reveal)
    reveal() {
        if (!this.element || this.isRevealed) return
        this.isRevealed = true
        this.track(REVEAL_TRACK_MS)
        this.animate(gsap.to(this.element, { autoAlpha: 1, duration: REVEAL_DURATION, delay: REVEAL_DELAY, ease: REVEAL_EASE }))
    }

    //Public — FooterLight's smoothed light position, % of the light box
    aimAt(xPercent, yPercent) {
        this.target = { x: xPercent, y: yPercent }
        this.requestUpdate()
    }

    //Helpers

    //"radial-gradient(circle farthest-corner at 50% 85%, rgba(…) 0%, rgba(…) 40%)" → position + the
    //last stop (where the hole has gone fully dark). Computed style, so this breakpoint's version
    readAuthoredGradient() {
        let backgroundImage = getComputedStyle(this.light).backgroundImage || ''
        let position = backgroundImage.match(/at\s+(-?[\d.]+)%\s+(-?[\d.]+)%/)
        this.authoredTarget = position
            ? { x: parseFloat(position[1]), y: parseFloat(position[2]) }
            : { x: 50, y: 50 }
        let stops = [...backgroundImage.matchAll(/\)\s+(-?[\d.]+)%/g)]
        let lastStop = stops.length ? parseFloat(stops[stops.length - 1][1]) : NaN
        this.holeStopShare = (Number.isFinite(lastStop) ? lastStop : FALLBACK_HOLE_STOP_PERCENT) / 100
    }

    //Follow the dot every frame for durationMs (Infinity = until track(0))
    track(durationMs) {
        this.trackUntil = performance.now() + durationMs
        if (durationMs <= 0) {
            this.requestUpdate() //one last aim where it settled
            return
        }
        if (this.isTracking) return
        this.isTracking = true
        let step = () => {
            if (!this.element) return
            this.update()
            if (performance.now() < this.trackUntil) {
                this.trackFrame = requestAnimationFrame(step)
                return
            }
            this.isTracking = false
        }
        this.trackFrame = requestAnimationFrame(step)
    }

    //Coalesces scroll / aimAt bursts into one measure per frame
    requestUpdate() {
        if (this.updateFrame || this.isTracking) return
        this.updateFrame = requestAnimationFrame(() => {
            this.updateFrame = 0
            this.update()
        })
    }

    //Apex on the dot, axis on the light's center, width from the light's hole — all in px
    //relative to the cone's own box (= the light's)
    update() {
        if (!this.element) return
        let box = this.container.getBoundingClientRect()
        if (!box.width || !box.height) return
        let dotRect = this.dot.getBoundingClientRect()

        let apexX = dotRect.left + dotRect.width / 2 - box.left
        let apexY = dotRect.top + dotRect.height / 2 - box.top
        let target = this.target ?? this.authoredTarget
        let lightX = (target.x / 100) * box.width
        let lightY = (target.y / 100) * box.height

        let deltaX = lightX - apexX
        let deltaY = lightY - apexY
        let length = Math.max(1, Math.hypot(deltaX, deltaY))

        //circle farthest-corner — the radius the light's stops are measured against
        let farthestCorner = Math.hypot(Math.max(lightX, box.width - lightX), Math.max(lightY, box.height - lightY))
        let holeRadius = farthestCorner * this.holeStopShare
        let halfSpread = Math.atan((holeRadius * CONE_WIDTH_SHARE) / length) * 180 / Math.PI

        //Conic angles: 0deg points up, clockwise
        let axisAngle = Math.atan2(deltaX, -deltaY) * 180 / Math.PI
        let solidStart = CONE_EDGE_SOFTNESS_DEG
        let solidEnd = solidStart + halfSpread * 2

        let style = this.element.style
        style.setProperty('--cone-x', `${apexX.toFixed(1)}px`)
        style.setProperty('--cone-y', `${apexY.toFixed(1)}px`)
        style.setProperty('--cone-from', `${(axisAngle - halfSpread - CONE_EDGE_SOFTNESS_DEG).toFixed(2)}deg`)
        style.setProperty('--cone-solid-start', `${solidStart.toFixed(2)}deg`)
        style.setProperty('--cone-solid-end', `${solidEnd.toFixed(2)}deg`)
        style.setProperty('--cone-end', `${(solidEnd + CONE_EDGE_SOFTNESS_DEG).toFixed(2)}deg`)
        style.setProperty('--cone-length', `${length.toFixed(1)}px`)
        style.setProperty('--cone-tail', `${(length * (1 + CONE_TAIL_SHARE)).toFixed(1)}px`)
    }

    //Cleanup

    destroy() {
        super.destroy()
        cancelAnimationFrame(this.updateFrame)
        cancelAnimationFrame(this.trackFrame)
        this.isTracking = false
        this.element?.remove()
        this.element = null
    }
}
