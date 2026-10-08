//Shared styling for SplitText line masks (mask: 'lines').
//
//Tight line-heights — glyphs overhang the line box, a plain overflow mask would cut
//them. clip-path inset with negative values extends the visible area past the box by
//`bleed` without changing layout (negative margins would collapse between lines).
//
//text-indent — inherited by every mask after the split, so only the first line keeps it.

export function styleLineMasks(masks, bleed) {
    let clip = `inset(-${bleed} -${bleed} -${bleed} -${bleed})`

    masks?.forEach((mask, index) => {
        mask.style.overflow = 'visible'
        mask.style.clipPath = clip
        mask.style.webkitClipPath = clip
        if (index > 0) mask.style.textIndent = '0'
    })
}
