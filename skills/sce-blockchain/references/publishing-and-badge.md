# Publish content with the Blockchain badge

The documented `BlockchainBadge` widget, version `1.0.0`, verifies content locally against supplied signature records and displays one summary badge and panel per document. It does not upload/notarize files, fetch records from SCE, or query blockchain RPC nodes. The integration backend supplies records; the browser never needs the SCE API key.

Load this script once:

```text
https://cdn-01.azureedge.net/$web/blockchain-sce/1.0.0/verify.js
```

The `$web` segment is literal; quote it in shells to avoid variable expansion. The script includes styles, logo, icons, and a public key. The key cannot be replaced through `init`; a different signing key requires a compatible script version. Do not substitute an undocumented `latest` alias.

## Prepare content and records

Follow [verification](verification.md) for the actual signature fields and backend finalization gate. A simplified `{ verified: true, hash: ... }` record is insufficient. Each selected DOM element needs its own record at exactly the matching `data-external-id`; the ID is not inferred from its URL.

| DOM element | Bytes checked |
| --- | --- |
| `img` | Fetched `currentSrc`, falling back to `src` |
| `a` | File fetched from `href`, not link text |
| Other elements | UTF-8 of `textContent`, after optional textCanonicalizer |

Whitespace and newlines are significant for text. Canonicalization must match the rule used for the notarized content exactly. An image signature cannot also certify an article's text. Each responsive `srcset`/`picture` source needs a record for its actual bytes. CSS scaling does not change bytes; recompression, cropping, watermarks, and WebP/AVIF conversion do. `blob_mediaUrl_raw` in a record is not used as the content URL.

Use HTTPS or localhost, not `file://`. The browser needs WebCrypto, BigInt, fetch, and modern DOM APIs. Cross-origin file hosts must permit CORS reads. The content fetch uses `mode: "cors"` and `credentials: "omit"`, without cookies or application Authorization headers. Visible images may still be unreadable to the verifier. Use public or appropriately authorized temporary content URLs; never publish an upload SAS.

CSP must permit the script, injected CSS, and content origins. The widget does not expose a nonce for its dynamic style; a policy that blocks it requires an integration adjustment. Initialize only after both script and markup are ready; with async/defer, explicitly coordinate readiness.

## Minimal integration

Here `/verification/photo-001.json` is an application endpoint returning the actual, publication-safe signature record after the backend's finalization check. It is not a CDN-provided endpoint. The script is deliberately loaded after markup without async/defer.

```html
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Verified photo</title></head>
<body>
  <figure id="certified-photo" style="position:relative;margin:0;max-width:840px">
    <img src="/images/original-photo.jpeg" alt="Description of the photograph"
         data-bc data-external-id="photo-001"
         style="display:block;width:100%;height:auto">
  </figure>
  <p id="verification-status" role="status">Checking content integrity...</p>
  <script src="https://cdn-01.azureedge.net/$web/blockchain-sce/1.0.0/verify.js"></script>
  <script>
    async function initializeVerification() {
      const message = document.getElementById('verification-status');
      try {
        if (!window.BlockchainBadge) throw new Error('Widget unavailable');
        const response = await fetch('/verification/photo-001.json');
        if (!response.ok) throw new Error('Record unavailable');
        const verificationResponse = await response.json();
        const stats = await BlockchainBadge.init({
          recordsByExternalId: { 'photo-001': verificationResponse },
          elementSelector: '#certified-photo [data-bc][data-external-id]',
          badgeContainer: '#certified-photo',
          language: 'en'
        });
        message.textContent = stats.total > 0 && stats.ok === stats.total
          ? 'Content integrity verified.'
          : 'Verification incomplete; badge unavailable.';
      } catch {
        message.textContent = 'Unable to check content integrity.';
      }
    }
    initializeVerification();
  </script>
</body>
</html>
```

For multiple contents, scope `elementSelector` to the article and provide one record per selected element. A badge appears only if at least one element is selected and all selected elements verify. One call covering an article still produces one summary badge, not a badge per image.

