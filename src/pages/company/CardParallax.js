import { gsap } from '../../core/gsap'
import { Module } from '../../core/Module'

//Cards in the company cards grid drift on Y at different speeds while the grid
//scrolls through the viewport — scrubbed, so depth reads as parallax.
//Each card travels from +distance to -distance; bigger distance = feels closer.
//Distances cycle through CARD_DISTANCES by card index.
//Runs on `y` only — stacks with CardTilt's rotation/scale on the same element.

const GRID_SELECTOR = '.companypage_cards-card-grid'
const CONTENT_SELECTOR = '.companypage_cards-content'
const WRAPPER_SELECTOR = '.companypage_cards-wrapper'
const HEADLINE_SELECTOR = '.companypage_cards-headline'
const CONTENT_HEIGHT_PROPERTY = '--company-cards-content-height'
const HEADLINE_HEIGHT_PROPERTY = '--company-cards-headline-height'
const CARD_SELECTOR = '.card-grid-item'

const CARD_DISTANCES = ['10rem', '22rem', '6rem', '16rem']

//≤991 the grid is one column — neighbours close in by their distance difference at one end of
//the scroll, so adjacent differences stay under the 4rem Webflow row gap (medium).
//Checked once at load, like the other ≤991 modules
const MOBILE_MEDIA = '(max-width: 991px)'
const MOBILE_CARD_DISTANCES = ['2rem', '5rem', '3rem', '5.5rem']

const SCROLL_START = 'top bottom'
const SCROLL_END = 'bottom top'
const SCRUB = true

export class CardParallax extends Module {

    setup() {
        this.grid = document.querySelector(GRID_SELECTOR)
        if (!this.grid) return

        this.cards = [...this.grid.querySelectorAll(CARD_SELECTOR)]
        if (this.cards.length === 0) return

        this.content = this.grid.closest(CONTENT_SELECTOR)
        let wrapper = this.content?.closest(WRAPPER_SELECTOR)
        let headline = wrapper?.querySelector(HEADLINE_SELECTOR)
        if (headline) {
            let updateStickyHeights = () => {
                this.content.style.setProperty(CONTENT_HEIGHT_PROPERTY, `${this.content.offsetHeight}px`)
                this.content.style.setProperty(HEADLINE_HEIGHT_PROPERTY, `${headline.offsetHeight}px`)
            }
            updateStickyHeights()
            let observer = this.observe(new ResizeObserver(updateStickyHeights))
            observer.observe(this.content)
            observer.observe(headline)
        }

        let distances = window.matchMedia(MOBILE_MEDIA).matches ? MOBILE_CARD_DISTANCES : CARD_DISTANCES

        this.cards.forEach((card, index) => {
            let distance = distances[index % distances.length]

            this.animate(gsap.fromTo(card,
                { y: distance },
                {
                    y: `-${distance}`,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: headline ? wrapper : this.grid,
                        start: headline ? () => {
                            let gridOffset = this.grid.getBoundingClientRect().top - this.content.getBoundingClientRect().top
                            return `top+=${gridOffset} bottom`
                        } : SCROLL_START,
                        end: headline ? () => {
                            let stickyDistance = Math.max(0, this.content.offsetHeight - headline.offsetHeight)
                            return Math.max(0, wrapper.getBoundingClientRect().top + window.scrollY + stickyDistance)
                        } : SCROLL_END,
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
        this.content?.style.removeProperty(CONTENT_HEIGHT_PROPERTY)
        this.content?.style.removeProperty(HEADLINE_HEIGHT_PROPERTY)
        this.cards = []
    }
}
