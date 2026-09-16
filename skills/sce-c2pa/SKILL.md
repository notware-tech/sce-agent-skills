---
name: sce-c2pa
description: Integrate the public Secure Content Engine C2PA API to sign content, declare provenance or AI use, track asynchronous jobs, download signed files, and publish images with the Content Credentials badge. Use for SCE C2PA integration or troubleshooting.
---

# SCE C2PA

Use the public SCE API and the documented image badge. The signature records claims and binds credentials to content; it does not independently prove the author's identity, capture location, model attribution, or factual truth.

## Choose the task

- For credentials, identifiers, billing, public endpoints, and response shapes, read [API basics](references/api-basics.md).
- For preparing an upload, uploading bytes, choosing `/sign` or `/digital-capture`, polling, and downloading, read [the signing workflow](references/signing-workflow.md).
- For transformations, parent files, ingredients, and digital source types, read [actions and lineage](references/actions-and-lineage.md).
- For model attribution and human oversight declarations, read [AI disclosure](references/ai-disclosure.md).
- For HTTP failures, asynchronous failures, uncertain dispatch, and retries, read [errors and recovery](references/errors-and-recovery.md).
- For hosting a signed image and configuring or diagnosing `<c2pa-image>`, read [publishing and badge](references/publishing-and-badge.md).

When writing an integration, choose a complete [curl](examples/curl.md), [Python](examples/python.md), or [Node.js JavaScript](examples/javascript.md) example. Read only the example needed for the user's language.

## Operational rules

1. Send API requests only to the public base URL and `/v1/c2pa/*` endpoints. Send raw file bytes to the returned upload SAS URL. Never send the SCE API key to Blob Storage or expose it in browser code.
2. Prepare the final content and its action declarations before requesting the upload URL. The service signs these declarations; it does not perform the declared edits.
3. Preserve `result.id` from the upload response as `file_id`. After a successful binary upload, call exactly one dispatch endpoint: `/sign` or `/digital-capture`.
4. Treat public HTTP `200` with `result.status: "accepted"` as dispatch acceptance. Poll the same `file_id` until `signed` or `failed`; download only after `signed`.
5. Signing dispatch consumes a credit when accepted. If the response is lost or ambiguous, inspect status and recover using the same ID and payload. Do not blindly dispatch another signing request.
6. Publish the signed output bytes without image optimization that changes them. The browser badge verifies the image it actually receives; a server-side `signed` state alone does not guarantee a badge.

The public contract in these references was documented on 2026-09-16. It was checked against documentation and implementation sources, without a live signing test. Check the current authenticated [API documentation](https://dashboard.securecontentengine.com/api/docs/c2pa) and [badge documentation](https://dashboard.securecontentengine.com/api/cdn/c2pa-badge) when deployment behavior differs or exact current values matter.
