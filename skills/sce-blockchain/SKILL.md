---
name: sce-blockchain
description: Integrate the public Secure Content Engine Blockchain API to notarize file hashes, track asynchronous jobs, verify SHA-256 hashes, download files, and publish content with the SCE Blockchain badge. Use for SCE Blockchain integration or troubleshooting.
---

# SCE Blockchain

Use the public SCE API to register a file's hash and the documented browser widget to check content integrity. The file is uploaded to Blob Storage; the documented flow does not store the entire file on-chain. Notarization and local badge verification are distinct outcomes and do not independently prove author identity or factual truth.

## Choose the task

- For credentials, identifiers, billing, endpoints, and response shapes, read [API basics](references/api-basics.md).
- For upload preparation, binary upload, notarization dispatch, polling, and download, read [the signing workflow](references/signing-workflow.md).
- For SHA-256 lookup, verification results, and the signature record required by the widget, read [verification](references/verification.md).
- For HTTP failures, uncertain dispatch, missing job IDs, and retries, read [errors and recovery](references/errors-and-recovery.md).
- For publishing content, configuring `BlockchainBadge.init`, or diagnosing the browser badge, read [publishing and badge](references/publishing-and-badge.md).

When writing an integration, choose a complete [curl](examples/curl.md), [Python](examples/python.md), or [Node.js JavaScript](examples/javascript.md) example. Read only the example needed for the user's language.

## Operational rules

1. Use the public base URL and `/v1/blockchain/*` endpoints, plus `/status` for account quota. Keep the SCE API key on the backend; never send it to Blob Storage or browser code.
2. Prepare the final bytes before upload. Send `author`, `description`, and optional `retention` during upload preparation. The documented `/sign` body contains only `file_id`.
3. Keep the upload `file_id`, dispatch `hash_id`, and content SHA-256 `hash_hex` distinct. Status uses `hash_id`; download uses `file_id`; verify uses `hash_hex`.
4. Dispatch only after a successful binary upload. Acceptance consumes one operation and is not finalization. Poll with backoff for `finalized`; do not import C2PA's state enum.
5. Do not automatically retry an uncertain signing dispatch. With a saved `hash_id`, inspect status. Without it, preserve `file_id` and diagnostics for reconciliation: the documented API has no status-by-file-ID or job-ID lookup endpoint.
6. The badge requires a real signature-bearing verification record and the exact corresponding content bytes. `verified: true` alone is insufficient. If publication requires finalized notarization, gate the record on backend status before exposing it to the browser.

These references derive from the supplied SCE Blockchain technical documentation dated 2026-09-17, which cites public-backend and documentation sources. No live notarization or CDN deployment was tested. Consult the current authenticated [API documentation](https://dashboard.securecontentengine.com/api/docs/blockchain) and [badge documentation](https://dashboard.securecontentengine.com/api/cdn/blockchain-badge) when deployment behavior differs or exact current values matter. Undocumented states, retention units, file limits, and signature response fields must not be inferred from C2PA or illustrative examples.
