# Web Store listing copy

Paste-ready text for the Chrome Web Store dev console. Each block goes into the dev-console field listed in its heading.

---

## Account → Settings

### Contact email

```
amit@nagish.com
```

(Click "Verify" after saving and confirm the link Google sends.)

### Privacy policy URL

```
https://github.com/sign-language-processing/chrome-signwriting-keyboard/blob/main/PRIVACY.md
```

---

## Store listing tab

### Language

```
English (United States)
```

### Category

```
Productivity
```

### Short description

```
Type SignWriting in any input tagged as a SignWriting field. Opens SignMaker as an on-screen keyboard.
```

### Detailed description

```
SignWriting Keyboard turns any text input that's been marked as a SignWriting field — for example with placeholder="SignWriting" or aria-label="SignWriting" — into a SignWriting-aware input. Focusing the field opens SignMaker (https://www.sutton-signwriting.io/signmaker/), the standard on-screen keyboard for Sutton SignWriting, in a modal. When you click Save in SignMaker, the resulting SWU (SignWriting in Unicode) string is written back into the input.

Useful for SignWriting researchers, sign language linguists, deaf community tooling, and any web form that needs to capture signs.

The extension does not collect, store, or transmit any user data. It runs entirely on the page where you typed.
```

### Screenshots

Upload all three, in order, from `store-assets/`:

1. `screenshot-1-fields.png` — host page with edit buttons next to recognized inputs
2. `screenshot-2-modal.png` — modal open with SignMaker keyboard
3. `screenshot-3-after-save.png` — input populated with SWU after save

---

## Privacy practices tab

### Single purpose

```
Adds an on-screen SignWriting keyboard to text inputs that the host page has marked as a SignWriting field, so users can type in Sutton SignWriting.
```

### Permission justification — host permission (`<all_urls>` content-script match)

```
The extension inserts an edit button and modal on inputs whose attribute equals "SignWriting". Because we can't know in advance which sites use SignWriting fields, the content script must be allowed on any HTTP/HTTPS page. It only acts on inputs the page has explicitly tagged, never others, and never reads or transmits any data.
```

### Permission justification — remote code use

```
The extension does not load or execute remote code. The only remote resource is the SignMaker page (https://www.sutton-signwriting.io/signmaker/), loaded inside an iframe and only after the user focuses a SignWriting input. The extension does not read or evaluate code from inside that iframe; communication is limited to a single postMessage save event that contains the SignWriting value.
```

### Data usage certifications (check all three)

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

### Data collection — "Does this item collect…?"

Leave **all** categories **unchecked**. The extension collects nothing.

---

## After all of the above

Click **Submit for review** at the bottom of the listing page. First-time review usually takes 1–7 days.
