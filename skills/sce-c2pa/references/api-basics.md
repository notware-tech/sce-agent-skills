# Public API basics

## Base URL and authentication

`https://api.securecontentengine.com/sce-api-services-prod`

Send `Ocp-Apim-Subscription-Key: <API_KEY>` to public SCE API endpoints. Send `Content-Type: application/json` for JSON bodies. Keep the API key on the integration backend. The key determines the organization context; clients must not set internal organization or `client-id` headers.

Upload and download SAS URLs carry temporary authorization in their query strings. Do not send the SCE API key to these storage URLs, expose SAS URLs in logs, or treat a SAS URL as a permanent publishing URL.

## Public endpoints

| Method | Path | Purpose | Successful public HTTP | Charge |
| --- | --- | --- | --- | --- |
| GET | `/status` | Read account balance | 200 | 0 |
| POST | `/v1/c2pa/upload-url` | Save declarations and get upload SAS | 200 | 0 |
| POST | `/v1/c2pa/sign` | Dispatch standard signing | 200 | 1 credit on acceptance; 0 for recorded replay |
| POST | `/v1/c2pa/digital-capture` | Dispatch photographic capture signing | 200 | 1 credit on acceptance; 0 for recorded replay |
| GET | `/v1/c2pa/status/{file_id}` | Read asynchronous job state | 200 | 0 |
| GET | `/v1/c2pa/download/{file_id}` | Get download SAS | 200 | 0 |

The SAS PUT/GET requests go to Blob Storage, not the public API host. `/sign` and `/digital-capture` are alternative dispatches for a prepared file.

## Identifiers

| Value | Source | Use |
| --- | --- | --- |
| `file_id` | `result.id` of upload-url | Dispatch, status, and download |
| `parent_id` | An already signed SCE C2PA file | Derivation |
| `ingredient_ids` | Already signed SCE C2PA files | `placed` action |
| Upload SAS | `result.uploads[0].sas_url` | PUT the final file bytes |
| Download SAS | `result.sas_url` of download | GET the signed file bytes |

Parent and ingredient IDs are 24-character hexadecimal values for accessible files in the same organization. This flow does not require a blockchain `hash_id`.

## Response envelope

Successful C2PA API responses use:

```json
{
  "ok": true,
  "provider": "c2pa",
  "operation": "upload_url",
  "billable_units": 0,
  "quota": null,
  "result": {}
}
```

`ok` indicates the call succeeded, not that an asynchronous job finished. `operation` can be `upload_url`, `sign`, `digital_capture`, `status`, or `download`. `billable_units` reports the charge for that call. `quota` may be null. Accept additional fields in `result`.

`GET /status` is different: it returns balance fields directly. `operations` is the currently spendable total, `used_operations` is the charged total, `included_remaining` and `extra_remaining` distinguish credit pools, and `reserved_credits` represents pending reservations. The balance is shared with the portal. A check does not reserve a credit. An inactive subscription or insufficient credits can return `402`.

Errors do not necessarily use the success envelope. Inspect HTTP status and content type before parsing. See [errors and recovery](errors-and-recovery.md).

## Meaning of a signature

A C2PA manifest describes declared origin, actions, metadata, and content references. Signature verification checks integrity and binding to the verified content. It does not independently confirm the author's real-world identity, GPS, capture date, AI model, operation chronology, or factual accuracy. Trust decisions can differ among verifiers.

The documented public contract does not fix a signing algorithm, key rotation policy, certificate chain, timestamp authority, maximum file size, SLA, or complete supported-format list. Do not infer universal file support from examples.
