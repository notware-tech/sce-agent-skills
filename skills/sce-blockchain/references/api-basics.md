# Public API basics

## Base URL and authentication

`https://api.securecontentengine.com/sce-api-services-prod`

Send `Ocp-Apim-Subscription-Key: <API_KEY>` to public SCE API endpoints. JSON POST requests also need `Content-Type: application/json`. Keep the key on the integration backend. Internal APIM tokens, organization context, and `client-id` headers are not client configuration.

Upload and download SAS URLs carry temporary authorization. Use the complete returned URL without adding the SCE key. Do not expose keys or complete SAS query strings in logs. Upload SAS URLs must not be published; download SAS URLs expire and are not permanent publishing addresses.

## Public endpoints

| Method | Path | Purpose | Charge |
| --- | --- | --- | --- |
| GET | `/status` | Read account quota, not job state | 0 |
| POST | `/v1/blockchain/upload-url` | Prepare metadata and receive upload SAS | 0 |
| POST | `/v1/blockchain/sign` | Dispatch notarization of the uploaded file | 1 operation on acceptance |
| GET | `/v1/blockchain/status/{hash_id}` | Read asynchronous job state | 0 |
| GET | `/v1/blockchain/download/{file_id}` | Receive download SAS | 0 |
| GET | `/v1/blockchain/verify/{hash_hex}` | Look up a SHA-256 hash | 0 |

Documented successful public API responses use HTTP `200`. An internal upstream `202` does not imply public HTTP `202`. Upload PUT and download GET go directly to storage; successful PUT normally returns `201` and does not consume a signing operation.

## Identifiers

| Value | Source | Use |
| --- | --- | --- |
| `file_id` | Save upload `result.id`; the response model also permits `file_id` | Sign and download |
| `hash_id` | Nonempty string in the sign result | Status polling |
| `hash_hex` | SHA-256 of the exact file bytes, 64 hexadecimal characters | Verify |
| Upload SAS | Upload `result.sas_url`, or documented alternative `upload_url` | PUT file bytes |
| Download SAS | Download `result.sas_url`, or documented alternative `download_url` | GET file bytes |
| `data-external-id` | Chosen by the frontend integration | Map a DOM element to its verification record |

Read the actual response. Do not use a job ID in place of a file ID, require a C2PA-style 24-hex file ID, or look for C2PA's `uploads[0].sas_url`. Frontend external IDs are not derived from content URLs and need not be present in the API JSON.

## Response envelope

Successful blockchain operations use:

```json
{
  "ok": true,
  "provider": "blockchain",
  "operation": "upload_url",
  "billable_units": 0,
  "quota": null,
  "result": {}
}
```

`operation` is `upload_url`, `sign`, `status`, `download`, or `verify`. `ok` describes request handling, not job finalization or the widget's verified-element count. `result` allows additional fields; optional model fields are not guaranteed to be returned. `quota` can be null.

The quota example uses `metric: "operations"`, `operations`, and `used_operations`. The model also permits `included_remaining`, `extra_remaining`, `reserved_credits`, and `period_end`; this source does not define all their calculation or timing rules. A recorded completed billing operation can replay with `billable_units: 0`; a pending operation can return `409`. Neither behavior permits blind redispatch after a timeout. See [errors and recovery](errors-and-recovery.md).

## Contract boundaries

The sources do not specify maximum file size, a complete supported-MIME list, retention units or the meaning of retention 0, guaranteed SAS lifetimes, the full status enum, finalization SLA, or required confirmation count. Polygon display support in the widget is not proof that every API job uses that chain. Contract ABI, gas policy, and private-key management are outside this public integration.
