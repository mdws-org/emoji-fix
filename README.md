# Emoji Fix

A Chromium extension for Macs where Brave and other Chromium browsers draw emoji as blank space. It bundles Google's Noto Color Emoji font and applies it to the emoji on every page, including X's chat and reaction picker.

## The bug

On the Mac this was built on, Brave draws nothing for any character from Apple Color Emoji. The browser finds the font and reserves the width of each emoji, but no pixels are drawn. A test page measured 0 inked pixels for an emoji drawn in Apple Color Emoji, against 1,961 in Safari on the same machine. The bug has been present for years across Brave, Brave Beta and Brave Origin, and it also occurs in a new, empty browser profile. Text in other fonts and emoji from web fonts draw normally.

The cause is not known. These were ruled out: profile settings, extensions, Shields fingerprinting protection, GPU rasterization (the CPU canvas path is also blank), a stale font cache, user-installed fonts that cover emoji code points, Font Book, configuration profiles and browser policies, and the Fontations font backend.

If emoji draw correctly in your browser, you do not need this extension.

## Font injection and shadow roots

- Declares an `@font-face` for the bundled font. The `unicode-range` covers emoji code points only, so all other text keeps the page's fonts.
- Puts the bundled font at the front of the `font-family` of each element whose text contains an emoji, and watches the page for new emoji. An emoji here is a character that defaults to emoji presentation (this includes flags and skin tones), a pictograph followed by U+FE0F, or a keycap such as 1️⃣. Text symbols such as the trademark sign or a check mark are not changed.
- Gives keycap digits the bundled font only in elements that contain a keycap, so that other digits keep the page's font.
- In a rich-text editor (`contenteditable`), sets the font on the editing host and not on the edited content, so that the style does not become part of the document.
- Scans open shadow roots and watches them. X renders its chat inside a shadow root. A small script in the page's own JavaScript context (`shadow-hook.js`) reports each new open shadow root to the extension.
- Loads the font from inside the extension. Chromium exempts extension resources from a page's Content-Security-Policy, so sites that restrict font sources cannot block it. The font URL changes every browser session (`use_dynamic_url`), so a page cannot probe for the extension by a fixed ID.

The extension does not request permissions, make network requests or store data. A page can still tell that it is running, because the injected `@font-face` and the inline `font-family` values are visible in the page.

## Emoji Swap and X

[Emoji Swap](https://chromewebstore.google.com/detail/emoji-swap/ggjmjkeaeojfdcbafefloifeaepeaeah) solves the same problem with a choice of emoji fonts, and it works on most sites. It does not work on X: it loads its fonts from jsDelivr, which X's Content-Security-Policy blocks because it allows fonts only from X's own servers, and it does not look inside shadow roots. Emoji Fix bundles its font and scans shadow roots, so emoji appear on X, including the chat and the reaction picker.

## Install

1. Download this repository and unzip it, or clone it.
2. Open `brave://extensions` (or `chrome://extensions`).
3. Turn on Developer mode.
4. Click Load unpacked and select the repository folder.
5. Reload any open tabs.

Each browser profile needs its own installation. If you also use Emoji Swap, turn it off so that the two extensions do not both set fonts on the same text.

After you change the files, click the reload arrow on the extension's card in `brave://extensions`, because disabling and enabling the extension does not reread them.

## Limits

- Emoji draw in Google's Noto design, not Apple's.
- The font adds 2.0 MB, read from disk for each page that contains emoji.
- A text symbol in the same element as an emoji, as in "Brand™ 😀", also takes the Noto glyph.
- The page's font stack is read once per element. If the page later changes that element's font, the element keeps the earlier stack.
- Closed shadow roots cannot be reached, so emoji inside them stay blank.
- Text in `<canvas>`, in CSS `content`, and in `about:blank` frames that the parent page fills by script is not changed.
- Requires Chromium 119 or later.

## Review

`review/` holds the security and bug review of version 1.3.0: the brief, the reply from each of the seven reviewing models, and `review/synthesis-r1.md`, which lists each finding as fixed, refuted or accepted, with the test behind it. `review/probes/regression.html` is the regression page. To run it, serve the folder with `python3 review/probes/srv.py review/probes`, open http://127.0.0.1:8768/regression.html in a browser with the extension loaded, and read `review/probes/report.txt` after five seconds.

## Font

`fonts/NotoColorEmoji.woff2` is `2D/fonts/Noto-COLRv1.ttf` from [googlefonts/noto-emoji](https://github.com/googlefonts/noto-emoji) at commit `1ffdd21` (version 2.057), converted to WOFF2 with fontTools:

```sh
uv run --with 'fonttools[woff]' python -c "
from fontTools.ttLib import TTFont
f = TTFont('Noto-COLRv1.ttf'); f.flavor = 'woff2'; f.save('NotoColorEmoji.woff2')"
```

## Licenses

The extension code is under the MIT license in `LICENSE`. Noto Color Emoji is under the SIL Open Font License 1.1, reproduced in `fonts/OFL.txt`.
