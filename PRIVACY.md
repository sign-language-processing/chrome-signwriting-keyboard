# Privacy Policy — SignWriting Keyboard

_Last updated: 2026-05-06_

This is the privacy policy for the **SignWriting Keyboard** Chrome extension
(Chrome Web Store ID `gphbgcmncjcglnmcenleihlhdhabghpj`). It applies to use of
the extension itself.

## What we collect

**Nothing.** The extension does not collect, store, transmit, sell, or share
any information about you, your device, your browsing, or what you type. It
contains no analytics, no telemetry, no error reporting, no third-party
SDKs, and no background script.

We have no servers and no database. There is nothing for us to misplace,
subpoena, or breach.

## What the extension does on your computer

- It detects HTML `<input>` fields whose attribute value equals
  `SignWriting` (e.g. `placeholder="SignWriting"` or
  `aria-label="SignWriting"`) on pages you visit.
- It draws an "edit" button next to each such field and, when you focus the
  field or click the button, opens a modal containing an `<iframe>` pointing
  at the public SignMaker page
  (<https://www.sutton-signwriting.io/signmaker/>).
- When SignMaker sends a "save" message, the extension writes the resulting
  SignWriting (SWU) value back into the field you focused.

All of the above runs locally on your device. The contents of the field
never leave your browser at the extension's instigation.

## Network requests

The only network request the extension causes is the load of the SignMaker
page inside the modal iframe, and only after you have focused a SignWriting
field. That request is made directly by your browser to
`https://www.sutton-signwriting.io/`, governed by SignMaker's own policies.
We are not affiliated with SignMaker and we receive no information from that
request.

## Permissions

The extension declares broad host-match permissions
(`http://*/*`, `https://*/*`) so that it can detect SignWriting fields on
any site you choose to use. It does **not** request `tabs`,
`webRequest`, `cookies`, `storage`, or any other Chrome permission. It
cannot read pages you do not visit, and it does not act on inputs the host
page has not explicitly tagged as a SignWriting field.

## Children

The extension is not directed at children and does not knowingly collect
information from anyone, including children under 13.

## Changes

If this policy ever changes, the new version will be committed to this file
in the public repository at
<https://github.com/sign-language-processing/chrome-signwriting-keyboard>.
The commit history is the change log.

## Contact

Questions or concerns: amit@nagish.com.
