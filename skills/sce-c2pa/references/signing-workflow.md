# Signing workflow

## 1. Prepare the upload

`POST /v1/c2pa/upload-url` saves declarations for the eventual signature and returns one upload destination.

| Field | Requirement |
| --- | --- |
| `file_name` | Required string, 1–512 characters, with a supported extension |
| `action` | Optional string or array of 1–100 action names; omitted means `opened` |
| `action_parameters` | Optional array or null; when present, one object per supplied action, 1–100 objects |
| `parent_id` | Optional or conditional 24-character hexadecimal ID |
| `ai_disclosure` | Optional object or null |

The request rejects extra fields. Do not send `retention`. Omitting `action` invokes the default; sending `null` is different. Read [actions and lineage](actions-and-lineage.md) or [AI disclosure](ai-disclosure.md) before preparing a non-default request.

An illustrative minimal response is:

```json
{
  "ok": true,
  "provider": "c2pa",
  "operation": "upload_url",
  "billable_units": 0,
  "quota": null,
  "result": {
    "id": "6a214eb0ed48f7076c1d0859",
    "action": "opened",
    "uploads": [{
      "role": "primary",
      "file_name": "document.pdf",
      "sas_url": "https://<storage>/<container>/<blob>?<sas>"
    }],
    "sas_metadata": {
      "permission": "write",
      "ttl_seconds": 900,
      "expires_at": "2026-09-16T12:15:00Z"
    }
  }
}
```

Save `result.id`, `result.uploads[0].sas_url`, and the returned expiry when present. The response has one upload entry for the final file. The role is `edited` when there is a parent and `primary` otherwise. The service retrieves parent and ingredients by ID; do not upload them again. Use the returned expiry rather than assuming a fixed lifetime. Changing declarations requires a new, consistent preparation, not extra fields on the signing request.

## 2. Upload bytes

`PUT` the final file bytes to the returned SAS URL, with `x-ms-blob-type: BlockBlob` and the actual file MIME as `Content-Type`. Send neither JSON nor multipart form data. The documented success is normally `201 Created`. Do not send the SCE API key to storage. Complete this upload before dispatching a signature.

An accepted upload does not establish that the file is valid or supported; later processing can fail. Storage errors may be XML or another format and should not be parsed as SCE API errors. An expired upload SAS before dispatch may require a new preparation. Do not use that path to work around an already sent or uncertain dispatch.

## 3. Dispatch one signing mode

### Standard: `POST /v1/c2pa/sign`

| Field | Requirement |
| --- | --- |
| `file_id` | Required; use the saved `result.id` exactly |
| `author`, `title` | Optional string or null, maximum 256 characters each |
| `description` | Optional string or null, maximum 2000 characters; conditionally required for `edited` |
| `metadata` | Optional JSON object or null |

Extra fields are rejected. Do not resend `action`, `action_parameters`, `parent_id`, or `ai_disclosure`, even as null. For each `edited` action, provide a nonblank action description or a nonblank signing `description` as a fallback.

### Photographic capture: `POST /v1/c2pa/digital-capture`

Prepare the image upload with `action: "created"`, upload the bytes, and use this endpoint **instead of** `/sign`. It requires `file_id`, numeric `lat` in [-90, 90], numeric `long` in [-180, 180], and ISO 8601 `captured_at` (prefer an explicit offset or `Z`). It also accepts the optional standard signing metadata and limits.

The capture fields are client declarations, not proof of hardware authentication. A single `opened` action can also accept capture data, but the endpoint does not rewrite the saved action. Capture fields conflict with `ai_disclosure`.

Both dispatches return public HTTP `200` with a result such as `{"status":"accepted","status_code":202}`. The embedded 202 reports upstream acceptance. Keep the original `file_id`; the normalized dispatch response need not repeat it.

## 4. Poll by file ID

`GET /v1/c2pa/status/{file_id}` uses the saved upload ID. Interpret the documented values:

| `result.status` | Action |
| --- | --- |
| `pending` | Check the local phase; it does not prove dispatch acceptance |
| `queued`, `processing` | Continue bounded polling with backoff |
| `signed` | Terminal success; request a download SAS |
| `failed` | Terminal processing failure; stop and inspect available details |
| Missing or unknown | Preserve diagnostic data; do not infer success or failure |

`accepted` is the dispatch result, not one of these persisted job states. Intermediate states need not all be observed. A client-defined deadline ends local waiting; it does not cancel the job. Preserve `file_id` to resume later. HTTP `200` with `failed` is a successful read of an unsuccessful job.

A practical polling policy starts around two seconds, backs off with jitter to a capped interval, and uses a client-defined deadline. These values are client recommendations, not service guarantees. See [errors and recovery](errors-and-recovery.md) before retrying a failed or ambiguous request.

## 5. Download signed bytes

After `signed`, call `GET /v1/c2pa/download/{file_id}`. Read `result.sas_url` from its JSON response, then make a separate GET to that SAS URL and save its bytes. The public endpoint returns a URL, not the signed file body. If the download SAS expires, request another URL for the same ID rather than signing again.

The signed output is the file to publish. A temporary SAS is not a stable public website URL. For images and the browser badge, continue with [publishing and badge](publishing-and-badge.md).
