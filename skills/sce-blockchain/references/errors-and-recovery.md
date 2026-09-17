# Errors and recovery

Distinguish public API errors, Blob Storage errors, asynchronous job states, and browser diagnostics. Inspect HTTP status and content type before parsing. Errors commonly use `{"detail": ...}`, where `detail` may be a string, object, or validation-error list; they need not contain a success envelope.

## HTTP failures

| HTTP | Meaning or documented cause | Response |
| --- | --- | --- |
| 400 | Invalid request; invalid SHA-256 format | Correct parameters before retrying |
| 401 | Missing/invalid key or subscription context | Check public API authentication |
| 402 | Inactive plan (`subscription_required`) or insufficient credits (`credits_exhausted`) | Check account plan/balance |
| 403 | Inactive subscription, organization, or B2B access; authorization failure | Check access and configuration |
| 404 | Missing resource or quota configuration | Check identifiers and account configuration |
| 409 | Incompatible state or pending reconciliation | Preserve IDs; inspect state where possible |
| 422 | Invalid request fields | Inspect validation details; correct input |
| 429 | Public gateway throttling | Reduce frequency; respect Retry-After when provided |
| 500 | Backend failure | Preserve diagnostics; dispatch may be uncertain |
| 502 | Upstream/network error, unexpected response, invalid JSON, or missing hash_id | Retry reads within limits; do not blindly retry sign |
| 503 | Service/client configuration unavailable | Diagnose configuration or retry reads within limits |
| 504 | Runtime timeout | A job may already exist; local timeout is not cancellation |

Upstream `400`, `404`, `409`, and `422` retain their code. Other upstream errors, including `429` and 5xx, map to public `502` with `detail.message: "blockchain service returned an error"` and `detail.upstream_status_code`. A propagated runtime `TimeoutError` can produce `504`, while HTTP-client network/timeouts may become `502` with `blockchain service is unavailable`.

`Missing hash_id from blockchain service` is a specific `502` during dispatch. A pending credit operation can return `409` with `Operation is pending reconciliation; check its status before retrying`. Treat these as diagnostic clues, not guarantees that no dispatch occurred.

The supplied backend snapshot applies C2PA's custom `request_validation_failed` envelope and upstream `code`/`field`/`errors` enrichment only to C2PA. Blockchain uses standard FastAPI local validation; do not require the C2PA code, assume original input was stripped, or reuse AI-disclosure error codes. Sanitize diagnostic data before sharing it.

## Uncertain dispatch and missing job ID

Signing consumes one operation on acceptance. A recorded completed billing operation may replay with `billable_units: 0`; a pending one may return `409`. These are not a general safe-retry contract. The internal signing client explicitly disables automatic retries for dispatch. The public documentation defines no client idempotency header, cancellation, reset, reconciliation endpoint, or job lookup by file ID.

| Situation | Recovery |
| --- | --- |
| Upload-url response lost | Preparation may exist; do not assume that POST is idempotent |
| Upload failed before any sign call | Inspect storage response/expiry; retry upload or renew preparation if needed |
| Sign response lost or ambiguous, hash_id already saved | Poll the saved job ID; do not dispatch again |
| Sign response lost or lacks hash_id | Preserve file_id, original metadata, and diagnostics; seek operational reconciliation |
| Status is finalized | Continue with download/verification |
| Status is queued | Continue bounded polling with backoff |
| State missing or unrecognized | Preserve it for inspection; do not infer success or copy C2PA failure states |
| Local waiting limit reached | End waiting; retain IDs to resume, without assuming server cancellation |
| Status/download/verify GET has transient error | Retry within limits and backoff, using the same identifier |
| Download SAS expired | Obtain a fresh download URL for the same file_id |
| Persistent 409 | Seek reconciliation using preserved identifiers and diagnostics |

When `hash_id` is unavailable, do not put `file_id` into the status path or invent a lookup endpoint. A verify-by-hash response is not documented to recover the job ID or fully resolve a billing/dispatch ambiguity. Do not request a new upload SAS or change metadata merely to bypass uncertain dispatch.

Keep timestamp, operation, HTTP status, file ID, job ID if known, content hash, last state, and available sanitized error details. Persist identifiers before progressing to later requests. Do not log API keys, full SAS query strings, or unfiltered request/response bodies containing secrets.

For widget errors, see [publishing and badge](publishing-and-badge.md); its `verified`, `invalid`, and `error` labels are browser outcomes, not blockchain job states.
