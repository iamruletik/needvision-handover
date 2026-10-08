import { gsap } from '../../core/gsap'
import { Module } from '../../core/Module'

//Cards in the company cards grid tilt toward the cursor like physical 3D cards:
//the corner under the cursor presses away, card lifts slightly. quickTo smooths the
//follow so it glides instead of snapping to every mousemove. Mouse devices only.
//
//Perspective is per card (transformPerspective) — every card tilts around its own
//center instead of sharing one vanishing point at the grid center.
//Card rect is cached on enter and re-read only after a scroll — reading it on every
//move would also pick up the card's own tilt and make it jitter.

const CARD_SELECTOR = '.companypage_cards-card-grid .card-grid-item'
const POINTER_MEDIA = '(hover: hover) and (pointer: fine)'

const MAX_TILT_DEGREES = 8
const HOVER_SCALE = 1.03
const PERSPECTIVE_PX = 800
const FOLLOW_DURATION = 0.4
const FOLLOW_EASE = 'power3.out'

export class CardTilt extends Module {

    setup() {
        if (!window.matchMedia(POINTER_MEDIA).matches) return

        this.cards = [...document.querySelectorAll(CARD_SELECTOR)]
        if (this.cards.length === 0) return

        //Cached rect per hovered card — any scroll invalidates all of them
        this.rects = new Map()
        this.listen(window, 'scroll', () => this.rects.clear(), { passive: true })

        this.cards.forEach((card) => this.setupCard(card))
    }

    setupCard(card) {
        gsap.set(card, { transformPerspective: PERSPECTIVE_PX })

        let tiltX = gsap.quickTo(card, 'rotationX', { duration: FOLLOW_DURATION, ease: FOLLOW_EASE })
        let tiltY = gsap.quickTo(card, 'rotationY', { duration: FOLLOW_DURATION, ease: FOLLOW_EASE })
        let scaleTo = gsap.quickTo(card, 'scale', { duration: FOLLOW_DURATION, ease: FOLLOW_EASE })

        this.listen(card, 'mouseenter', () => {
            this.rects.set(card, card.getBoundingClientRect())
            scaleTo(HOVER_SCALE)
        })

        this.listen(card, 'mousemove', (event) => {
            let rect = this.rects.get(card)
            if (!rect) {
                rect = card.getBoundingClientRect()
                this.rects.set(card, rect)
            }
            if (!rect.width || !rect.height) return

            //-0.5 .. 0.5 from the card center
            let horizontal = (event.clientX - rect.left) / rect.width - 0.5
            let vertical = (event.clientY - rect.top) / rect.height - 0.5

            //Positive rotationY pushes the right edge away, positive rotationX the top edge
            tiltY(horizontal * 2 * MAX_TILT_DEGREES)
            tiltX(-vertical * 2 * MAX_TILT_DEGREES)
        })

        this.listen(card, 'mouseleave', () => {
            this.rects.delete(card)
            tiltX(0)
            tiltY(0)
            scaleTo(1)
        })
    }

    //Cleanup

    destroy() {
        if (this.cards?.length) {
            gsap.killTweensOf(this.cards)
            gsap.set(this.cards, { clearProps: 'transform' })
        }
        this.cards = []
        this.rects?.clear()
        super.destroy()
    }
}
