import { gsap } from '../core/gsap'
import { Module } from '../core/Module'

//Bento cards parallax through .parallax-sticky:
//  phase 1 — cards fly in scattered and assemble into the grid
//  hold    — cards rest centered
//  phase 2 — cards slide up and out
//Scrub by design — this is parallax, position follows scroll.
//
//Per-card overrides via Webflow custom attributes (beat the scatter pattern):
//  data-start-y / data-start-x / data-start-rot — where the card flies in from
//  data-end-y                                   — where it exits to
//  data-enter-delay / data-exit-delay           — extra timeline-unit delays
//
//≤991 the grid is taller than the screen, so a shared timeline plays while lower cards are off
//screen. Each card drifts on its own scrub instead, across its own trip through the viewport,
//from data-start-y to data-end-y × mobileMoveScale. No scatter, fade or delays there.

const CONFIG = {
    //Phase proportions in timeline units (fractions of one scroll distance, not seconds)
    enterDuration: 14,
    holdDuration: 5,
    exitDuration: 25,

    //Timeline ends once the next section fully covers the cards — they're still moving (exit
    //accelerates) when hidden, never seen stopping
    endTrigger: '.section-logo',
    end: 'top top',

    exitY: '-83.33vw',
    //Every exit distance (exitY or data-end-y) × this — same scroll,
    //shorter travel, slower exit: cards still up as the next section slides over them
    exitDistanceScale: 0.5,

    //Fraction of enterDuration spent fading in — card rides opaque after
    enterFadeRatio: 0.35,

    //Scattered entry: each card from its own point with its own delay
    scatterEnabled: true,
    //Total spread of card start times, split between cards
    enterStaggerSpread: 5,
    //How long a card stands scattered before assembling — user sees the scatter while the section rolls in
    scatterHold: 14,
    //Cycled by DOM order; vertical only, all from below — a card starting above its slot climbed
    //over the manifesto on short screens
    scatterPattern: [
        { y: '65vw', x: '0vw', rot: 0 },
        { y: '22vw', x: '0vw', rot: 0 },
        { y: '82vw', x: '0vw', rot: 0 },
        { y: '30vw', x: '0vw', rot: 0 },
        { y: '70vw', x: '0vw', rot: 0 },
        { y: '18vw', x: '0vw', rot: 0 },
    ],

    enterEase: 'power2.out',
    exitEase: 'power2.in',

    //≤991: the card's travel distances are multiplied by this
    mobileMedia: '(max-width: 991px)',
    mobileMoveScale: 0.2,
    mobileScrub: 0.5,
    mobileStart: 'top bottom',
    mobileEnd: 'bottom top',
}

export class BentoParallax extends Module {

    setup() {
        this.cards = [...document.querySelectorAll('.bento_card.is-parallax')]
        this.stickySection = document.querySelector('.parallax-sticky')
        if (this.cards.length === 0 || !this.stickySection) return

        if (window.matchMedia(CONFIG.mobileMedia).matches) {
            this.buildMobileDrift()
            return
        }

        //scrub 0.5 for stability, invalidateOnRefresh false — refresh recalcs
        //fromTo start values and opacity blinks
        let endTrigger = document.querySelector(CONFIG.endTrigger)
        this.timeline = this.animate(gsap.timeline({
            scrollTrigger: {
                trigger: this.stickySection,
                start: 'top bottom',
                //No next section: the old end, sticky's bottom past the viewport top
                endTrigger: endTrigger ?? this.stickySection,
                end: endTrigger ? CONFIG.end : 'bottom top',
                scrub: 0.5,
                invalidateOnRefresh: false,
            },
        }))

        let staggerTail = CONFIG.scatterEnabled ? CONFIG.enterStaggerSpread : 0
        let scatterHold = CONFIG.scatterEnabled ? CONFIG.scatterHold : 0
        this.enterSpan = scatterHold + CONFIG.enterDuration + staggerTail
        this.holdStart = this.enterSpan
        this.exitStart = this.holdStart + CONFIG.holdDuration

        this.buildEnterPhase(scatterHold)
        this.timeline.to({}, { duration: CONFIG.holdDuration }, this.holdStart)
        this.buildExitPhase()
    }

    //Phase 1 — Scattered Entry

    buildEnterPhase(scatterHold) {
        this.cards.forEach((card, index) => {
            let pattern = CONFIG.scatterEnabled
                ? CONFIG.scatterPattern[index % CONFIG.scatterPattern.length]
                : { y: CONFIG.exitY, x: '0vw', rot: 0 }

            //Element attributes beat the pattern
            let startY = card.getAttribute('data-start-y') || pattern.y
            let startX = card.getAttribute('data-start-x') || pattern.x
            let startRotation = card.getAttribute('data-start-rot') !== null
                ? parseFloat(card.getAttribute('data-start-rot'))
                : pattern.rot

            let stagger = CONFIG.scatterEnabled && this.cards.length > 1
                ? (CONFIG.enterStaggerSpread / (this.cards.length - 1)) * index
                : 0
            let enterDelay = parseFloat(card.getAttribute('data-enter-delay')) || 0
            let cardStart = stagger + enterDelay

            //Assembly starts after scatterHold — card stands visible in scatter first
            this.timeline.fromTo(card,
                { y: startY, x: startX, rotation: startRotation },
                {
                    y: 0,
                    x: 0,
                    rotation: 0,
                    duration: CONFIG.enterDuration,
                    ease: CONFIG.enterEase,
                    force3D: true,
                },
                cardStart + scatterHold
            )

            //Fade-in runs immediately — card appears in scatter, then rides opaque
            this.timeline.fromTo(card,
                { opacity: 0 },
                {
                    opacity: 1,
                    duration: CONFIG.enterDuration * CONFIG.enterFadeRatio,
                    ease: 'power1.out',
                },
                cardStart
            )
        })
    }

    //Phase 2 — Exit

    buildExitPhase() {
        let scale = CONFIG.exitDistanceScale
        this.cards.forEach((card) => {
            let endY = this.scaleDistance(card.getAttribute('data-end-y') || CONFIG.exitY, scale)
            let exitDelay = parseFloat(card.getAttribute('data-exit-delay')) || 0

            //Slide fully past the top — no opacity needed
            this.timeline.to(card,
                { y: endY, duration: CONFIG.exitDuration, ease: CONFIG.exitEase, force3D: true },
                this.exitStart + exitDelay
            )
        })
    }

    //Mobile — One Scrub Per Card

    buildMobileDrift() {
        this.cards.forEach((card, index) => {
            //is-desktop duplicate is display: none at this width — no position to trigger from
            if (card.getClientRects().length === 0) return

            let pattern = CONFIG.scatterPattern[index % CONFIG.scatterPattern.length]
            let startY = this.scaleDistance(card.getAttribute('data-start-y') || pattern.y, CONFIG.mobileMoveScale)
            let endY = this.scaleDistance(card.getAttribute('data-end-y') || CONFIG.exitY, CONFIG.mobileMoveScale)

            this.animate(gsap.fromTo(card,
                { y: startY },
                {
                    y: endY,
                    ease: 'none',
                    force3D: true,
                    scrollTrigger: {
                        trigger: card,
                        start: CONFIG.mobileStart,
                        end: CONFIG.mobileEnd,
                        scrub: CONFIG.mobileScrub,
                    },
                }
            ))
        })
    }

    //Helpers

    //Keeps the unit — attributes are unitless px ("400"), the config is vw
    scaleDistance(value, scale) {
        let number = parseFloat(value)
        if (Number.isNaN(number)) return value
        return `${number * scale}${gsap.utils.getUnit(value)}`
    }
}
