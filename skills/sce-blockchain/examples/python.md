# End-to-end Python example

This server-side example requires Python 3.10+ and `requests` (`python -m pip install requests`). Set `SCE_API_KEY`, `INPUT_FILE`, `CONTENT_TYPE`, and a new `OUTPUT_FILE` in a private writable directory, distinct from the input. Signing consumes one operation on acceptance.

It holds bytes in memory for a consistent upload/hash snapshot, saves recovery IDs in `OUTPUT_FILE.job.json`, and saves the actual API verification response in `OUTPUT_FILE.verification.json`. For large files, use an immutable source and streaming. Preserve the recovery file after interruption and resume by its IDs; rerunning the full example is not a signing recovery procedure. Backend response files must not be published wholesale.

```python
import hashlib
import json
import os
import time
from pathlib import Path
from urllib.parse import quote

import requests

BASE_URL = "https://api.securecontentengine.com/sce-api-services-prod"
API_KEY = os.environ["SCE_API_KEY"]
INPUT_FILE = Path(os.environ["INPUT_FILE"])
CONTENT_TYPE = os.environ["CONTENT_TYPE"]
OUTPUT_FILE = Path(os.environ["OUTPUT_FILE"])
JOB_FILE = Path(str(OUTPUT_FILE) + ".job.json")
VERIFICATION_FILE = Path(str(OUTPUT_FILE) + ".verification.json")
content = INPUT_FILE.read_bytes()
hash_hex = hashlib.sha256(content).hexdigest()
with JOB_FILE.open("x", encoding="utf-8") as checkpoint:
    json.dump({"hash_hex": hash_hex}, checkpoint, indent=2)


def call_api(method, route, payload=None):
    response = requests.request(
        method, BASE_URL + route,
        headers={"Ocp-Apim-Subscription-Key": API_KEY},
        json=payload, timeout=30, allow_redirects=False,
    )
    if not 200 <= response.status_code < 300:
        raise RuntimeError(f"SCE API HTTP {response.status_code} on {route}")
    data = response.json()
    if not isinstance(data, dict) or data.get("ok") is not True or not isinstance(data.get("result"), dict):
        raise RuntimeError(f"Unexpected API envelope on {route}")
    return data


def required_string(value, label):
    if not isinstance(value, str) or not value.strip():
        raise RuntimeError(f"Missing {label}")
    return value


def save_job(file_id, hash_id=None):
    record = {"file_id": file_id, "hash_hex": hash_hex}
    if hash_id is not None:
        record["hash_id"] = hash_id
    JOB_FILE.write_text(json.dumps(record, indent=2), encoding="utf-8")


upload = call_api("POST", "/v1/blockchain/upload-url", {"file_name": INPUT_FILE.name})
file_id = required_string(upload["result"].get("id") or upload["result"].get("file_id"), "file_id")
print(f"Prepared file_id={file_id}", flush=True)
save_job(file_id)
upload_url = required_string(upload["result"].get("sas_url") or upload["result"].get("upload_url"), "upload URL")
storage_response = requests.put(
    upload_url, data=content,
    headers={"x-ms-blob-type": "BlockBlob", "Content-Type": CONTENT_TYPE},
    timeout=120, allow_redirects=False,
)
if not 200 <= storage_response.status_code < 300:
    raise RuntimeError(f"Storage upload HTTP {storage_response.status_code}")

try:
    dispatched = call_api("POST", "/v1/blockchain/sign", {"file_id": file_id})
    hash_id = required_string(dispatched["result"].get("hash_id"), "hash_id")
except (requests.RequestException, ValueError, RuntimeError):
    print(f"No usable job ID. Preserve file_id={file_id}; inspect the failure and reconcile uncertain dispatch. "
          "Do not sign again automatically.", flush=True)
    raise
print(f"Keep file_id={file_id} and hash_id={hash_id}", flush=True)
save_job(file_id, hash_id)

deadline = time.monotonic() + 120  # Example client policy, not a service SLA.
interval = 2.0
finalized = False
while time.monotonic() < deadline:
    status = call_api("GET", "/v1/blockchain/status/" + quote(hash_id, safe=""))
    state = status["result"].get("status")
    if state == "finalized":
        finalized = True
        break
    # queued is illustrated; no exhaustive blockchain state enum is documented.
    if state != "queued":
        raise RuntimeError(f"Unrecognized job state {state!r}; inspect saved IDs")
    time.sleep(min(interval, max(0, deadline - time.monotonic())))
    interval = min(interval * 1.5, 15.0)
if not finalized:
    raise TimeoutError(f"Waiting limit reached; resume status with hash_id={hash_id}")

download = call_api("GET", "/v1/blockchain/download/" + quote(file_id, safe=""))
download_url = required_string(download["result"].get("sas_url") or download["result"].get("download_url"), "download URL")
file_response = requests.get(download_url, timeout=120)
if not 200 <= file_response.status_code < 300:
    raise RuntimeError(f"Storage download HTTP {file_response.status_code}")
downloaded = file_response.content
if hashlib.sha256(downloaded).hexdigest() != hash_hex:
    raise RuntimeError("Downloaded bytes differ from uploaded bytes; inspect before publication")
OUTPUT_FILE.write_bytes(downloaded)

verification = call_api("GET", "/v1/blockchain/verify/" + hash_hex)
VERIFICATION_FILE.write_text(json.dumps(verification, indent=2), encoding="utf-8")
print(f"Finalized job; matching file saved to {OUTPUT_FILE}. Inspect {VERIFICATION_FILE} "
      "for the API verification outcome and real signature fields required by the badge.")
```

Add metadata to the upload body as described in [signing workflow](../references/signing-workflow.md). This example stops on API read errors; bounded production read retries must not turn into automatic signing retries. See [errors and recovery](../references/errors-and-recovery.md).

The saved verify response can legitimately lack the fields needed for the widget. Follow [verification](../references/verification.md) and [publishing and badge](../references/publishing-and-badge.md) rather than interpreting a successful request as a browser verification result.
