import { Module } from '../core/Module'
import { StepFloater } from '../modules/StepFloater'
import { ImageSettle } from './company/ImageSettle'
import { SplitBlurReveal } from '../modules/SplitBlurReveal'
import { BlurFadeReveal } from './company/BlurFadeReveal'
import { CompanyTabs } from './company/CompanyTabs'
import { CardTilt } from './company/CardTilt'
import { CardParallax } from './company/CardParallax'
import { ImageParallax } from './company/ImageParallax'
import { StepsYearCounter } from './company/StepsYearCounter'
import { HeaderColorZones } from './company/HeaderColorZones'

//Step floater — section at viewport center → counter + name
const FLOATER_STEPS = [
    { section: '.companypage_hero', counter: '•', name: 'О компании' },
    { section: '.companypage_tabs-section', counter: '1', name: 'Услуги' },
    { section: '.companypage_steps-container', counter: '2', name: 'Как появились' },
    { section: '.companypage_cards-wrapper', counter: '3', name: 'Кейсы' },
]
const FLOATER_HIDE_TRIGGER = '.companypage_cards-wrapper'

//Company page — mounted only when the Barba namespace is "company"

export class CompanyPage extends Module {

    setup() {

        this.children = [
            new HeaderColorZones(),
            new StepFloater(FLOATER_STEPS, { hideTrigger: FLOATER_HIDE_TRIGGER }),
            new ImageSettle(),
            new ImageParallax('.companypage_image-container-image', {
                trigger: (image) => image.closest('.companypage_image'),
            }),
            //Wrapper is position:fixed — drive it from its clip-path parent, which scrolls
            new ImageParallax('.companypage_step-content-image', {
                trigger: (image) => image.closest('.companypage_step-content-image-wrapper')?.parentElement,
            }),
            new SplitBlurReveal('.companypage_heading'),
            new SplitBlurReveal(
                '.companypage_step-content .companypage_content-text-label, ' +
                '.companypage_step-content .companypage_content-text-headline, ' +
                '.companypage_step-content .companypage_content-text-overview'
            ),
            new SplitBlurReveal('.companypage_cards-headline > div', {
                trigger: '.companypage_cards-wrapper',
                start: 'top center',
            }),
            new BlurFadeReveal('.companypage_hero-svg'),
            new CompanyTabs(),
            new StepsYearCounter(),
            new CardTilt(),
            new CardParallax(),
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
