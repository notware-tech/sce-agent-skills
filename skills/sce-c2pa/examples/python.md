# End-to-end Python example

This server-side example requires Python 3.10+ and `requests` (`python -m pip install requests`). It signs a prepared local file with the default `opened` action and downloads the signed output. Set `SCE_API_KEY`, `INPUT_FILE`, `CONTENT_TYPE`, and `OUTPUT_FILE` as environment variables. The signing dispatch is billable when accepted.

```python
import os
import time
from pathlib import Path

import requests


BASE_URL = "https://api.securecontentengine.com/sce-api-services-prod"
API_KEY = os.environ["SCE_API_KEY"]
INPUT_FILE = Path(os.environ["INPUT_FILE"])
CONTENT_TYPE = os.environ["CONTENT_TYPE"]  # The file's actual MIME type.
OUTPUT_FILE = Path(os.environ["OUTPUT_FILE"])

api = requests.Session()
api_headers = {"Ocp-Apim-Subscription-Key": API_KEY}


def call_api(method, route, payload=None):
    response = api.request(
        method,
        BASE_URL + route,
        headers=api_headers,
        json=payload,
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


upload = call_api(
    "POST",
    "/v1/c2pa/upload-url",
    {"file_name": INPUT_FILE.name},
)
file_id = upload["result"]["id"]
upload_url = upload["result"]["uploads"][0]["sas_url"]

# Storage receives raw bytes and storage headers, never the SCE API key.
with INPUT_FILE.open("rb") as source:
    storage_response = requests.put(
        upload_url,
        data=source,
        headers={
            "x-ms-blob-type": "BlockBlob",
            "Content-Type": CONTENT_TYPE,
        },
        timeout=120,
    )
storage_response.raise_for_status()

try:
    dispatched = call_api(
        "POST",
        "/v1/c2pa/sign",
        {"file_id": file_id},
    )
except requests.HTTPError as error:
    code = error.response.status_code if error.response is not None else None
    if code is not None and 400 <= code < 500 and code != 409:
        print(f"Signing request rejected (HTTP {code}) for file_id={file_id}.")
    else:
        print(f"Dispatch outcome may be uncertain. Check status for file_id={file_id}.")
    raise
except requests.RequestException:
    print(f"Dispatch outcome may be uncertain. Check status for file_id={file_id}.")
    raise

if dispatched["result"]["status"] != "accepted":
    raise RuntimeError(f"Unexpected dispatch result for file_id={file_id}")

deadline = time.monotonic() + 120  # Client policy, not a service guarantee.
interval = 2.0
while time.monotonic() < deadline:
    status = call_api("GET", f"/v1/c2pa/status/{file_id}")
    state = status.get("result", {}).get("status")
    if state == "signed":
        break
    if state == "failed":
        raise RuntimeError(f"Signing failed for file_id={file_id}: {status['result']}")
    if state not in {"pending", "queued", "processing"}:
        raise RuntimeError(f"Unknown status for file_id={file_id}: {state!r}")
    time.sleep(interval)
    interval = min(interval * 1.5, 15.0)
else:
    raise TimeoutError(f"Still in progress or undetermined; resume with file_id={file_id}")

download = call_api("GET", f"/v1/c2pa/download/{file_id}")
download_url = download["result"]["sas_url"]
with requests.get(download_url, stream=True, timeout=120) as signed_file:
    signed_file.raise_for_status()
    with OUTPUT_FILE.open("wb") as destination:
        for chunk in signed_file.iter_content(chunk_size=1024 * 1024):
            if chunk:
                destination.write(chunk)

print(f"Signed file saved to {OUTPUT_FILE} (file_id={file_id})")
```

An HTTP failure or timeout from `/sign` may leave the job accepted; query the same `file_id` before attempting any recovery. The example does not retry dispatch. See [errors and recovery](../references/errors-and-recovery.md).

For photographic capture, save `"action": "created"` during upload preparation and replace the dispatch with `/v1/c2pa/digital-capture` carrying `file_id`, `lat`, `long`, and `captured_at`. For lineage or AI disclosure, extend the upload preparation payload following [actions and lineage](../references/actions-and-lineage.md) or [AI disclosure](../references/ai-disclosure.md), not the signing payload.
