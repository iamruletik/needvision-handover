import { gsap } from '../../core/gsap'
import { Module } from '../../core/Module'

//Case row fill — same wipe as the menu's large links (MenuLinks.js), but sticky: the hovered row
//keeps its fill until another row is hovered (CasesPage owns .is-active + the preview).
//The new row's fill wipes in from the edge the cursor entered through; the old row's fill
//collapses toward the new row (new one below = out through the bottom). clip-path inset, no
//layout work per frame. Each activation owns its own fill: created on enter, removed when its
//collapse finishes. A fill still wiping in is never cut — its collapse queues behind it.
//Text / logo / arrow follow .is-active in CSS (main.css "Cases Page").

const ROW_SELECTOR = '.case-row'
const ACTIVE_CLASS = 'is-active'
const FILL_CLASS = 'case-row__fill'

const FILL_DURATION = 0.5
const FILL_EASE = 'power3.out'
//Collapse starts late — without the offset the leaving and entering fills move in lockstep
//and read as one fill sliding across
const FILL_LEAVE_DURATION = FILL_DURATION
const FILL_LEAVE_EASE = FILL_EASE
const FILL_LEAVE_DELAY = 0.15

//Clip states — inset(top right bottom left)
const CLIP_FULL = 'inset(0% 0% 0% 0%)'
const CLIP_COLLAPSED_AT_TOP = 'inset(0% 0% 100% 0%)'
const CLIP_COLLAPSED_AT_BOTTOM = 'inset(100% 0% 0% 0%)'

export class CaseRowFill extends Module {

    setup() {
        this.rows = [...document.querySelectorAll(ROW_SELECTOR)]
        if (!this.rows.length) return

        this.enterTweens = new WeakMap() //fill -> its wipe-in, so a collapse can wait for it
        this.activeRow = null
        this.activeFill = null

        //Row CasesPage already activated (first one) — filled from the start, no wipe
        let initialRow = this.rows.find((row) => row.classList.contains(ACTIVE_CLASS))
        if (initialRow) {
            this.activeRow = initialRow
            this.activeFill = this.createFill(initialRow)
            gsap.set(this.activeFill, { clipPath: CLIP_FULL })
        }

        this.rows.forEach((row) => this.listen(row, 'mouseenter', (event) => this.activate(row, event)))
    }

    //Helpers

    createFill(row) {
        let fill = document.createElement('span')
        fill.className = FILL_CLASS
        fill.setAttribute('aria-hidden', 'true')
        row.prepend(fill)
        return fill
    }

    enteredFromTop(row, event) {
        let rect = row.getBoundingClientRect()
        return event.clientY < rect.top + rect.height / 2
    }

    //Animations

    activate(row, event) {
        if (row === this.activeRow) return

        let previousRow = this.activeRow
        if (this.activeFill && previousRow) {
            //DOM position, not this.rows order — CaseRowSort re-orders the list
            let isNewRowBelow = Boolean(previousRow.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING)
            this.collapseFill(this.activeFill, !isNewRowBelow)
        }

        let fill = this.createFill(row)
        this.activeRow = row
        this.activeFill = fill

        let enterTween = this.animate(gsap.fromTo(fill,
            { clipPath: this.enteredFromTop(row, event) ? CLIP_COLLAPSED_AT_TOP : CLIP_COLLAPSED_AT_BOTTOM },
            { clipPath: CLIP_FULL, duration: FILL_DURATION, ease: FILL_EASE }
        ))
        this.enterTweens.set(fill, enterTween)
    }

    //Hands a fill off: it collapses into the given edge and removes itself. A fill still wiping
    //in plays its enter out, the collapse follows straight after; a finished one waits
    //FILL_LEAVE_DELAY
    collapseFill(fill, toTop) {
        let enterTween = this.enterTweens.get(fill)
        this.enterTweens.delete(fill)
        let enterRemaining = enterTween?.isActive() ? enterTween.duration() - enterTween.time() : 0
        let leaveDelay = enterRemaining > 0 ? enterRemaining : FILL_LEAVE_DELAY

        this.animate(gsap.to(fill, {
            clipPath: toTop ? CLIP_COLLAPSED_AT_TOP : CLIP_COLLAPSED_AT_BOTTOM,
            duration: FILL_LEAVE_DURATION,
            delay: leaveDelay,
            ease: FILL_LEAVE_EASE,
            immediateRender: false,
            onComplete: () => fill.remove(),
        }))
    }

    //Cleanup

    destroy() {
        super.destroy()
        this.rows?.forEach((row) => row.querySelectorAll(`:scope > .${FILL_CLASS}`).forEach((fill) => fill.remove()))
        this.rows = []
        this.activeRow = null
        this.activeFill = null
    }
}
