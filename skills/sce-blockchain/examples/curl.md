# End-to-end curl example

This example uses Bash, curl, jq, and either sha256sum or shasum. Set `SCE_API_KEY`, `INPUT_FILE`, `CONTENT_TYPE`, and a new `OUTPUT_FILE` path in a private writable directory, distinct from the input. Signing consumes one operation on acceptance. Do not enable shell tracing; the API key and SAS URLs are secrets.

It takes a temporary copy of the input so upload and hash use the same bytes. Recovery IDs are saved to `OUTPUT_FILE.job.json` and the actual verify response to `OUTPUT_FILE.verification.json`. Preserve these backend artifacts after interruption; resume by the IDs rather than rerunning the entire notarization. Do not publish the complete response file without reviewing its fields.

```bash
set -euo pipefail
umask 077
: "${SCE_API_KEY:?Set SCE_API_KEY}"
: "${INPUT_FILE:?Set INPUT_FILE}"
: "${CONTENT_TYPE:?Set the actual MIME type}"
: "${OUTPUT_FILE:?Set a new OUTPUT_FILE path}"
BASE_URL="https://api.securecontentengine.com/sce-api-services-prod"
job_file="${OUTPUT_FILE}.job.json"
verification_file="${OUTPUT_FILE}.verification.json"

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum < "$1" | awk '{print $1}'
  else
    shasum -a 256 < "$1" | awk '{print $1}'
  fi
}
uri() { jq -nr --arg value "$1" '$value | @uri'; }
api() {
  local method="$1" route="$2"
  shift 2
  curl --fail -sS --max-time 30 -X "$method" "$BASE_URL$route" \
    -H "Ocp-Apim-Subscription-Key: $SCE_API_KEY" "$@" |
    jq -e 'if .ok == true and (.result | type == "object") then . else error("Unexpected API envelope") end'
}

# Refuse to overwrite an existing recovery file before making any API requests.
(set -o noclobber; printf '{}\n' > "$job_file")
snapshot="$(mktemp)"
trap 'rm -f -- "$snapshot"' EXIT
cp -- "$INPUT_FILE" "$snapshot"
hash_hex="$(sha256_file "$snapshot")"
jq -n --arg hash "$hash_hex" '{hash_hex: $hash}' > "$job_file"

upload_response="$(
  jq -n --arg name "$(basename "$INPUT_FILE")" '{file_name: $name}' |
    api POST /v1/blockchain/upload-url -H 'Content-Type: application/json' --data-binary @-
)"
file_id="$(jq -er '.result.id // .result.file_id | select(type == "string" and test("\\S"))' <<< "$upload_response")"
printf 'Prepared file_id=%s\n' "$file_id"
jq -n --arg id "$file_id" --arg hash "$hash_hex" '{file_id: $id, hash_hex: $hash}' > "$job_file"
upload_url="$(jq -er '.result.sas_url // .result.upload_url | select(type == "string" and test("\\S"))' <<< "$upload_response")"
upload_status="$(curl --fail -sS --max-time 120 -X PUT "$upload_url" \
  -H 'x-ms-blob-type: BlockBlob' -H "Content-Type: $CONTENT_TYPE" \
  --upload-file "$snapshot" --output /dev/null --write-out '%{http_code}')"
if [[ "$upload_status" != 2?? ]]; then
  printf 'Storage upload was not successful: HTTP %s\n' "$upload_status" >&2
  exit 1
fi

if ! sign_response="$(
  jq -n --arg id "$file_id" '{file_id: $id}' |
    api POST /v1/blockchain/sign -H 'Content-Type: application/json' --data-binary @-
)"; then
  printf 'Dispatch failed; preserve file_id=%s and reconcile any uncertain outcome. Do not sign again automatically.\n' "$file_id" >&2
  exit 1
fi
if ! hash_id="$(jq -er '.result.hash_id | select(type == "string" and test("\\S"))' <<< "$sign_response")"; then
  printf 'Missing job ID; preserve file_id=%s for reconciliation. There is no documented status-by-file-ID fallback.\n' "$file_id" >&2
  exit 1
fi
printf 'Keep file_id=%s and hash_id=%s\n' "$file_id" "$hash_id"
jq -n --arg id "$file_id" --arg job "$hash_id" --arg hash "$hash_hex" \
  '{file_id: $id, hash_id: $job, hash_hex: $hash}' > "$job_file"

# Client-defined attempt limit/backoff, not a service SLA or full state enum.
finalized=false
interval=2
for ((attempt = 0; attempt < 12; attempt++)); do
  status_response="$(api GET "/v1/blockchain/status/$(uri "$hash_id")")"
  state="$(jq -r '.result.status // empty' <<< "$status_response")"
  case "$state" in
    finalized) finalized=true; break ;;
    queued) ;;
    *) printf 'Unrecognized job state; inspect saved IDs and status response.\n' >&2; exit 1 ;;
  esac
  if (( attempt < 11 )); then sleep "$interval"; fi
  interval=$((interval * 2))
  if (( interval > 15 )); then interval=15; fi
done
if [[ "$finalized" != true ]]; then
  printf 'Waiting limit reached; resume status with hash_id=%s.\n' "$hash_id" >&2
  exit 1
fi

download_response="$(api GET "/v1/blockchain/download/$(uri "$file_id")")"
download_url="$(jq -er '.result.sas_url // .result.download_url | select(type == "string" and test("\\S"))' <<< "$download_response")"
curl --fail -sS --max-time 120 -L "$download_url" --output "$OUTPUT_FILE"
if [[ "$(sha256_file "$OUTPUT_FILE")" != "$hash_hex" ]]; then
  printf 'Downloaded bytes differ from uploaded bytes; do not publish the output.\n' >&2
  exit 1
fi
api GET "/v1/blockchain/verify/$hash_hex" > "$verification_file"
printf 'Finalized job; matching file saved to %s. Inspect %s for verification outcome and real badge signature fields.\n' \
  "$OUTPUT_FILE" "$verification_file"
```

Add author/description to upload preparation according to [signing workflow](../references/signing-workflow.md). A stopped read can be retried within limits; a stopped signing request needs [errors and recovery](../references/errors-and-recovery.md). The example does not automatically redispatch.

The verify response is saved without inventing equivalences between its fields. For its interpretation and publication, read [verification](../references/verification.md) and [publishing and badge](../references/publishing-and-badge.md).
