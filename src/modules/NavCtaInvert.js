import { gsap, ScrollTrigger } from '../core/gsap'
import { Module } from '../core/Module'

//Floating CTA button (.nav-cta__btn) theme by section, priority: dark > orange > white.
//dark   — anywhere inside .about-wrapper (and everything below it)
//orange — sections tagged .is-orange-nav in Webflow (add the class, no JS changes needed)
//white  — default
//Styles go inline with !important so Webflow CSS/hover states never win.

const THEMES = {
    white: { background: '#ffffff', textColor: '#000000' },
    orange: { background: '#FF6038', textColor: '#ffffff' },
    dark: { background: '#040101', textColor: '#ffffff' },
}
const FADE_DURATION = 0.4
//Matches the compressed nav height — theme flips when a section passes under the plate
const TRIGGER_OFFSET = '5.56vw'

export class NavCtaInvert extends Module {

    setup() {
        this.button = document.querySelector('.nav-cta__btn')
        if (!this.button) return

        this.activeOrangeSections = new Set()
        this.isInDarkZone = false
        this.currentTheme = 'white'
        this.applyScheduled = false
        this.activeTween = null

        this.applyThemeInstantly('white')
        this.watchOrangeSections()
        this.watchDarkZone()
    }

    //Theme Application

    applyThemeInstantly(name) {
        this.button.style.setProperty('background-color', THEMES[name].background, 'important')
        this.button.style.setProperty('color', THEMES[name].textColor, 'important')
    }

    applyTheme() {
        let next = this.isInDarkZone
            ? 'dark'
            : (this.activeOrangeSections.size > 0 ? 'orange' : 'white')

        if (next === this.currentTheme) return
        this.currentTheme = next

        //GSAP can't tween inline !important styles directly — lerp colors on a proxy and write them each frame
        let backgroundLerp = gsap.utils.interpolate(getComputedStyle(this.button).backgroundColor, THEMES[next].background)
        let textLerp = gsap.utils.interpolate(getComputedStyle(this.button).color, THEMES[next].textColor)

        if (this.activeTween) this.activeTween.kill()

        let proxy = { progress: 0 }
        this.activeTween = this.animate(gsap.to(proxy, {
            progress: 1,
            duration: FADE_DURATION,
            ease: 'power2.out',
            onUpdate: () => {
                this.button.style.setProperty('background-color', backgroundLerp(proxy.progress), 'important')
                this.button.style.setProperty('color', textLerp(proxy.progress), 'important')
            },
        }))
    }

    //Several triggers can toggle in one scroll frame — apply once per frame
    scheduleApply() {
        if (this.applyScheduled) return
        this.applyScheduled = true
        this.frame(() => {
            this.applyScheduled = false
            this.applyTheme()
        })
    }

    //Zone Watchers

    watchOrangeSections() {
        gsap.utils.toArray('.is-orange-nav').forEach((section) => {
            this.animate(ScrollTrigger.create({
                trigger: section,
                start: `top ${TRIGGER_OFFSET}`,
                end: `bottom ${TRIGGER_OFFSET}`,
                onToggle: (self) => {
                    self.isActive ? this.activeOrangeSections.add(section) : this.activeOrangeSections.delete(section)
                    this.scheduleApply()
                },
            }))
        })
    }

    watchDarkZone() {
        let aboutWrapper = document.querySelector('.about-wrapper')
        if (!aboutWrapper) return

        //end is a function with a huge margin — covers a .footer living outside .about-wrapper
        this.animate(ScrollTrigger.create({
            trigger: aboutWrapper,
            start: `top ${TRIGGER_OFFSET}`,
            end: () => `+=${document.documentElement.scrollHeight}`,
            invalidateOnRefresh: true,
            onToggle: (self) => {
                this.isInDarkZone = self.isActive
                this.scheduleApply()
            },
        }))
    }
}
