import { Module } from '../core/Module'
import { ContactsHeadline } from './contacts/ContactsHeadline'
import { DividerReveal } from './contacts/DividerReveal'
import { FadeMoveReveal } from './contacts/FadeMoveReveal'

//Contacts page — mounted only when the Barba namespace is "contacts"
//Always exactly one screen (100vh, nothing scrolls) — every child plays on reveal()
//with waitForScroll: false. Everything starts together at reveal — no part waits for another;
//only the staggers inside a group remain.

const FORM_DURATION = 1.8
const FORM_OFFSET_Y = 100
const COLUMN_STAGGER = 0.15

export class ContactsPage extends Module {

    setup() {

        this.children = [
            new ContactsHeadline(),
            //One continuous draw — no stops waiting on the column
            new DividerReveal({ pauseScale: 1, stepTimes: [] }),
            new FadeMoveReveal('.contacts-form-wrap', { //card + its .contacts-form-part image
                waitForScroll: false,
                offsetY: FORM_OFFSET_Y,
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
    }
}
