# SignWriting Keyboard

Chrome extension that turns any text input tagged as a SignWriting field into one. Focusing the field opens [SignMaker](https://www.sutton-signwriting.io/signmaker/) in a modal; saving writes a SWU (SignWriting in Unicode) string back into the input and dispatches `input`/`change`.

## Field detection

An `<input>` is treated as a SignWriting field when **any** of its attribute values, trimmed and case-insensitive, equals `SignWriting`. Examples:

```html
<input placeholder="SignWriting">
<input aria-label="SignWriting">
<input data-type="SignWriting">
```

`<textarea>` is intentionally not supported. Inputs added later are picked up via a `MutationObserver`.

## Develop

```bash
npm install
npm run lint
npm test          # unit
npm run test:e2e  # Puppeteer (uses a stubbed SignMaker iframe)
npm run build     # writes dist-pkg/signwriting-keyboard-<version>.zip
```

For a manual test: `npm run serve:test`, then load this directory at `chrome://extensions` (Developer mode → Load unpacked) and open the printed URL.

## Privacy

This extension does not collect, store, or transmit any user data. There is no analytics, no telemetry, no remote logging, no background script, and no third-party SDK. The only outbound request the extension makes is loading the SignMaker page inside the modal iframe, which happens only after the user focuses a SignWriting input — and that request goes directly from the browser to `https://www.sutton-signwriting.io/signmaker/`. The values you type stay on the page you typed them into.

## Known limitations

Inline rendering of the saved sign next to the input is disabled (`RENDER_PREVIEWS = false` in `src/content.js`). `@sutton-signwriting/sgnw-components@1.1.0` reproducibly hangs the page when an `<sgnw-sign>` element exists in the DOM at the moment the custom element is upgraded — see [sgnw-components#10](https://github.com/sutton-signwriting/sgnw-components/issues/10). The repro is in `repro/`. Re-enable once the upstream fix lands.
