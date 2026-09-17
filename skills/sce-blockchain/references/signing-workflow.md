# Signing workflow: blockchain notarization

## 1. Prepare the final file

Choose the exact bytes to notarize and preserve them throughout upload and hashing. The service registers a hash; the documentation does not say that download embeds a C2PA manifest or badge. Do not transfer C2PA action, lineage, AI-disclosure, or digital-capture fields to blockchain requests.

`POST /v1/blockchain/upload-url` accepts:

| Field | Requirement |
| --- | --- |
| `file_name` | Required string, 1–512 characters |
| `file_id` | Optional string up to 256 characters or null; default null |
| `retention` | Optional integer >= 0; default 0 |
| `author` | Optional string up to 256 characters or null |
| `description` | Optional string up to 2000 characters or null |

The documentation does not define retention units or what 0 means. Omit it unless the integration has an agreed value; do not label 30 as days or 0 as unlimited. If `file_id` is omitted or empty, the backend internally forwards the string `"None"`; clients should omit the field rather than manufacture that internal sentinel.

Illustrative response result:

```json
{
  "sas_url": "https://<storage>/<container>/<blob>?<sas>",
  "id": "<file-id>",
  "sas_metadata": {
    "permission": "write",
    "ttl_seconds": 1200,
    "expires_at": "2026-09-17T12:20:00+00:00"
  }
}
```

Save the returned file ID, upload URL, and expiry when present. The README also documents `upload_url`; the model permits `file_id`. These examples are not guarantees of lifetime or exhaustive schemas. If aliases conflict, inspect the response rather than guessing which resource is correct.

## 2. Upload bytes to storage

PUT the file to the full returned SAS URL with `x-ms-blob-type: BlockBlob` and the actual file MIME in `Content-Type`. Send raw bytes, not JSON or multipart form data. Do not send the SCE API key. Complete the upload successfully before dispatch; the documented normal storage response is `201 Created`.

An expired SAS before dispatch may require renewed preparation. This is distinct from recovering a job that might already have been dispatched. Storage errors may be XML or another format rather than an SCE JSON envelope.

## 3. Dispatch once

`POST /v1/blockchain/sign` takes only:

```json
{ "file_id": "<saved-file-id>" }
```

The ID is a required string of 1–256 characters. Author, description, and retention belong to upload preparation.

An illustrative result is:

```json
{
  "status": "queued",
  "hash_id": "<job-id>",
  "file_id": "<saved-file-id>"
}
```

Persist `hash_id` immediately, alongside `file_id`. Dispatch consumes one operation when accepted. HTTP `200` and `ok: true` do not prove finalization. The router requires a nonempty string `hash_id`; absence can produce HTTP `502` with `Missing hash_id from blockchain service`. Treat that as potentially uncertain dispatch, not proof that nothing happened.

## 4. Poll by job ID

Call `GET /v1/blockchain/status/{hash_id}`, encoding the ID as a URL path segment. The documented success state is `result.status: "finalized"`. The guide illustrates `queued` but does not define a complete intermediate or failure-state enum; do not borrow C2PA's states or treat every non-final value as pending.

Use progressive backoff and a client-defined waiting limit. The examples continue on the illustrated `queued` state, stop for inspection on unrecognized or missing states, and succeed only on `finalized`. Additional state handling requires confirmed service documentation. Starting at two seconds and capping at fifteen seconds is an example client policy, not an API guarantee. Ending local waiting does not cancel the server job. Retain both IDs to resume safely.

If the dispatch response was lost and `hash_id` is unavailable, polling by `file_id` is not a documented fallback. Follow [errors and recovery](errors-and-recovery.md).

## 5. Download and verify

After finalization, request `GET /v1/blockchain/download/{file_id}`. Read `result.sas_url` or `result.download_url`, then perform a separate GET to storage without the SCE key. If this SAS expires, request another download URL for the same file, not another notarization.

For verification, compute SHA-256 over the exact content being checked and call `GET /v1/blockchain/verify/{hash_hex}`. The examples hash the bytes uploaded and separately compare the downloaded bytes. A match establishes byte equality, not finalization or metadata authenticity. See [verification](verification.md) for result interpretation and [publishing and badge](publishing-and-badge.md) before publishing a record.
