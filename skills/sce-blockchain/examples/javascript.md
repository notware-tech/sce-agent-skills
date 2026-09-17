# End-to-end Node.js JavaScript example

This server-side example uses Node.js 20+ built-ins. Set `SCE_API_KEY`, `INPUT_FILE`, `CONTENT_TYPE`, and a new `OUTPUT_FILE` path in a private writable directory. Save the code as `.mjs`. It notarizes the input, waits for finalization, downloads and compares bytes, and saves the actual verify response for inspection. Signing consumes one operation when accepted.

The example holds file bytes in memory so the hash and upload use the same snapshot. For large files, use an immutable source and streaming transfers/hashing. It writes recovery IDs to `OUTPUT_FILE.job.json` and verification data to `OUTPUT_FILE.verification.json`. These are backend artifacts, not files to publish wholesale. Use distinct input/output paths and preserve the job file when resuming an interrupted operation; do not rerun the entire example to retry signing.

```javascript
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const baseUrl = "https://api.securecontentengine.com/sce-api-services-prod";
const apiKey = process.env.SCE_API_KEY;
const inputFile = process.env.INPUT_FILE;
const contentType = process.env.CONTENT_TYPE;
const outputFile = process.env.OUTPUT_FILE;
if (!apiKey || !inputFile || !contentType || !outputFile) {
  throw new Error("Set SCE_API_KEY, INPUT_FILE, CONTENT_TYPE, and OUTPUT_FILE.");
}
const jobFile = outputFile + ".job.json";
const verificationFile = outputFile + ".verification.json";
const bytes = await readFile(inputFile);
const hashHex = createHash("sha256").update(bytes).digest("hex");
// Reserve the recovery file before making requests; an existing attempt must be inspected.
await writeFile(jobFile, JSON.stringify({ hash_hex: hashHex }, null, 2), { flag: "wx" });

async function callApi(method, route, payload) {
  const response = await fetch(baseUrl + route, {
    method,
    headers: {
      "Ocp-Apim-Subscription-Key": apiKey,
      ...(payload === undefined ? {} : { "Content-Type": "application/json" })
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
    redirect: "error",
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error("SCE API HTTP " + response.status + " on " + route);
  const data = await response.json();
  if (data?.ok !== true || !data.result || typeof data.result !== "object" || Array.isArray(data.result)) {
    throw new Error("Unexpected API envelope on " + route);
  }
  return data;
}

function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Missing " + label);
  return value;
}

const upload = await callApi("POST", "/v1/blockchain/upload-url", {
  file_name: path.basename(inputFile)
});
const fileId = requiredString(upload.result.id ?? upload.result.file_id, "file_id");
console.log("Prepared file_id=" + fileId);
await writeFile(jobFile, JSON.stringify({ file_id: fileId, hash_hex: hashHex }, null, 2));
const uploadUrl = requiredString(upload.result.sas_url ?? upload.result.upload_url, "upload URL");
const storageResponse = await fetch(uploadUrl, {
  method: "PUT",
  headers: { "x-ms-blob-type": "BlockBlob", "Content-Type": contentType },
  body: bytes,
  redirect: "error",
  signal: AbortSignal.timeout(120000)
});
if (!storageResponse.ok) throw new Error("Storage upload HTTP " + storageResponse.status);

let hashId;
try {
  const dispatched = await callApi("POST", "/v1/blockchain/sign", { file_id: fileId });
  hashId = requiredString(dispatched.result.hash_id, "hash_id");
} catch (error) {
  console.error("Dispatch did not yield a usable job ID. Preserve file_id=" + fileId +
    "; inspect the failure and reconcile uncertain dispatch. Do not sign again automatically.");
  throw error;
}
console.log("Keep file_id=" + fileId + " and hash_id=" + hashId);
await writeFile(jobFile, JSON.stringify({ file_id: fileId, hash_id: hashId, hash_hex: hashHex }, null, 2));

const deadline = Date.now() + 120000; // Example client policy, not a service SLA.
let interval = 2000;
let finalized = false;
while (Date.now() < deadline) {
  const status = await callApi("GET", "/v1/blockchain/status/" + encodeURIComponent(hashId));
  const state = status.result.status;
  if (state === "finalized") { finalized = true; break; }
  // queued is illustrated; no exhaustive blockchain state enum is documented.
  if (state !== "queued") throw new Error("Unrecognized job state; inspect saved IDs: " + String(state));
  await new Promise(resolve => setTimeout(resolve, Math.min(interval, Math.max(0, deadline - Date.now()))));
  interval = Math.min(interval * 1.5, 15000);
}
if (!finalized) throw new Error("Waiting limit reached; resume status with hash_id=" + hashId);

const download = await callApi("GET", "/v1/blockchain/download/" + encodeURIComponent(fileId));
const downloadUrl = requiredString(download.result.sas_url ?? download.result.download_url, "download URL");
const fileResponse = await fetch(downloadUrl, { signal: AbortSignal.timeout(120000) });
if (!fileResponse.ok) throw new Error("Storage download HTTP " + fileResponse.status);
const downloaded = Buffer.from(await fileResponse.arrayBuffer());
if (createHash("sha256").update(downloaded).digest("hex") !== hashHex) {
  throw new Error("Downloaded bytes differ from uploaded bytes; inspect before publication.");
}
await writeFile(outputFile, downloaded);

const verification = await callApi("GET", "/v1/blockchain/verify/" + hashHex);
await writeFile(verificationFile, JSON.stringify(verification, null, 2));
console.log("Finalized job; matching file saved to " + outputFile + ". Inspect " + verificationFile +
  " for the API verification outcome and real signature fields required by the badge.");
```

Add `author` and `description` to upload preparation when needed, not to `sign`. Omit retention unless its intended value is known. API read failures stop this minimal example; production integrations can add bounded read retries without retrying dispatch. See [signing workflow](../references/signing-workflow.md) and [errors and recovery](../references/errors-and-recovery.md).

A successful verify request is not automatically a badge-ready record. Preserve its semantics and check the actual signature fields using [verification](../references/verification.md), then integrate the widget using [publishing and badge](../references/publishing-and-badge.md).
