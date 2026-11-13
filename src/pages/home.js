import { Module } from '../core/Module'
import { HeroReveal } from './home/HeroReveal'
import { BentoStats } from './home/BentoStats'
import { BentoGraph } from './home/BentoGraph'
import { PartnerReveal } from './home/PartnerReveal'
import { HeaderStagesInvert } from './home/HeaderStagesInvert'
import { StagesBackgroundReveal } from './home/StagesBackgroundReveal'
import { SplitBlurReveal } from '../modules/SplitBlurReveal'
import { LoopSlider } from '../modules/LoopSlider'
import { FadeMoveReveal } from './contacts/FadeMoveReveal'
import { StepFloater } from '../modules/StepFloater'
import { SceneScrollTimeline, HERO_IMAGE_REVEAL } from './home/SceneScrollTimeline'
import { ImageParallax } from './company/ImageParallax'

//Manifesto lead text rises word by word — ~30 words, so a tight stagger
const MANIFESTO_WORD_STAGGER = 0.03
//Desktop / mobile versions of the lead — Webflow shows one per breakpoint
const MANIFESTO_LEAD_SELECTOR = '.manifesto_lead-text, .manifesto-mobile-header'
const MANIFESTO_LEAD_START = 'top 90%'
//Mobile stages — four static cards (desktop swaps one card's text, Stages.js)
const STAGES_MOBILE_TEXT_SELECTOR = [
    '.stages.is-mobile .stages_step-label',
    '.stages.is-mobile .stages_title',
    '.stages.is-mobile .stages_subtitle',
    '.stages.is-mobile .stages_p-text',
].join(', ')
const STAGES_MOBILE_MEDIA = '(max-width: 991px)'
//Step floater — section at viewport center → counter + name; hidden steps fade it out.
//.stages resolves to the rendered copy (desktop / mobile)
const FLOATER_STEPS = [
    { section: '.hero', hidden: true },
    { section: '.manifesto', counter: '1', name: 'Манифест' },
    { section: '.section-logo', counter: '2', name: 'Партнёры' },
    { section: '.section-cases', counter: '3', name: 'Кейсы' },
    { section: '.partner', hidden: true },
    { section: '.stages', counter: '4', name: 'Процесс' },
    { section: '.team', counter: '5', name: 'Команда' },
]
//Hidden once half the footer is uncovered — the spacer's middle reaches the viewport bottom.
//Not 'bottom bottom': the spacer ends the page, so that point is max scroll and may never be hit
const FLOATER_HIDE_TRIGGER = '.pre-footer-offset'
const FLOATER_HIDE_START = 'center bottom'
//Cases backgrounds (CasesSlider fades between them) drift like the company images. The section is
//sticky, so the drift runs until .partner has covered it, not until its own bottom passes
const CASES_BACKGROUND_SELECTOR = '.case_bg-image'
const CASES_PARALLAX_END_TRIGGER = '.partner'
const CASES_PARALLAX_END = 'top top'
const CASES_PARALLAX_SCALE_FROM = 1 //grows to ImageParallax's 1.2 over the same scroll

//Home page — mounted only when the Barba namespace is "home"

export class HomePage extends Module {

    setup() {

        //Only the rendered version — a display: none element can't be split or triggered properly
        let manifestoLead = [...document.querySelectorAll(MANIFESTO_LEAD_SELECTOR)]
            .filter((element) => element.getClientRects().length > 0)
        let stagesMobileText = [...document.querySelectorAll(STAGES_MOBILE_TEXT_SELECTOR)]
            .filter((element) => element.getClientRects().length > 0)

        this.children = [
            new HeroReveal(),
            new BentoStats(),
            new BentoGraph(),
            //Labels around the hero image — same trigger as HeroImageReveal, so they come in as it expands
            new SplitBlurReveal('.hero_feature-label', {
                trigger: HERO_IMAGE_REVEAL.trigger,
                start: HERO_IMAGE_REVEAL.start,
            }),
            //Manifesto — lead text (sticky header) and body paragraph, each on its own scroll trigger.
            //Lead lines are Webflow spans with padding-left indents, one span per line
            new SplitBlurReveal(manifestoLead, { by: 'words', stagger: MANIFESTO_WORD_STAGGER, start: MANIFESTO_LEAD_START }),
            //3D scene progress from the sections — city over hero-main, video over hero-image, its end over manifesto
            new SceneScrollTimeline(),
            new SplitBlurReveal('.manifesto_p-text'),
            new FadeMoveReveal('.manifesto_action', { offsetY: 0 }),
            //Logo section — the huge statement, the paragraph under it (markers: SectionMarkerReveal)
            new SplitBlurReveal('.section-logo .huge-logo_text'),
            new SplitBlurReveal('.section-logo .logo_text-wrap .logo_p-text'),
            new FadeMoveReveal('.section-logo .button-grey', { offsetY: 0 }),
            new ImageParallax(CASES_BACKGROUND_SELECTOR, {
                trigger: (image) => image.closest('.section-cases'),
                endTrigger: CASES_PARALLAX_END_TRIGGER,
                end: CASES_PARALLAX_END,
                scaleFrom: CASES_PARALLAX_SCALE_FROM,
            }),
            new PartnerReveal(),
            new HeaderStagesInvert(),
            new StagesBackgroundReveal(),
            //Mobile stages — each card's text on its own scroll, cascading top to bottom; image row swipes
            new SplitBlurReveal(stagesMobileText),
            new LoopSlider('.stage-slider-mobile', { media: STAGES_MOBILE_MEDIA }),
            new StepFloater(FLOATER_STEPS, { hideTrigger: FLOATER_HIDE_TRIGGER, hideStart: FLOATER_HIDE_START }),
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
