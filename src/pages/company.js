import { Module } from '../core/Module'
import { StepFloater } from './company/StepFloater'
import { ImageSettle } from './company/ImageSettle'
import { SplitBlurReveal } from './company/SplitBlurReveal'
import { BlurFadeReveal } from './company/BlurFadeReveal'
import { CompanyTabs } from './company/CompanyTabs'
import { CardTilt } from './company/CardTilt'
import { CardParallax } from './company/CardParallax'
import { ImageParallax } from './company/ImageParallax'
import { StepsYearCounter } from './company/StepsYearCounter'
import { HeaderColorZones } from './company/HeaderColorZones'

//Company page — mounted only when the Barba namespace is "company"

export class CompanyPage extends Module {

    setup() {
        console.log('[page] COMPANY')

        this.children = [
            new HeaderColorZones(),
            new StepFloater(),
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
        console.log('[page] COMPANY destroyed')
    }
}
