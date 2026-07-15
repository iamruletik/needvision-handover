import { Module } from '../core/Module'

//Generic one-shot fade-in for anything tagged in Webflow with data-smooth="true"
//(Element Settings -> Custom Attributes). Hidden state and the transition live in CSS —
//JS only flips a class when the element enters the viewport. No per-frame work.

const REVEAL_SELECTOR = '[data-smooth="true"]'
const REVEALED_CLASS = 'is-revealed'
const ROOT_MARGIN = '0px 0px -15% 0px' //fires when element top passes 85% of viewport height

export class ScrollReveal extends Module {

    setup() {
        this.revealElements = [...document.querySelectorAll(REVEAL_SELECTOR)]
        if (this.revealElements.length === 0) return

        const intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return
                entry.target.classList.add(REVEALED_CLASS)
                intersectionObserver.unobserve(entry.target)
            })
        }, { rootMargin: ROOT_MARGIN })

        this.observe(intersectionObserver)
        this.revealElements.forEach((element) => intersectionObserver.observe(element))
    }
}
