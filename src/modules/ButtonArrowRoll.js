import { IconRoll } from './IconRoll'

//Arrow drum on .button-clear / .button-grey hover — IconRoll's DOM, horizontal CSS (main.css
//"Button Arrow"). Page module: the buttons live in the Barba container

const ARROW_SELECTOR = [
    '.button-clear .arrow',
    '.button-grey .arrow',
    '.casepage_hero-back .casepage_chip .button_icon',
].join(', ')
const CLASS_PREFIX = 'button-arrow-roll'

export class ButtonArrowRoll extends IconRoll {

    constructor() {
        super(ARROW_SELECTOR, CLASS_PREFIX)
    }
}
