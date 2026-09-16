# End-to-end Node.js JavaScript example

This server-side example uses Node.js 20+ built-in `fetch`. Save the code as a `.mjs` file. Set `SCE_API_KEY`, `INPUT_FILE`, `CONTENT_TYPE`, and `OUTPUT_FILE` as environment variables. Keep the API key out of browser JavaScript. The signing dispatch is billable when accepted.

The example reads input and output into memory for clarity; for large files, stream storage transfers in a production integration.

```javascript
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = "https://api.securecontentengine.com/sce-api-services-prod";
const apiKey = process.env.SCE_API_KEY;
const inputFile = process.env.INPUT_FILE;
const contentType = process.env.CONTENT_TYPE;
const outputFile = process.env.OUTPUT_FILE;
if (!apiKey || !inputFile || !contentType || !outputFile) {
  throw new Error("Set SCE_API_KEY, INPUT_FILE, CONTENT_TYPE, and OUTPUT_FILE.");
}

async function callApi(method, route, payload) {
  const response = await fetch(baseUrl + route, {
    method,
    headers: {
      "Ocp-Apim-Subscription-Key": apiKey,
      ...(payload === undefined ? {} : { "Content-Type": "application/json" })
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) {
    const error = new Error("SCE API HTTP " + response.status + " on " + route);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

const upload = await callApi("POST", "/v1/c2pa/upload-url", {
  file_name: path.basename(inputFile)
});
const fileId = upload.result.id;
const uploadUrl = upload.result.uploads[0].sas_url;

// The SAS URL receives bytes and storage headers, never the SCE API key.
const bytes = await readFile(inputFile);
const storageResponse = await fetch(uploadUrl, {
  method: "PUT",
  headers: {
    "x-ms-blob-type": "BlockBlob",
    "Content-Type": contentType
  },
  body: bytes,
  signal: AbortSignal.timeout(120000)
});
if (!storageResponse.ok) {
  throw new Error("Storage upload failed: HTTP " + storageResponse.status);
}

let dispatched;
try {
  dispatched = await callApi("POST", "/v1/c2pa/sign", { file_id: fileId });
} catch (error) {
  if (error.status >= 400 && error.status < 500 && error.status !== 409) {
    console.error("Signing request rejected for file_id=" + fileId);
  } else {
    console.error("Dispatch outcome may be uncertain. Check status for file_id=" + fileId);
  }
  throw error;
}
if (dispatched.result.status !== "accepted") {
  throw new Error("Unexpected dispatch result for file_id=" + fileId);
}

const deadline = Date.now() + 120000; // Client policy, not a service guarantee.
let interval = 2000;
let signed = false;
while (Date.now() < deadline) {
  const status = await callApi("GET", "/v1/c2pa/status/" + fileId);
  const state = status.result?.status;
  if (state === "signed") {
    signed = true;
    break;
  }
  if (state === "failed") {
    throw new Error("Signing failed for file_id=" + fileId);
  }
  if (!["pending", "queued", "processing"].includes(state)) {
    throw new Error("Unknown status for file_id=" + fileId + ": " + state);
  }
  await new Promise((resolve) => setTimeout(resolve, interval));
  interval = Math.min(Math.round(interval * 1.5), 15000);
}
if (!signed) {
  throw new Error("Still in progress or undetermined; resume with file_id=" + fileId);
}

const download = await callApi("GET", "/v1/c2pa/download/" + fileId);
const signedResponse = await fetch(download.result.sas_url, {
  signal: AbortSignal.timeout(120000)
});
if (!signedResponse.ok) {
  throw new Error("Storage download failed: HTTP " + signedResponse.status);
}
await writeFile(outputFile, Buffer.from(await signedResponse.arrayBuffer()));
console.log("Signed file saved to " + outputFile + " (file_id=" + fileId + ")");
```

If the `/sign` response is lost, query status using the saved `file_id`; do not blindly repeat dispatch. See [errors and recovery](../references/errors-and-recovery.md).

For photographic capture, save `action: "created"` in the upload preparation and dispatch to `/v1/c2pa/digital-capture` with `file_id`, `lat`, `long`, and `captured_at` instead. Add lineage or AI declarations to the upload preparation using [actions and lineage](../references/actions-and-lineage.md) or [AI disclosure](../references/ai-disclosure.md).
