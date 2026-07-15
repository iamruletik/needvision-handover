import { gsap, ScrollTrigger } from '../core/gsap'
import { Module } from '../core/Module'

//Stages section. Cards lie stacked in a sticky wrapper (.stages_card._1 static,
//._2+ absolute on top); scroll progress picks the active card, transitions swap
//them with autoAlpha + a text drum (lines slide through overflow:hidden masks).
//Also: section background shift and per-image reveal/parallax scrubs.

//Scroll share per card — index 2 gets 30% of the range, others split the rest.
//Falls back to equal shares when card count differs.
const CARD_WEIGHTS = [1, 1, 1.3, 1]

//Drum transition
const LINE_EXIT_DURATION = 0.72
const LINE_EXIT_FADE_DURATION = 0.3
const LINE_ENTRY_DURATION = 0.91
const LINE_ENTRY_FADE_DURATION = 0.5
const LINE_EXIT_STAGGER = 0.045
const LINE_ENTRY_STAGGER = 0.052
const ENTRY_START = 0.26
const ENTRY_FADE_START = 0.42
const CARD_HIDE_START = 0.65

//Background shift
const BACKGROUND_COLOR = '#FFFBF2'

//Image reveals
const IMAGE_RISE = '8.33vw'
const IMAGE_BLUR_PX = 12
const IMAGE_PARALLAX_PERCENT = 6

const LINE_SELECTOR =
    '.stages_step-label-mask > .stages_step-label, ' +
    '.stages_title-mask > .stages_title, ' +
    '.stages_subtitle-mask > .stages_subtitle, ' +
    '.stages_p-mask > .stages_p-text'

export class Stages extends Module {

    setup() {
        this.section = document.querySelector('.stages')
        if (!this.section) return

        this.buildBackgroundShift()
        this.buildImageReveals()

        this.cards = [...this.section.querySelectorAll('.stages_card')]
        if (this.cards.length === 0) return

        this.cardLines = this.cards.map((card) => [...card.querySelectorAll(LINE_SELECTOR)])
        this.cardPaginations = this.cards.map((card) => card.querySelector('.stages_pagination'))
        this.currentStep = 0
        this.activeTransition = null

        this.setInitialStates()
        this.bindScrollProgress()
    }

    //Background — spotlight fades out, wrapper goes cream as the section arrives

    buildBackgroundShift() {
        const backgroundTimeline = this.animate(gsap.timeline({
            scrollTrigger: {
                trigger: this.section,
                start: 'top 85%',
                end: 'top 25%',
                scrub: true,
            },
        }))

        backgroundTimeline.to('.spotlight-overlay', { opacity: 0, duration: 0.3 }, 0)
        backgroundTimeline.to('.about-wrapper', { backgroundColor: BACKGROUND_COLOR, duration: 0.7 }, 0.3)
    }

    //Images — blur reveal on approach + slight alternating parallax

    buildImageReveals() {
        let images = [...this.section.querySelectorAll('.stages_img')]

        images.forEach((image, index) => {
            image.style.backfaceVisibility = 'hidden' //blur renders as squares on retina without this

            this.animate(gsap.fromTo(image,
                { y: IMAGE_RISE, opacity: 0, scale: 1.08, filter: `blur(${IMAGE_BLUR_PX}px)` },
                {
                    y: 0,
                    opacity: 1,
                    scale: 1,
                    filter: 'blur(0px)',
                    ease: 'power3.out',
                    scrollTrigger: {
                        trigger: image,
                        start: 'top 92%',
                        end: 'top 40%',
                        scrub: 2.5,
                    },
                }
            ))

            let parallaxShift = index % 2 === 0 ? -IMAGE_PARALLAX_PERCENT : IMAGE_PARALLAX_PERCENT
            this.animate(gsap.to(image, {
                yPercent: parallaxShift,
                ease: 'none',
                scrollTrigger: {
                    trigger: image,
                    start: 'top bottom',
                    end: 'bottom top',
                    scrub: 1.5,
                },
            }))
        })
    }

    //Card State Machine

