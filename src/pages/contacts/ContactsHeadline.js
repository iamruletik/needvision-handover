import { Module } from '../../core/Module'
import { SplitBlurReveal } from '../company/SplitBlurReveal'

//Contacts headline, two parts:
//  1. lines rise out of masks, container un-blurs (SplitBlurReveal)
//  2. once that finishes, .white-accent fades from the headline's gray to its Webflow white,
//     word by word
//Part 2 is a class + CSS transition (main.css "Contacts Headline"): the dimmed class keeps
//the accent at `color: inherit`; removing it lets each accent word transition, delayed by
//its --accent-word-index. Class + index are re-applied on every split, so they survive
//SplitText rebuilding the span across lines on resize / font load.

const HEADLINE_SELECTOR = '.contacts_page-content-headline'
const ACCENT_SELECTOR = '.white-accent'
const DIMMED_CLASS = 'is-accent-dimmed'
const WORD_CLASS = 'contacts-headline-word'
const ACCENT_WORD_CLASS = 'is-accent-word'

export class ContactsHeadline extends Module {

    setup() {
        this.headlines = [...document.querySelectorAll(HEADLINE_SELECTOR)]
        if (this.headlines.length === 0) return

        this.headlines.forEach((headline) => headline.classList.add(DIMMED_CLASS))

        this.lineReveal = new SplitBlurReveal(HEADLINE_SELECTOR, {
            waitForScroll: false, //contacts never scrolls
            splitOptions: { type: 'words, lines', wordsClass: WORD_CLASS },
            onSplit: (headline, split) => this.indexAccentWords(split),
            onComplete: (headline) => headline.classList.remove(DIMMED_CLASS),
        }).mount()
    }

    //Accent words in reading order get 0, 1, 2… — CSS turns that into the stagger
    indexAccentWords(split) {
        split.words
            //Span around the word, or (single-word accent) the span inside it
            .filter((word) => word.closest(ACCENT_SELECTOR) || word.querySelector(ACCENT_SELECTOR))
            .forEach((word, index) => {
                word.classList.add(ACCENT_WORD_CLASS)
                word.style.setProperty('--accent-word-index', index)
            })
    }

    //Called once the screen is visible
    reveal() {
        this.lineReveal?.reveal()
    }

    destroy() {
        this.lineReveal?.destroy()
        this.lineReveal = null
        this.headlines?.forEach((headline) => headline.classList.remove(DIMMED_CLASS))
        this.headlines = []
        super.destroy()
    }
}
