# SignWriting Keyboard

Chrome extension that turns any text input tagged as a SignWriting field into one. Focusing the field opens [SignMaker](https://www.sutton-signwriting.io/signmaker/) in a modal; saving writes a SWU (SignWriting in Unicode) string back into the input and dispatches `input`/`change`.

## Field detection

An `<input>` is treated as a SignWriting field when **any** of the following equals `SignWriting` (trimmed, case-insensitive; a trailing required-marker `*` is ignored):

- one of the input's own attribute values, e.g. `placeholder`, `aria-label`, `data-type`
- the text of the element(s) referenced by `aria-labelledby`
- the text of an associated `<label for="…">`

```html
<input placeholder="SignWriting">
<input aria-label="SignWriting">
<input data-type="SignWriting">
<label for="sw">SignWriting</label><input id="sw">
<p id="t">SignWriting *</p><input aria-labelledby="t">
```

The last form covers Google Forms questions titled "SignWriting", which expose the title via `aria-labelledby` rather than tagging the input directly.

`<textarea>` is intentionally not supported. Inputs added later are picked up via a `MutationObserver`.

## Inline preview

Once an input has a SWU value (either saved from SignMaker or pre-filled by the page), the extension renders the sign as inline SVG next to the input. Rendering uses [`@sutton-signwriting/font-ttf`](https://github.com/sutton-signwriting/font-ttf) — the JS API returns SVG directly, so no custom-element upgrade path is involved (the [`sgnw-components` upgrade-time hang](https://github.com/sutton-signwriting/sgnw-components/issues/10) reproduced in `repro/` is avoided entirely). The TTF fonts are bundled with the extension; nothing is fetched over the network for preview rendering.

## Develop

```bash
npm install
npm run vendor     # copies font-ttf JS + TTFs into vendor/ (auto-run by build/test:e2e)
npm run lint
npm test           # unit
npm run test:e2e   # Puppeteer (uses a stubbed SignMaker iframe)
npm run test:smoke # hits live external sites (Google Forms); not run in CI
npm run build      # writes dist-pkg/signwriting-keyboard-<version>.zip
```

For a manual test: `npm run serve:test`, then load this directory at `chrome://extensions` (Developer mode → Load unpacked) and open the printed URL. `npm run vendor` must have run at least once first so `vendor/` exists for the unpacked load.

## Privacy

The extension collects, stores, and transmits nothing. No analytics, no telemetry, no background script, no third-party SDK. The only network request it triggers is the SignMaker iframe load, only after you focus a SignWriting input. Preview rendering uses fonts bundled in the extension itself — no network. Full policy in [PRIVACY.md](./PRIVACY.md).
