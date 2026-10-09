# Chrome Web Store listing

Text for each field of the Chrome Web Store developer dashboard. The package is `emoji-fix-<version>-store.zip`, built from the extension files only.

## Store listing tab

**Summary** (from `manifest.json`, 132 characters at most):

Draws emoji with a bundled Noto Color Emoji font on Macs where Chromium browsers draw Apple Color Emoji blank.

**Description:**

On some Macs, Brave and other Chromium browsers reserve the space for each Apple emoji and draw nothing, while Safari draws the same characters normally. Emoji Fix bundles Google's Noto Color Emoji font and applies it to emoji only. All other text keeps the page's own fonts.

It works on X, including the chat and the reaction picker. X renders its chat inside a shadow root and blocks fonts loaded from other sites. Emoji Fix loads its font from inside the extension and watches open shadow roots.

What it covers:
- Emoji in page text, inputs and text areas, SVG text, and open shadow roots.
- Flags, keycaps such as 1️⃣, and skin tones.
- Rich-text editors: the font is set on the editor's container, so it does not become part of what you write.

What it does not do:
- It does not request any permissions, make network requests, or collect or store data.
- It does not change text symbols such as the trademark sign or check marks.

If emoji already draw correctly in your browser, you do not need this extension.

Emoji draw in Google's Noto design, not Apple's. Noto Color Emoji is under the SIL Open Font License 1.1. Source code, the security and bug review, and the regression page: https://github.com/mdws-org/emoji-fix

**Category:** Accessibility

**Language:** English

**Graphic assets:**
- Store icon: `icons/icon-128.png` (96 px artwork with 16 px transparent padding).
- Screenshots (1280x800): `store/screenshot-without.png`, then `store/screenshot-with.png`.
- Small promo tile (440x280): `store/promo-440x280.png`.

**Additional fields:**
- Homepage URL: https://github.com/mdws-org/emoji-fix
- Support URL: https://github.com/mdws-org/emoji-fix/issues

## Privacy tab

**Single purpose:** Draw emoji on web pages with a bundled color emoji font, for Macs where Chromium browsers draw the system emoji font as blank space.

**Host permission justification** (the content scripts match all URLs): Emoji can appear on any web page, so the content scripts run on all pages to find emoji text and set the bundled font on the elements that contain it. The scripts read only the page's text and font styles, change only the `font-family` of elements that contain emoji, and send nothing anywhere.

**Remote code:** No, I am not using remote code. All JavaScript and the font are files in the package.

**Data usage:** Select none of the data types. Certify all three statements: data is not sold to third parties, not used or transferred for purposes unrelated to the extension's purpose, and not used or transferred to determine creditworthiness or for lending.

**Privacy policy URL:** https://github.com/mdws-org/emoji-fix/blob/main/PRIVACY.md (the dashboard requires a reachable URL even though the extension does not collect user data).

## Distribution tab

- Visibility: Public.
- Regions: All regions.
- Payments: Free.