## Options and positioning

`BlockchainBadge.init(options)` returns a Promise. Each invocation applies defaults afresh.

| Option | Values | Default |
| --- | --- | --- |
| `recordsByExternalId` | Map of external IDs to real records | Required |
| `elementSelector` | CSS selector | `[data-bc][data-external-id]` |
| `articleSelector` | CSS selector for insertion location, not selection scope | `[data-bc-article]` |
| `badgeContainer` | CSS selector or HTMLElement | null |
| `size` | small / medium / large (44 / 62 / 80 px), or number 32–120 | small |
| `offset` | Number 0–120 | 22 |
| `theme` | dark / light | dark |
| `language` | it / en | it |
| `openOn` | hover / click; click always works | hover |
| `modalWidth` | Number 320–640 | 340 |
| `modalOpacity` | Number 0–1, affecting background/blur | 1 |
| `summaryBadgeOutline` | circle / none / shield / shield-text | circle |
| `textCanonicalizer` | Synchronous text-to-string function matching backend preparation | None |

Use finite numeric values without `px`. Numeric values are converted with `Number` and clamped; null/empty strings become zero, so omit properties to get defaults. Unsupported language/theme/openOn fall back to it/dark/hover. Shield options are legacy outlines. Language does not translate metadata or diagnostic codes.

With `badgeContainer`, the badge is absolutely positioned at its top-right; a static container is made relative. Use a wrapper matching the displayed content bounds. Otherwise the badge is fixed at the page's top-right. DOM insertion searches `#bc-summary`, then the first heading in the first selected article, then that article, then body. The panel is placed in body and adjusted to the viewport.

Hover by mouse/pen opens a preview without focus or scroll locking; leaving badge and panel closes it after 250 ms unless focus remains inside. Click/tap/keyboard opens a persistent dialog. X, Escape, or outside click closes it, restoring focus/scrolling; Tab stays within the dialog.

## Presentation metadata

`metadata.author` supplies the displayed author, with a localized fallback when absent/empty. `chain_id: 137` is labeled Polygon; other IDs are shown as Chain followed by the ID. `block_timestamp` precedes `timestamp`; timezone-less values are interpreted as UTC, with panel format `YYYY-MM-DD HH:mm:ss`.

`polygonscan_url` is allowed only with HTTPS, host `polygonscan.com`, and path `/tx/0x` plus 64 hex digits. Otherwise a link can be built from a valid `tx_hash` when chain_id is 137 or absent. Link validation is not transaction verification. Author/time/link are provided by the record; local byte verification does not separately authenticate these metadata.

## Diagnostics

The returned stats contain `total`, `ok`, `failed`, `errored`, and `details`. Here `ok` is a count, not API `ok`. Details follow DOM order and include `external_id`, `label`, and normalized `data`; expected/computed hashes and accepted explorer URL may be present. Avoid logging complete records publicly.

| Detail status | Meaning |
| --- | --- |
| verified | Local integrity check passed |
| missing_record | No record for the element |
| invalid | Record/signature/content invalid; inspect reason |
| error | Operational exception; inspect error |

Documented reasons include `missing_record`, `verification_failed` (outer API ok is false), `unsupported_algorithm`, `missing_signature_fields`, `invalid_signature_format`, and `hash_mismatch`. A corrupt signature can also raise an operational error. These are widget outcomes, not HTTP codes or job states. There is no red failure badge; the application must communicate failure itself.

Also catch rejection of the entire init Promise: unavailable WebCrypto, missing records map, nonexistent container, invalid CSS selector, or failed key import can reject it. No stable exhaustive exception-code list is documented.

## Dynamic pages

Reinitialize after changing text, src, srcset, DOM, or records, supplying the complete configuration each time. Each call removes the existing badge and repeats verification; only the latest concurrent call can publish the replacement badge. One document shares one badge and panel: multiple calls do not create independent widgets. There is no public open/close/destroy API, logo replacement, or automatic DOM observation. A retained badge must not be treated as evidence for content changed since the last init.
