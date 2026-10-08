import { gsap } from '../../core/gsap'
import { Module } from '../../core/Module'

//Cards in the company cards grid drift on Y at different speeds while the grid
//scrolls through the viewport — scrubbed, so depth reads as parallax.
//Each card travels from +distance to -distance; bigger distance = feels closer.
//Distances cycle through CARD_DISTANCES by card index.
//Runs on `y` only — stacks with CardTilt's rotation/scale on the same element.

const GRID_SELECTOR = '.companypage_cards-card-grid'
const CARD_SELECTOR = '.card-grid-item'

const CARD_DISTANCES = ['10rem', '22rem', '6rem', '16rem']
const SCROLL_START = 'top bottom'
const SCROLL_END = 'bottom top'
const SCRUB = true

export class CardParallax extends Module {

    setup() {
        this.grid = document.querySelector(GRID_SELECTOR)
        if (!this.grid) return

        this.cards = [...this.grid.querySelectorAll(CARD_SELECTOR)]
        if (this.cards.length === 0) return

        this.cards.forEach((card, index) => {
            let distance = CARD_DISTANCES[index % CARD_DISTANCES.length]

            this.animate(gsap.fromTo(card,
                { y: distance },
                {
                    y: `-${distance}`,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: this.grid,
                        start: SCROLL_START,
                        end: SCROLL_END,
                        scrub: SCRUB,
                    },
                }
            ))
        })
    }

    //Cleanup — y only; CardTilt clears the rest of the transform

    destroy() {
        super.destroy()
        if (this.cards?.length) gsap.set(this.cards, { y: 0 })
        this.cards = []
    }
}
