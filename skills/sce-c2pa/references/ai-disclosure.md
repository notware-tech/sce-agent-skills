# AI disclosure

Send `ai_disclosure` only to `POST /v1/c2pa/upload-url`, as one declaration for a plan whose first action is `created`. Set that first action's `digitalSourceType` to the exact URI `http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia`. The disclosure is saved with the preparation; do not resend it to `/sign`.

```json
{
  "file_name": "generated-image.png",
  "action": "created",
  "action_parameters": [{
    "digitalSourceType": "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"
  }],
  "ai_disclosure": {
    "model_type": "c2pa.types.model.huggingface.transformers",
    "model_name": "Example Image Model",
    "model_identifier": "urn:example:models:image-model:1.0",
    "content_profile": {"human_oversight_level": "prompt_guided"}
  }
}
```

| Field | Constraint |
| --- | --- |
| `model_type` | Required; one of the supported C2PA model type values below |
| `model_name` | Optional or null; 1–256 characters after trimming |
| `model_identifier` | Optional or null; 1–2048 characters after trimming |
| `content_profile` | Optional or null object |
| `human_oversight_level` | Optional or null; `fully_autonomous`, `prompt_guided`, or `human_validated` |

Prefer a stable, versioned URI, URN, or package URL for `model_identifier` when available. The service does not fetch that identifier. Empty trimmed strings, control characters, coercible types, and unknown fields are rejected.

## Supported model types

```text
c2pa.types.model
c2pa.types.model.caffe
c2pa.types.model.caffe2
c2pa.types.model.catboost
c2pa.types.model.coreml
c2pa.types.model.flax
c2pa.types.model.huggingface.transformers
c2pa.types.model.jax
c2pa.types.model.keras
c2pa.types.model.lightgbm
c2pa.types.model.ml_net
c2pa.types.model.mxnet
c2pa.types.model.onnx
c2pa.types.model.openvino
c2pa.types.model.openvino.parameter
c2pa.types.model.openvino.topology
c2pa.types.model.paddle
c2pa.types.model.pytorch
c2pa.types.model.sklearn
c2pa.types.model.tensorflow
c2pa.types.model.tensorrt
c2pa.types.model.tflite
c2pa.types.model.torchscript
c2pa.types.model.xgboost
```

Use the generic `c2pa.types.model` when no specific listed framework applies; do not invent a commercial-model suffix.

An incompatible origin can produce `ai_source_type_conflict`; disclosure without `created` can produce `ai_action_not_supported`. GPS and photographic capture fields conflict with AI disclosure and can produce `ai_acquisition_conflict`. Missing disclosure does not prove human origin, and `trainedAlgorithmicMedia` is allowed without model disclosure. No oversight level is inferred by default. Generic `metadata` does not replace the dedicated AI assertion.
