import { gsap } from '../core/gsap'
import { Module } from '../core/Module'

//Arc above the logo dot — a third of a circle around #theDot (both in the Webflow logo embed,
//#theDotArc: dasharray shows 120°, base rotate(-150) centres it straight up). It leans toward
//the mouse: cursor left of the dot tilts it left, right tilts it right, up to MAX_TILT at
//TILT_REACH_SCREEN_SHARE of the screen width away. Only while the logo is big — compact
//(.is-small) eases it back to upright and ignores the mouse. Touch devices: stays upright.
//It rides inside the logo svg, so the header reveal brings it in with the logo.

const ARC_ID = 'theDotArc'
const DOT_ID = 'theDot'
const LOGO_ID = 'header-logo-actual'
const LOGO_SMALL_CLASS = 'is-small'

//Rotation, degrees — BASE matches the embed's rotate(-150): dash centred straight up
const BASE_ROTATION = -150
const MAX_TILT = 60
//Cursor this share of the screen width away from the dot = full tilt
const TILT_REACH_SCREEN_SHARE = 0.5

const FOLLOW_DURATION = 0.6
const FOLLOW_EASE = 'power3.out'

export class LogoArc extends Module {

    setup() {
        this.arc = document.getElementById(ARC_ID)
        this.dot = document.getElementById(DOT_ID)
        this.logo = document.getElementById(LOGO_ID)
        if (!this.arc || !this.dot || !this.logo) return

        //Centre of the dot in svg user units — rotation pivots there.
        //getBBox throws in Firefox if the svg isn't rendered (display: none) — skip then
        let dotBox
        try {
            dotBox = this.dot.getBBox()
        } catch (error) {
            console.warn('LogoArc: logo dot not measurable, skipping', error)
            return
        }
        let pivot = `${dotBox.x + dotBox.width / 2} ${dotBox.y + dotBox.height / 2}`
        gsap.set(this.arc, { rotation: BASE_ROTATION, svgOrigin: pivot })

        this.rotateTo = gsap.quickTo(this.arc, 'rotation', { duration: FOLLOW_DURATION, ease: FOLLOW_EASE })

        if (!window.matchMedia('(hover: hover)').matches) return

        this.lastPointerX = null
        this.listen(window, 'pointermove', (event) => {
            this.lastPointerX = event.clientX
            this.follow()
        }, { passive: true })

        //Compact / spread — re-aim without waiting for the next mouse move
        this.observe(new MutationObserver(() => this.follow()))
            .observe(this.logo, { attributes: true, attributeFilter: ['class'] })
    }

    //Helpers

    isLogoBig() {
        return !this.logo.classList.contains(LOGO_SMALL_CLASS)
    }

    //-1 (far left of the dot) … 1 (far right)
    pointerSide() {
        if (this.lastPointerX === null) return 0
        let dotRect = this.dot.getBoundingClientRect()
        let dotCenterX = dotRect.left + dotRect.width / 2
        let reach = Math.max(1, window.innerWidth * TILT_REACH_SCREEN_SHARE)
        return gsap.utils.clamp(-1, 1, (this.lastPointerX - dotCenterX) / reach)
    }

    //Animations

    follow() {
        let tilt = this.isLogoBig() ? this.pointerSide() * MAX_TILT : 0
        this.rotateTo(BASE_ROTATION + tilt)
    }

    destroy() {
        super.destroy()
        if (this.arc) gsap.killTweensOf(this.arc)
    }
}