    setInitialStates() {
        this.cards.forEach((card, index) => {
            let isFirst = index === 0
            gsap.set(card, { autoAlpha: isFirst ? 1 : 0 })
            gsap.set(this.cardLines[index], { yPercent: isFirst ? 0 : 100, opacity: isFirst ? 1 : 0 })
            if (this.cardPaginations[index]) gsap.set(this.cardPaginations[index], { autoAlpha: isFirst ? 1 : 0 })
        })
    }

    bindScrollProgress() {
        let weights = CARD_WEIGHTS.length === this.cards.length
            ? CARD_WEIGHTS
            : this.cards.map(() => 1)

        let totalWeight = weights.reduce((sum, weight) => sum + weight, 0)

        //thresholds[i] = scroll progress where card i becomes active
        this.thresholds = [0]
        for (let i = 0; i < weights.length - 1; i++) {
            this.thresholds.push(this.thresholds[i] + weights[i] / totalWeight)
        }

        this.animate(ScrollTrigger.create({
            trigger: this.section,
            start: 'top top',
            end: 'bottom bottom',
            onUpdate: (self) => {
                let index = 0
                for (let i = this.thresholds.length - 1; i >= 0; i--) {
                    if (self.progress >= this.thresholds[i]) {
                        index = i
                        break
                    }
                }
                this.transitionTo(index)
            },
        }))
    }

    transitionTo(target) {
        if (target === this.currentStep) return
        if (target < 0 || target >= this.cards.length) return

        let direction = target > this.currentStep ? 1 : -1
        let fromIndex = this.currentStep
        this.currentStep = target

        if (this.activeTransition) this.activeTransition.kill()

        //Fast scroll can skip past several thresholds — hide any orphaned cards
        this.cards.forEach((card, index) => {
            if (index === fromIndex || index === target) return
            gsap.set(card, { autoAlpha: 0 })
        })

        let exitY = direction > 0 ? -100 : 100
        let entryY = direction > 0 ? 100 : -100
        let fromLines = this.cardLines[fromIndex]
        let toLines = this.cardLines[target]

        const transition = this.animate(gsap.timeline({
            onComplete: () => { this.activeTransition = null },
        }))
        this.activeTransition = transition

        //Target card shows immediately — both cards share one slot, absolutely stacked
        transition.set(this.cards[target], { autoAlpha: 1 }, 0)

        //Pagination crossfade — fast, so two filled dots never show at once
        let fromPagination = this.cardPaginations[fromIndex]
        let toPagination = this.cardPaginations[target]
        if (fromPagination) {
            transition.to(fromPagination, { autoAlpha: 0, duration: 0.12, ease: 'power2.in', overwrite: 'auto' }, 0)
        }
        if (toPagination) {
            transition.fromTo(toPagination,
                { autoAlpha: 0 },
                { autoAlpha: 1, duration: 0.18, ease: 'power2.out', overwrite: 'auto' },
                0.1
            )
        }

        //Old lines drum out — y and opacity separated: shared tween kept opacity
        //back-loaded and old text visually collided with new
        transition.to(fromLines, {
            yPercent: exitY,
            duration: LINE_EXIT_DURATION,
            stagger: { each: LINE_EXIT_STAGGER, from: 'start' },
            ease: 'power2.in',
            overwrite: 'auto',
        }, 0)

        transition.to(fromLines, {
            opacity: 0,
            duration: LINE_EXIT_FADE_DURATION,
            stagger: { each: LINE_EXIT_STAGGER, from: 'start' },
            ease: 'power2.in',
        }, 0)

        //New lines drum in after old ones are transparent
        transition.fromTo(toLines,
            { yPercent: entryY },
            {
                yPercent: 0,
                duration: LINE_ENTRY_DURATION,
                stagger: { each: LINE_ENTRY_STAGGER, from: 'start' },
                ease: 'power2.out',
                overwrite: 'auto',
            },
            ENTRY_START
        )

        transition.fromTo(toLines,
            { opacity: 0 },
            {
                opacity: 1,
                duration: LINE_ENTRY_FADE_DURATION,
                stagger: { each: LINE_ENTRY_STAGGER, from: 'start' },
                ease: 'power2.out',
            },
            ENTRY_FADE_START
        )

        //Old card hides once its lines are behind the masks — earlier and its pagination flashes
        transition.to(this.cards[fromIndex], {
            autoAlpha: 0,
            duration: 0.32,
            ease: 'power2.in',
        }, CARD_HIDE_START)
    }
}
