import { gsap } from '../../core/gsap'
import { Module } from '../../core/Module'
import { REVEAL_BLUR_PX, REVEAL_DURATION, REVEAL_STAGGER, REVEAL_EASE } from './CaseRowsReveal'
import { SortTabIndicator } from './SortTabIndicator'

//Cases list sort tabs (.filter-tabs_btn with data-sort in Webflow). Re-appends the rows in
//.cases-page_list in the chosen order:
//  services — by .case-row_tags text, alphabetical
//  clients  — by the row's data-client (set in Webflow per row — logos carry no text)
//Ties keep the Webflow order. Default sort applied on mount, under the preloader / eye, no
//animation. A tab click: rows blur + fade out one after another (top to bottom), get re-ordered
//while hidden, then come back with the page intro's reveal (CaseRowsReveal values).
//A click mid-animation restarts from wherever the rows are — no queue, no lock.
//Active tab gets ACTIVE_CLASS + aria-pressed (Webflow combo filter-tabs_btn.is-active: black /
//white, same as the pressed state).

const LIST_SELECTOR = '.cases-page_list'
const ROW_SELECTOR = '.case-row'
const TAB_SELECTOR = '.filter-tabs_btn[data-sort]'
const TABS_CONTAINER_SELECTOR = '.filter-tabs'
const TAGS_SELECTOR = '.case-row_tags'
const CLIENT_ATTRIBUTE = 'data-client'
const ACTIVE_CLASS = 'is-active'
const SORT_LOCALE = 'ru'

const DEFAULT_SORT = 'services'

//Out — quicker than the reveal, so the click answers right away
const HIDE_DURATION = 0.4
const HIDE_STAGGER = 0.05
const HIDE_EASE = 'power2.in'

const SORT_KEYS = {
    services: (row) => row.querySelector(TAGS_SELECTOR)?.textContent.trim() ?? '',
    clients: (row) => row.getAttribute(CLIENT_ATTRIBUTE)?.trim() ?? '',
}

export class CaseRowSort extends Module {

    setup() {
        this.list = document.querySelector(LIST_SELECTOR)
        if (!this.list) return

        this.rows = [...this.list.querySelectorAll(`:scope > ${ROW_SELECTOR}`)]
        this.tabs = [...document.querySelectorAll(TAB_SELECTOR)]
        if (this.rows.length < 2) return

        this.originalIndex = new Map(this.rows.map((row, index) => [row, index]))
        this.sortTween = null
        this.indicator = new SortTabIndicator(document.querySelector(TABS_CONTAINER_SELECTOR)).mount()
        this.tabs.forEach((tab) => this.listen(tab, 'click', (event) => {
            event.preventDefault()
            this.sortAnimated(tab.dataset.sort)
        }))

        this.sortBy(DEFAULT_SORT)
        this.activateTopRow()
    }

    //CasesPage (global, mounted earlier) pre-activated the first row in Webflow order — after the
    //default sort that row may sit lower. Re-activated through the rows' own hover path so
    //CasesPage moves .is-active + the preview; CaseRowFill mounts after this and fills that row
    activateTopRow() {
        let topRow = this.list.querySelector(`:scope > ${ROW_SELECTOR}`)
        if (!topRow || topRow.classList.contains(ACTIVE_CLASS)) return
        let rect = topRow.getBoundingClientRect()
        topRow.dispatchEvent(new MouseEvent('mouseenter', { clientX: rect.left, clientY: rect.top }))
    }

    //Helpers

    rowsInDomOrder() {
        return [...this.list.querySelectorAll(`:scope > ${ROW_SELECTOR}`)]
    }

    setActiveTab(sortName) {
        this.tabs.forEach((tab) => {
            let isActive = tab.dataset.sort === sortName
            tab.classList.toggle(ACTIVE_CLASS, isActive)
            tab.setAttribute('aria-pressed', String(isActive))
            if (isActive) this.indicator?.moveTo(tab)
        })
    }

    //Instant re-order. Returns false when there's nothing to do
    sortBy(sortName) {
        let sortKey = SORT_KEYS[sortName]
        if (!sortKey || sortName === this.currentSort) return false
        this.currentSort = sortName

        let sorted = [...this.rows].sort((rowA, rowB) =>
            sortKey(rowA).localeCompare(sortKey(rowB), SORT_LOCALE, { sensitivity: 'base' })
            || this.originalIndex.get(rowA) - this.originalIndex.get(rowB))
        sorted.forEach((row) => this.list.appendChild(row))

        this.setActiveTab(sortName)
        return true
    }

    //Animations

    //Tab switches at once; rows out -> re-order -> rows in. Clicking the tab whose order is
    //already in place (e.g. back during the fade-out) just brings the rows back
    sortAnimated(sortName) {
        if (!SORT_KEYS[sortName]) return
        let isAnimating = Boolean(this.sortTween?.isActive())
        if (sortName === this.currentSort && !isAnimating) return

        this.setActiveTab(sortName)
        this.sortTween?.kill()

        if (sortName === this.currentSort) {
            this.showRows()
            return
        }

        this.sortTween = this.animate(gsap.to(this.rowsInDomOrder(), {
            autoAlpha: 0,
            filter: `blur(${REVEAL_BLUR_PX}px)`,
            duration: HIDE_DURATION,
            stagger: HIDE_STAGGER,
            ease: HIDE_EASE,
            overwrite: 'auto', //a click during the page intro takes the rows over from it
            onComplete: () => {
                this.sortBy(sortName)
                this.showRows()
            },
        }))
    }

    //Page intro's reveal, in the current DOM order
    showRows() {
        this.sortTween = this.animate(gsap.to(this.rowsInDomOrder(), {
            autoAlpha: 1,
            filter: 'blur(0px)',
            duration: REVEAL_DURATION,
            stagger: REVEAL_STAGGER,
            ease: REVEAL_EASE,
            onComplete: () => gsap.set(this.rows, { clearProps: 'filter' }),
        }))
    }

    destroy() {
        super.destroy()
        this.indicator?.destroy()
        this.indicator = null
        this.tabs?.forEach((tab) => {
            tab.classList.remove(ACTIVE_CLASS)
            tab.removeAttribute('aria-pressed')
        })
        this.currentSort = null
    }
}
