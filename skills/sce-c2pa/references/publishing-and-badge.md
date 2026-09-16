# Publish a signed image with the Content Credentials badge

The documented `<c2pa-image>` web component, version `1.0.0`, verifies an already signed image in the browser and displays a Content Credentials badge and panel. It does not upload or sign files, require the SCE API key, or provide a general verification endpoint for other media.

Load this versioned script once per page:

```text
https://cdn-01.azureedge.net/$web/c2pa/1.0.0/c2pa-cr-badge.js
```

The `$web` segment is literal. Quote the URL when used in a shell so `$web` is not expanded as a variable. Do not replace the version with an undocumented `latest` alias.

## Publish the correct bytes

1. Wait for the SCE job to reach `signed` and download the signed output.
2. Publish that output on a stable image URL. A temporary download SAS can expire while a page remains public.
3. Prevent hosting/CDN transformations that recompress, resize, crop, convert to WebP/AVIF, strip metadata, or substitute an unsigned thumbnail.
4. Make the image readable to the browser verifier. For cross-origin images, configure CORS on the image host, including the final redirect target.
5. Load the script once and wrap each image in its own `<c2pa-image>`.
6. Verify the actual URL and bytes delivered by the page or CDN, including every responsive `picture`/`srcset` variant.

CSS sizing changes display dimensions but does not recode the file. If different bytes are needed for responsive variants, create and sign each final variant separately, with accurate declarations.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <script src="https://cdn-01.azureedge.net/$web/c2pa/1.0.0/c2pa-cr-badge.js" defer></script>
</head>
<body>
  <c2pa-image language="en">
    <img src="/images/signed-photo.jpg" alt="Description of the photo">
  </c2pa-image>
</body>
</html>
```

The badge appears when the component verifies the signature and integrity of the image it received. Its absence alone does not prove a false image: loading, CORS, CSP, dependency, or hosting problems can also hide it. Server-side `signed` and browser badge visibility are separate outcomes. The documented component does not expose a public `verify()` method, callback, or status event contract.

## Component attributes

Set attributes on `<c2pa-image>`, not on `script` or `img`. Names use underscores and numeric pixel values without units.

| Attribute | Values | Default |
| --- | --- | --- |
| `position` | `left`, `center`, `right` | `left` |
| `badge_size` | 16–128 | 40 |
| `offset` | 0–128 | 12 |
| `modal_width` | 200–640 | 276 |
| `opacity` | 0–1 | 1 |
| `download_media` | `true` or `false` | `true` |
| `trigger` | `click` or `hover` | `click` |
| `language` | `it` or `en` | `it` |

The badge remains at the top of the component. `center` makes `offset` affect only the top distance. `opacity` controls panel background and blur, not all text and controls. `download_media="false"` hides the media download and transparency information in the UI; it is not access control and does not remove manifest data. Hover still permits click, tap, and keyboard interaction. In the documented version, dates retain Italian formatting and the `Europe/Rome` time zone even with `language="en"`.

## CORS, CSP, and diagnostics

A browser can display a cross-origin image while JavaScript is unable to read its bytes. Configure the image host to allow the page origin, for example `Access-Control-Allow-Origin: https://www.example.com`. If the response varies by Origin, add `Vary: Origin`. The image's `crossorigin` attribute alone cannot grant server-side access.

Restrictive CSP must allow the badge script from `cdn-01.azureedge.net` and the actual image, plus the resources observed at runtime: SDK/WebAssembly from jsDelivr, workers, and trust lists from `raw.githubusercontent.com`. The documentation does not provide a complete universal CSP policy or every dependency URL. Inspect the browser's Console and Network panels and permit only what the deployed component actually needs; do not assume undocumented `unsafe-eval` or `blob:` requirements.

If the image is visible but the badge is absent, confirm that the page serves the downloaded signed output, then check script and dependency loading, CORS, CSP, redirects, image transformations, cached copies, and the responsive source selected by the browser. Test the minimal component before adjusting its layout. The badge documentation concerns images; do not infer PDF, audio, or video badge support from the signing API.
