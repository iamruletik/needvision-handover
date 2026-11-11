import { gsap } from '../core/gsap'
import { Module } from '../core/Module'
import { DESCRIPTOR_SPACE_CLASS, DESCRIPTOR_SPACE_EVENT } from './HeaderCompact'

//Fixed page element (a step floater's content) placed under the header, docking into it on compact.
//Rest:   its top = .header-content-logo-container's bottom + GAP_REM. The header lives outside the
//        Barba container, so Webflow can't express it — measured on load and on resize, while
//        the header is spread (compact shrinks the container; loaded compact, Webflow's top
//        stays until the first spread).
//Docked: when HeaderCompact frees the descriptor's spot (DESCRIPTOR_SPACE_EVENT) the element
//        slides (y only) until its bottom lines up with the descriptor's bottom, back on spread.
//        Never happens ≤991 — the header is pinned compact there and the descriptor stays.
//The element must be absolute / fixed with its top set in Webflow (inline top overrides it).

const LOGO_CONTAINER_SELECTOR = '.header-content-logo-container'
const DESCRIPTOR_SELECTOR = '.descriptor-svg'
const GAP_REM = 2

//One motion with the descriptor: docking starts as its lines speed out (DescriptorReveal's
//handoff) and carries the speed in (out ease). Undocking leaves fast first (in ease) and the
//descriptor starts coming in at UNDOCK_HANDOFF_SHARE of it (showDelay on the event)
const DOCK_DURATION = 0.6
const DOCK_EASE = 'power3.out'
const UNDOCK_EASE = 'power3.in'
const UNDOCK_HANDOFF_SHARE = 0.7

export class FloaterHeaderDock extends Module {

    constructor(element) {
        super()
        this.element = element
    }

    setup() {
        this.logoContainer = document.querySelector(LOGO_CONTAINER_SELECTOR)
        this.descriptor = document.querySelector(DESCRIPTOR_SELECTOR)
        if (!this.element || !this.logoContainer) return

        this.isDocked = document.documentElement.classList.contains(DESCRIPTOR_SPACE_CLASS)
        this.dockTween = null

        if (this.isDocked) this.setDockedY()
        else this.placeAtRest()

        this.listen(document, DESCRIPTOR_SPACE_EVENT, (event) => {
            let detail = event.detail ?? {}
            let { isFree, instant } = detail
            //Leaving — the descriptor waits until most of the move is done
            if (!isFree && this.isDocked && !instant) {
                detail.showDelay = Math.max(detail.showDelay ?? 0, DOCK_DURATION * UNDOCK_HANDOFF_SHARE)
            }
            //After the event's call stack — HeaderCompact moves the DOM right after announcing
            queueMicrotask(() => this.setDocked(Boolean(isFree), Boolean(instant)))
        })
        this.listen(window, 'resize', () => this.onResize())
    }

    //Helpers

    rootFontSize() {
        return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    }

    currentY() {
        return Number(gsap.getProperty(this.element, 'y')) || 0
    }

    //Containing block's top — the fixed floater wrapper, or the viewport
    containingTop() {
        return this.element.offsetParent?.getBoundingClientRect().top ?? 0
    }

    //Inline top under the logo container. Returns the change, so a running y can absorb it
    placeAtRest() {
        let previousTop = this.element.getBoundingClientRect().top - this.currentY()
        let top = this.logoContainer.getBoundingClientRect().bottom + GAP_REM * this.rootFontSize() - this.containingTop()
        gsap.set(this.element, { top })
        let nextTop = this.element.getBoundingClientRect().top - this.currentY()
        return nextTop - previousTop
    }

    //Descriptor's bottom in its final compact layout — its Flip transform dropped for the read
    descriptorLayoutBottom() {
        let inlineTransform = this.descriptor.style.transform
        this.descriptor.style.transform = 'none'
        let bottom = this.descriptor.getBoundingClientRect().bottom
        this.descriptor.style.transform = inlineTransform
        return bottom
    }

    dockedY() {
        if (!this.descriptor) return 0
        let restingBottom = this.element.getBoundingClientRect().bottom - this.currentY()
        return this.descriptorLayoutBottom() - restingBottom
    }

    setDockedY() {
        gsap.set(this.element, { y: this.dockedY() })
    }

    onResize() {
        if (this.isDocked) {
            this.dockTween?.kill()
            this.setDockedY()
            return
        }
        //Mid undock — keep it where it is on screen, the tween carries on to the new rest
        let shift = this.placeAtRest()
        if (shift) gsap.set(this.element, { y: this.currentY() - shift })
    }

    //Animations

    setDocked(isDocked, instant = false) {
        if (!this.element || isDocked === this.isDocked) return
        this.isDocked = isDocked
        this.dockTween?.kill()

        //Spread: the container is back at full height — re-measure the rest top, keep the
        //element where it is on screen, then glide home
        if (!isDocked) {
            let shift = this.placeAtRest()
            if (shift) gsap.set(this.element, { y: this.currentY() - shift })
        }

        let y = isDocked ? this.dockedY() : 0
        this.dockTween = this.animate(gsap.to(this.element, {
            y,
            duration: instant ? 0 : DOCK_DURATION,
            ease: isDocked ? DOCK_EASE : UNDOCK_EASE,
        }))
    }

    //Cleanup — Webflow's top back

    destroy() {
        super.destroy()
        this.dockTween?.kill()
        if (this.element) gsap.set(this.element, { clearProps: 'top,transform' })
        this.isDocked = false
    }
}
