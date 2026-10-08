import { Module } from '../core/Module'
import { ContactsHeadline } from './contacts/ContactsHeadline'
import { DividerReveal } from './contacts/DividerReveal'
import { FadeMoveReveal } from './contacts/FadeMoveReveal'

//Contacts page — mounted only when the Barba namespace is "contacts"
//Always exactly one screen (100vh, nothing scrolls) — every child plays on reveal()
//with waitForScroll: false; the sequence is pure timing, set below.

//Form rises first; the column-2 items start once it has visibly landed —
//expo.out covers most of its distance in the first ~60% of the duration
const FORM_DELAY = 0.3
const FORM_DURATION = 1.8
const FORM_OFFSET_Y = 100
const FORM_SETTLED_FRACTION = 0.35
const COLUMN_DELAY = FORM_DELAY + FORM_DURATION * FORM_SETTLED_FRACTION
const COLUMN_STAGGER = 0.15

//Divider draws to half, then the rest in 3 steps — each starting with a column-2 item
const DIVIDER_STEP_COUNT = 3
const DIVIDER_STEP_TIMES = Array.from({ length: DIVIDER_STEP_COUNT }, (_, index) => COLUMN_DELAY + index * COLUMN_STAGGER)

export class ContactsPage extends Module {

    setup() {
        console.log('[page] CONTACTS')

        this.children = [
            new ContactsHeadline(),
            new DividerReveal({ pauseScale: 0.5, stepTimes: DIVIDER_STEP_TIMES }),
            new FadeMoveReveal('.contacts-form', {
                waitForScroll: false,
                offsetY: FORM_OFFSET_Y,
                delay: FORM_DELAY,
                duration: FORM_DURATION,
            }),
            //Column children, except .content-column-left is swapped for its own two children —
            //querySelectorAll returns them in DOM order, so the stagger reads top to bottom
            new FadeMoveReveal(
                '.content-top-column-2 > :not(.content-column-left), ' +
                '.content-top-column-2 > .content-column-left > *', {
                waitForScroll: false,
                offsetY: 0,
                duration: 0.5,
                delay: COLUMN_DELAY,
                stagger: COLUMN_STAGGER,
                ease: 'power2.out',
            }),
            new FadeMoveReveal('.content-bottom-column-1 > *', {
                waitForScroll: false,
                offsetY: 'viewportBottom',
                duration: 1.4,
                stagger: 0.15,
                ease: 'expo.out',
            }),
            new FadeMoveReveal('.content-bottom-button-group a', {
                waitForScroll: false,
                offsetY: 'viewportBottom',
                duration: 1.4,
                stagger: 0.15,
                ease: 'expo.out',
            }),
        ].map((child) => child.mount())
    }

    //Called by main.js once the preloader / eye transition has finished
    reveal() {
        this.children?.forEach((child) => child.reveal?.())
    }

    destroy() {
        this.children?.forEach((child) => child.destroy())
        this.children = []
        super.destroy()
        console.log('[page] CONTACTS destroyed')
    }
}
