import { gsap } from '../core/gsap'
import { Module } from '../core/Module'
import { SplitBlurReveal } from './SplitBlurReveal'

//Header intro — first load only (the header is persistent, Barba page changes don't replay it).
//Whatever state HeaderCompact left the header in under the preloader (spread, or compact on
//pinned pages / a reload with scroll), the same elements come in, cascaded by group:
//  1. logo — its svg rises inside the logo box + un-blurs (one "line", SplitText has no text
//     to split); descriptor + .header-content-icon fade
//  2. place + time texts — SplitBlurReveal
//  3. both links — text SplitBlurReveal, icon (arrow / menu lines) fades; compact only:
//     pill fill + counter letters, via HeaderCompact.releaseIntro()
//Texts are split on reveal(), not at mount — Clock rewrites the time text, which would wipe a
//split made earlier. Until then everything is hidden. Each split is reverted once it has played,
//so Clock / HeaderCompact see their normal markup afterwards.

const LOGO_SELECTOR = '#header-logo-actual'
const DESCRIPTOR_SELECTOR = '.descriptor-svg'
const ICON_SELECTOR = '.header-content-icon'
const PLACE_SELECTOR = '.header-content-place'
const TIME_SELECTOR = '.header-content-time-text'
const LINK_IDS = ['header-cases-link', 'header-menu-link']
const LINK_TEXT_SELECTOR = '.header-content-place'
const LINK_ICON_SELECTOR = '.arrow-line, .menu-lines-layout'
const LINK_SELECTOR = '.header-content-link'
const COUNTER_TEXT_ID = 'menu-counter-text'

//Cascade — seconds between groups
const GROUP_GAP = 0.08

//Fades
const FADE_DURATION = 0.8
const FADE_EASE = 'power2.out'

//Logo — same motion as SplitBlurReveal's defaults; the svg fills its box, so no bleed needed
const LOGO_OFFSET_PERCENT = 110
const LOGO_DURATION = 1.1
const LOGO_EASE = 'power3.out'
const LOGO_BLUR_PX = 12

export class HeaderReveal extends Module {

    constructor(headerCompact) {
        super()
        this.headerCompact = headerCompact
    }

    setup() {
        this.logo = document.querySelector(LOGO_SELECTOR)
        this.logoSvg = this.logo?.querySelector('svg') ?? null
        this.links = LINK_IDS.map((id) => document.getElementById(id)).filter(Boolean)

        //Texts per group, in order
        this.placeTexts = this.standalonePlaceTexts()
        this.timeTexts = [...document.querySelectorAll(TIME_SELECTOR)]
        this.linkTexts = this.links.map((link) => link.querySelector(LINK_TEXT_SELECTOR)).filter(Boolean)

        //Fades per group
        this.firstFades = [
            ...document.querySelectorAll(DESCRIPTOR_SELECTOR),
            ...document.querySelectorAll(ICON_SELECTOR),
        ]
        this.linkIcons = this.links.flatMap((link) => [...link.querySelectorAll(LINK_ICON_SELECTOR)])

        this.texts = [...this.placeTexts, ...this.timeTexts, ...this.linkTexts]
        this.fades = [...this.firstFades, ...this.linkIcons]
        if (this.texts.length === 0 && this.fades.length === 0 && !this.logoSvg) return

        this.reveals = []
        this.isRevealed = false

        //Hidden until reveal() — texts can't be split yet, so visibility only
        if (this.texts.length) gsap.set(this.texts, { visibility: 'hidden' })
        if (this.fades.length) gsap.set(this.fades, { opacity: 0 })
        if (this.logoSvg) gsap.set(this.logoSvg, { visibility: 'hidden' })
        this.headerCompact?.holdIntro()
    }

    //Called once the screen is visible (first load only)
    reveal() {
        if (!this.reveals || this.isRevealed) return
        this.isRevealed = true

        this.playLogo(0)
        this.fadeIn(this.firstFades, 0)

        this.playTexts(this.placeTexts, GROUP_GAP)
        this.playTexts(this.timeTexts, GROUP_GAP)

        this.playTexts(this.linkTexts, GROUP_GAP * 2)
        this.fadeIn(this.linkIcons, GROUP_GAP * 2)
        this.headerCompact?.releaseIntro(GROUP_GAP * 2)
    }

    //Helpers

    //The one .header-content-place that isn't a link label or the profit counter
    standalonePlaceTexts() {
        return [...document.querySelectorAll(PLACE_SELECTOR)]
            .filter((element) => element.id !== COUNTER_TEXT_ID && !element.closest(LINK_SELECTOR))
    }

    //Animations

    //Split now, already parked hidden — then visible and in. Reverted once played
    playTexts(elements, delay) {
        elements.forEach((element) => {
            let reveal = new SplitBlurReveal(element, { trigger: 'manual', delay }).mount()
            this.reveals.push(reveal)
            gsap.set(element, { clearProps: 'visibility' })
            reveal.playIn().then(() => {
                if (!this.reveals.includes(reveal)) return
                reveal.destroy()
                this.reveals = this.reveals.filter((item) => item !== reveal)
            })
        })
    }

    fadeIn(elements, delay) {
        if (!elements.length) return
        this.animate(gsap.to(elements, {
            opacity: 1,
            duration: FADE_DURATION,
            delay,
            ease: FADE_EASE,
            onComplete: () => gsap.set(elements, { clearProps: 'opacity' }),
        }))
    }

    //Logo box clips its svg for the rise; overflow handed back afterwards (HeaderCompact Flips the box)
    playLogo(delay) {
        if (!this.logoSvg) return
        let logo = this.logo
        let svg = this.logoSvg

        gsap.set(logo, { overflow: 'hidden', filter: `blur(${LOGO_BLUR_PX}px)` })
        gsap.set(svg, { visibility: 'visible', yPercent: LOGO_OFFSET_PERCENT })

        let timeline = gsap.timeline({
            delay,
            onComplete: () => {
                gsap.set(logo, { clearProps: 'overflow,filter' })
                gsap.set(svg, { clearProps: 'transform,visibility' })
            },
        })
        timeline.to(svg, { yPercent: 0, duration: LOGO_DURATION, ease: LOGO_EASE }, 0)
        timeline.to(logo, { filter: 'blur(0px)', duration: LOGO_DURATION, ease: LOGO_EASE }, 0)
        this.animate(timeline)
    }

    //Cleanup — splits reverted, everything shown as Webflow has it

    destroy() {
        super.destroy()
        this.reveals?.forEach((reveal) => reveal.destroy())
        this.reveals = []
        if (this.texts?.length) gsap.set(this.texts, { clearProps: 'visibility' })
        if (this.fades?.length) gsap.set(this.fades, { clearProps: 'opacity' })
        if (this.logo) gsap.set(this.logo, { clearProps: 'overflow,filter' })
        if (this.logoSvg) gsap.set(this.logoSvg, { clearProps: 'transform,visibility' })
        this.headerCompact?.releaseIntro()
    }
}
