# Errors and recovery

Identify the failing phase before interpreting a response. API gateway errors, public request validation, upstream C2PA errors, Blob Storage responses, asynchronous `failed` jobs, and browser badge failures have different formats. Inspect HTTP status and content type before parsing; do not require every error to contain `ok: false`.

## Public HTTP responses

| HTTP | Documented causes | Client response |
| --- | --- | --- |
| 400 | Invalid request or upstream C2PA rejection | Correct the request; do not retry unchanged |
| 401 | Missing authentication or subscription context | Check the public API key and gateway |
| 402 | Inactive plan or exhausted credits | Check plan and balance |
| 403 | Access or subscription not enabled | Correct authorization or configuration |
| 404 | Missing or inaccessible resource | Check ID and organization; do not infer which |
| 409 | State/payload conflict or pending reconciliation | Inspect status; preserve ID and original payload |
| 422 | Schema or semantic validation failure | Use structured code and field location |
| 429 | Gateway throttling | Respect `Retry-After` when present; back off |
| 500 | Backend failure | Preserve diagnostics; dispatch outcome may be uncertain |
| 502 | Upstream, network, malformed response, or missing URL | Retry reads within bounds; inspect status after uncertain dispatch |
| 503 | Dependency or client unavailable | Bounded retry; track dispatch outcome |
| 504 | Timeout at runtime or gateway | Do not assume the job was canceled |

The public gateway authenticates with `Ocp-Apim-Subscription-Key`. Do not call internal service endpoints or set internal `x-api-key`/`client-id` headers.

An upstream `400`, `404`, `409`, or `422` can retain its HTTP code through the public wrapper. Upstream `429` or 5xx can surface as public `502`. An upstream HTTP client timeout can also become `502`, so a dispatch with an uncertain outcome is not limited to public `504`.

## Validation details

Local validation may look like:

```json
{
  "code": "request_validation_failed",
  "detail": [{
    "type": "action_parent_required",
    "loc": ["body", "parent_id"],
    "msg": "parent_id is required for transformations of an existing asset"
  }]
}
```

Array indexes in `loc` are zero-based. Branch on structured `type` or `code`, not exact human-readable `msg`. Structural validation can return generic codes such as `missing`, `extra_forbidden`, `literal_error`, or `string_type` before semantic action checks.

Important semantic codes include `action_shape`, `action_unknown`, `action_origin_order`, `action_parent_required`, `action_parent_forbidden`, `action_parent_invalid`, `action_parameters_length`, `action_parameters_type`, `action_parameter_unknown`, `action_description_invalid`, `action_source_type_invalid`, `action_language_invalid`, `action_ingredients_required`, `action_ingredient_invalid`, `action_ingredient_duplicate`, and `action_ingredient_limit`. `removed` can be rejected as a generic enum error rather than `action_unavailable`.

AI codes include `ai_action_not_supported`, `ai_source_type_conflict`, `ai_text_invalid`, and `ai_acquisition_conflict`. Invalid types, enums, or extra fields can instead yield generic schema errors.

An upstream error can be filtered to `detail.message`, `detail.upstream_status_code`, and optional `request_id`, `code`, `field`, or `errors`. Runtime errors can contain only a string `detail`. Treat all of these fields as optional.

## Idempotency and uncertain dispatch

For one organization/provider, signing uses `file_id` plus a fingerprint of the validated billing payload to identify an operation. Preserve the same ID and semantic payload when recovering. Do not alter author, title, description, metadata, or capture fields and do not switch between `/sign` and `/digital-capture` for the same attempt. The public contract does not define a client idempotency header.

A recorded replay can return the previous `accepted` result with `billable_units: 0`. That means this call added no charge; the original certification may have consumed a credit. Replay does not replace current status polling.

If a dispatch response is lost, the server may already have accepted the job. Query `GET /v1/c2pa/status/{file_id}` first. `pending` alone does not prove that no dispatch happened. A `409` with unchanged payload can indicate reconciliation is pending. A client polling deadline does not cancel the job. Do not create a fresh upload or repeat the dispatch blindly to escape uncertainty.

## Recovery by phase

| Situation | Recovery |
| --- | --- |
| Upload PUT failed before dispatch | Inspect storage response and SAS expiry; retry upload or prepare a new SAS if necessary |
| Upload-url POST lost its response | Creation may have occurred; do not assume this POST is idempotent |
| Signing POST timed out or returned ambiguous 5xx | Poll status using the saved `file_id` |
| Status is `queued` or `processing` | Continue bounded polling; do not dispatch again |
| Status is `signed` | Request download SAS; handle accounting separately |
| Status is `failed` | Stop and diagnose; do not automatically start another job |
| Status is unknown or missing | Report the state as uninterpretable, with available diagnostics |
| Status/download GET has transient failure | Retry with limits and backoff, retaining the same ID |
| Download SAS expired | Request another download URL for the same ID |
| Persistent `409` with original payload | Seek operational reconciliation with ID and diagnostic data |

The public API does not document cancellation, reset, or a manual reconciliation endpoint. A corrected certification after a genuine failure is a new job, not an indistinguishable retry.

Keep timestamp, operation, HTTP status, `file_id`, last job state, structured error code, and request ID when available. For uploads, keep the HTTP result and SAS expiry. Do not log the API key, complete SAS query strings, or unnecessary full request bodies.
