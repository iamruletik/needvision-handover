import { Module } from '../core/Module'

//Footer "Смотреть еще раз" (.footer_action-link-2) — a same-page anchor. Safari often ignores
//native anchor jumps while Lenis owns the scroll, so the click is taken over and Lenis scrolls
//there. "#" / "#top" / a missing target = the top of the page. Links to other pages are left alone

const LINK_SELECTOR = '.footer_action-link-2'
const TOP_HASHES = ['', '#', '#top']
const MOBILE_MEDIA = '(max-width: 991px)'

export class FooterAnchorScroll extends Module {

    constructor(smoothScroll) {
        super()
        this.smoothScroll = smoothScroll
    }

    setup() {
        document.querySelectorAll(LINK_SELECTOR).forEach((link) => {
            this.listen(link, 'click', (event) => this.onClick(event, link))
        })
    }

    onClick(event, link) {
        let goesToTopOnMobile = link.closest('.content-column-left') && window.matchMedia(MOBILE_MEDIA).matches
        let href = goesToTopOnMobile ? '#top' : link.getAttribute('href') ?? ''
        let url
        try {
            url = new URL(href, window.location.href)
        } catch {
            return
        }
        let isSamePage = url.origin === window.location.origin && url.pathname === window.location.pathname
        if (!isSamePage) return

        event.preventDefault()
        event.stopPropagation() //Barba must not treat it as a navigation
        this.scrollTo(url.hash)
    }

    scrollTo(hash) {
        let target = TOP_HASHES.includes(hash) ? 0 : this.findTarget(hash) ?? 0
        let lenis = this.smoothScroll?.lenis
        if (lenis) lenis.scrollTo(target)
        else window.scrollTo({ top: typeof target === 'number' ? target : target.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' })
    }

    findTarget(hash) {
        try {
            return document.getElementById(decodeURIComponent(hash.slice(1)))
        } catch {
            return null
        }
    }
}
