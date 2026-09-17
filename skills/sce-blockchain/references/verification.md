# Hash lookup and verification records

## Verify the actual bytes

`GET /v1/blockchain/verify/{hash_hex}` accepts exactly 64 hexadecimal SHA-256 characters, case-insensitively, without `0x`. Invalid syntax returns HTTP `400` with `detail: "Invalid SHA-256 hash"`.

Hash the file bytes, not its name, URL, Base64 representation, or decoded image pixels. For example:

```powershell
$contentHash = (Get-FileHash -Algorithm SHA256 -LiteralPath '.\media.pdf').Hash.ToLowerInvariant()
```

On Unix, `sha256sum` or `shasum -a 256` can produce the hash. If content changes after hashing, recalculate from the bytes actually uploaded or served. The complete [Python](../examples/python.md) and [JavaScript](../examples/javascript.md) examples hash the same in-memory bytes used for upload.

The guide's simplified API response is:

```json
{
  "ok": true,
  "provider": "blockchain",
  "operation": "verify",
  "billable_units": 0,
  "quota": null,
  "result": {
    "verified": true,
    "hash": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  }
}
```

The model also allows `valid`, `exists`, `status`, and extra fields, but does not document all their combinations. Preserve the actual response. Do not equate `exists`, `valid`, API `ok`, or job `finalized` with `verified: true`, or assume verification lookup recovers a lost job ID. The examples save the result for inspection and do not manufacture an overall verification verdict.

## Record required by the browser widget

The simplified response above is **not sufficient for the badge**. A usable record needs both:

- `signature.algorithm` equal to `RS256`.
- `signature.signed_hash_str` containing the complete Base64 signature returned by the service.

Paths are relative to the normalized record, usually `result`. Neither `signed_armored_hash`, `onchain_hash`, a plain `hash`, nor `verified: true` replaces the signature. Do not generate a synthetic signature to fill missing fields. The complete availability/schema of signature fields in `verify` is not guaranteed by the supplied API model: inspect an actual response or confirm the deployed contract before completing the badge integration.

The widget uses its embedded public key to check SHA-256 against the hash extracted from the signature. This documentation is not a standalone signature-format specification; do not reimplement it as an assumed JWT/JWS format or invent padding details.

## Normalize and publish records

Prefer mapping the complete API response to an external ID:

```javascript
const recordsByExternalId = { 'photo-001': verificationResponse };
```

The widget normalizes `record.data`, then `record.result`, then `record`. Legacy `{ data: result }` and direct-result values work, but do not mix conflicting containers. Retaining the full envelope preserves an external `ok: false`, which the widget rejects; passing only `result` discards that signal.

Store full responses on the backend. For browser publication, the guide allows reducing the actual response to its outer `ok` and these `result` fields: `signature.algorithm`, `signature.signed_hash_str`, `metadata`, `chain_id`, `block_timestamp`, `timestamp`, `tx_hash`, and `polygonscan_url`. Preserve the complete real signature, exclude storage credentials and unneeded fields, and do not synthesize missing values.

If the product promises finalized notarization, the backend must check `status/{hash_id}` for `finalized` before exposing the associated record. The widget does not enforce `status`, `confirmations`, or `receipt_status`, query blockchain RPC nodes, or independently authenticate displayed author/time/transaction metadata. Local integrity success and chain finalization must remain separate in product messages.

For DOM mapping, content sources, presentation fields, and widget diagnostics, read [publishing and badge](publishing-and-badge.md).
