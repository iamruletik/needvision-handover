import { Module } from '../core/Module'

//Floating CTA click → straight to the footer, never seen scrolling or jumping: the eye blinks shut
//(the page-transition overlay, EyeTransition), the page jumps to its end under the black (footer
//fully uncovered), holds for the transition gap so scrubbed animations land, then the eye opens.
//Persistent — the floating button is swapped with every page, so one delegated listener in the
//capture phase: it runs before SmoothScroll's anchor glide and Barba's link handling, and stops them.
//Close to the footer already (the end within GLIDE_WITHIN_VH): no blink, the page just glides
//down to the end — a push the rest of the way.
//Ignored while the eye is already busy (page transition) or the menu holds the header.

const CTA_SELECTOR = '.floating-button-wrapper .call-to-action, .bento_circle-btn'
const GLIDE_WITHIN_VH = 150
const GLIDE_DURATION = 1.4 //Lenis' own easing (SmoothScroll, expo out)

export class FloatingCtaFooterJump extends Module {

    constructor(smoothScroll, eyeTransition, headerCompact = null) {
        super()
        this.smoothScroll = smoothScroll
        this.eyeTransition = eyeTransition
        this.headerCompact = headerCompact
    }

    setup() {
        if (!this.smoothScroll?.lenis || !this.eyeTransition) return
        this.isJumping = false
        this.listen(document, 'click', (event) => this.onClick(event), { capture: true })
    }

    onClick(event) {
        let cta = event.target.closest?.(CTA_SELECTOR)
        if (!cta) return

        event.preventDefault()
        event.stopPropagation()
        if (this.isJumping || this.eyeTransition.state !== 'idle' || this.headerCompact?.isMenuLocked) return
        if (this.isNearEnd()) this.glide()
        else this.jump()
    }

    //Helpers

    isNearEnd() {
        let lenis = this.smoothScroll.lenis
        lenis.resize() //lazy content may have grown the page since Lenis last measured its limit
        return lenis.limit - lenis.scroll <= window.innerHeight * GLIDE_WITHIN_VH / 100
    }

    //Animations

    glide() {
        let lenis = this.smoothScroll.lenis
        lenis.scrollTo(lenis.limit, { duration: GLIDE_DURATION, force: true })
    }

    async jump() {
        this.isJumping = true
        let lenis = this.smoothScroll.lenis
        try {
            await this.eyeTransition.close()
            lenis.scrollTo(lenis.limit, { immediate: true, force: true })
            await this.eyeTransition.wait()
            await this.eyeTransition.open()
        } catch (error) {
            console.warn('FloatingCtaFooterJump: jump failed', error)
            await this.eyeTransition.open()
        } finally {
            this.isJumping = false
        }
    }
}
