import { gsap } from '../../core/gsap'
import { Module } from '../../core/Module'
import { SplitBlurReveal } from '../../modules/SplitBlurReveal'

//Home hero — everything in it plays in on page reveal and out once scrolled past the exit line:
//EXIT_LEAD_VH before .hero-main's bottom reaches the viewport bottom (where its sticky content
//starts scrolling away), so the out plays while it's still held.
//  Texts (headline, subtitle, .hero-top label + tag) — manual SplitBlurReveals: lines rise out
//      of their masks and un-blur, leave upward and blur back on. Cascaded by TEXT_DELAYS
//  .hero_planet-img — fades only
//Scrolling back above the line plays everything in again. Triggered, not scrubbed.
//Plain scroll listener, not ScrollTrigger — the hero is sticky and ScrollTrigger misfires there.
//Loading mid-page past the line leaves the hero hidden until the user scrolls back up.

//Seconds after the start of the in / out — top of the hero first
const TEXT_DELAYS = [
    { selector: '.hero_label', delay: 0 },
    { selector: '.hero_tag', delay: 0.12 },
    { selector: '.hero-headline-text', delay: 0.24 },
    { selector: '.hero_subtitle1', delay: 0.36 },
]

//Planet
const PLANET_SELECTOR = '.hero_planet-img'
const PLANET_IN_DURATION = 1.2
const PLANET_IN_EASE = 'power2.out'
const PLANET_OUT_DURATION = 0.4
const PLANET_OUT_EASE = 'power2.in'

//Exit line — measured from .hero (not sticky; .hero-main is its first in-flow child, so they
//share a top), since a sticky element's own box moves while it's held
const HERO_SELECTOR = '.hero'
const HERO_MAIN_SELECTOR = '.hero-main'
const EXIT_LEAD_VH = 50

export class HeroReveal extends Module {

    setup() {
        this.textReveals = TEXT_DELAYS
            .map(({ selector, delay }) => {
                let element = document.querySelector(selector)
                return element && new SplitBlurReveal(element, { trigger: 'manual', delay }).mount()
            })
            .filter(Boolean)

        this.planets = [...document.querySelectorAll(PLANET_SELECTOR)]
        if (this.textReveals.length === 0 && this.planets.length === 0) return

        if (this.planets.length) gsap.set(this.planets, { autoAlpha: 0 })

        this.hero = document.querySelector(HERO_SELECTOR)
        this.heroMain = document.querySelector(HERO_MAIN_SELECTOR)
        this.isRevealed = false
        this.isShown = false
        this.exitScroll = this.measureExit()

        this.listen(window, 'scroll', () => this.sync(), { passive: true })
        this.listen(window, 'resize', () => {
            this.exitScroll = this.measureExit()
            this.sync()
        })
    }

    //Called once the screen is visible
    reveal() {
        if (this.isRevealed) return
        this.isRevealed = true
        this.sync()
    }

    //Helpers

    //Scroll where .hero-main's bottom is EXIT_LEAD_VH above reaching the viewport bottom.
    //Missing sections: never exits
    measureExit() {
        if (!this.hero || !this.heroMain) return Infinity
        let heroTop = this.hero.getBoundingClientRect().top + window.scrollY
        let heroMainBottom = heroTop + this.heroMain.offsetHeight
        let lead = window.innerHeight * EXIT_LEAD_VH / 100
        return Math.max(0, heroMainBottom - window.innerHeight - lead)
    }

    isPastExit() {
        return window.scrollY > this.exitScroll
    }

    //Animations

    //Plays only on a change of side — scroll events inside one side do nothing
    sync() {
        if (!this.isRevealed) return
        let shouldShow = !this.isPastExit()
        if (shouldShow === this.isShown) return
        this.isShown = shouldShow

        if (shouldShow) this.playIn()
        else this.playOut()
    }

    playIn() {
        this.textReveals.forEach((reveal) => reveal.playIn())
        this.fadePlanets(1, PLANET_IN_DURATION, PLANET_IN_EASE)
    }

    playOut() {
        this.textReveals.forEach((reveal) => reveal.playOut())
        this.fadePlanets(0, PLANET_OUT_DURATION, PLANET_OUT_EASE)
    }

    fadePlanets(alpha, duration, ease) {
        if (!this.planets.length) return
        this.planetTween?.kill()
        this.planetTween = this.animate(gsap.to(this.planets, { autoAlpha: alpha, duration, ease }))
    }

    destroy() {
        this.textReveals?.forEach((reveal) => reveal.destroy())
        this.textReveals = []
        super.destroy()
        if (this.planets?.length) gsap.set(this.planets, { clearProps: 'opacity,visibility' })
        this.planets = []
    }
}
