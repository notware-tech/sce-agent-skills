# End-to-end curl example

This example uses Bash, `curl`, and `jq`. It signs one already prepared local file with the default `opened` action, waits for the asynchronous job, and downloads the signed output. The signing dispatch is billable when accepted. Do not enable shell tracing: SAS URLs and the API key are secrets.

Set `SCE_API_KEY`, `INPUT_FILE`, `CONTENT_TYPE`, and `OUTPUT_FILE` in your shell before running:

```bash
set -euo pipefail

: "${SCE_API_KEY:?Set SCE_API_KEY}"
: "${INPUT_FILE:?Set INPUT_FILE}"
: "${CONTENT_TYPE:?Set the file's actual MIME type}"
: "${OUTPUT_FILE:?Set OUTPUT_FILE}"

BASE_URL="https://api.securecontentengine.com/sce-api-services-prod"
FILE_NAME="$(basename "$INPUT_FILE")"

upload_response="$(
  jq -n --arg file_name "$FILE_NAME" '{file_name: $file_name}' |
    curl --fail-with-body -sS "$BASE_URL/v1/c2pa/upload-url" \
      -H "Ocp-Apim-Subscription-Key: $SCE_API_KEY" \
      -H "Content-Type: application/json" \
      --data-binary @-
)"
file_id="$(jq -er '.result.id' <<<"$upload_response")"
upload_url="$(jq -er '.result.uploads[0].sas_url' <<<"$upload_response")"

curl --fail-with-body -sS -X PUT "$upload_url" \
  -H "x-ms-blob-type: BlockBlob" \
  -H "Content-Type: $CONTENT_TYPE" \
  --upload-file "$INPUT_FILE" >/dev/null

if ! sign_response="$(
  jq -n --arg file_id "$file_id" '{file_id: $file_id}' |
    curl --fail-with-body -sS "$BASE_URL/v1/c2pa/sign" \
      -H "Ocp-Apim-Subscription-Key: $SCE_API_KEY" \
      -H "Content-Type: application/json" \
      --data-binary @-
)"; then
  echo "Dispatch response failed. Preserve file_id=$file_id; inspect HTTP status and job status before retrying." >&2
  exit 1
fi
if ! jq -e '.result.status == "accepted"' <<<"$sign_response" >/dev/null; then
  echo "Unexpected dispatch response. Preserve file_id=$file_id for diagnosis." >&2
  exit 1
fi

job_status=""
for ((attempt = 0; attempt < 30; attempt++)); do
  status_response="$(
    curl --fail-with-body -sS "$BASE_URL/v1/c2pa/status/$file_id" \
      -H "Ocp-Apim-Subscription-Key: $SCE_API_KEY"
  )"
  job_status="$(jq -r '.result.status // empty' <<<"$status_response")"
  case "$job_status" in
    signed) break ;;
    failed)
      echo "Signing failed for file_id=$file_id. Inspect the status response." >&2
      exit 1
      ;;
    pending|queued|processing) sleep 2 ;;
    *)
      echo "Unknown status for file_id=$file_id: $job_status" >&2
      exit 1
      ;;
  esac
done
if [[ "$job_status" != "signed" ]]; then
  echo "Still in progress or undetermined. Resume status checks with file_id=$file_id." >&2
  exit 1
fi

download_response="$(
  curl --fail-with-body -sS "$BASE_URL/v1/c2pa/download/$file_id" \
    -H "Ocp-Apim-Subscription-Key: $SCE_API_KEY"
)"
download_url="$(jq -er '.result.sas_url' <<<"$download_response")"
curl --fail-with-body -sS -L "$download_url" --output "$OUTPUT_FILE"
printf 'Signed file saved to %s (file_id=%s)\n' "$OUTPUT_FILE" "$file_id"
```

If the signing POST loses its response, the job may have been accepted. Keep `file_id` and query status before considering any further dispatch. See [errors and recovery](../references/errors-and-recovery.md).

For photographic capture, prepare the upload with `{"file_name":"photo.jpg","action":"created"}`, then replace the `/sign` request with `/digital-capture` and a JSON body containing `file_id`, `lat`, `long`, and `captured_at`. See [the signing workflow](../references/signing-workflow.md). For transformation, ingredients, or AI declarations, change the upload-url body according to [actions and lineage](../references/actions-and-lineage.md) or [AI disclosure](../references/ai-disclosure.md); do not add those fields to the signing body.
