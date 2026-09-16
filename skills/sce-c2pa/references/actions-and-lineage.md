# Actions and lineage

Declare actions on `POST /v1/c2pa/upload-url` for work already performed on the final file. The signing service records them; it does not crop, translate, resize, or otherwise transform content.

## Choose a plan

| Situation | Plan |
| --- | --- |
| Open existing content without an SCE parent | `opened` or omit `action` |
| Declare a new origin | Start with `created` and omit `parent_id` |
| Derive from an already signed SCE file | Supply `parent_id` and transformation actions |
| Compose a new asset from signed ingredients | `created` then `placed`, without a parent |
| Compose on an existing signed asset | Supply `parent_id` plus `placed` and other actions |

`created` and `opened` can occur only once, at index 0, and cannot coexist. Other actions can repeat. A sequence beginning with `created` may have later operations without a parent. A lone `opened` may have a parent; `opened` followed by further actions requires one. The service can prepend `opened` to a parent-based sequence, but `action_parameters` still aligns to the actions supplied by the client.

Action names are case-sensitive and omit the `c2pa.` prefix. Supply an object for every action parameter entry, using `{}` when none is needed. A parameter element cannot be null. The entire parameter array may be omitted or null.

## Public action catalog

| API name | C2PA assertion | Notes |
| --- | --- | --- |
| `created` | `c2pa.created` | New origin; optional `digitalSourceType` |
| `opened` | `c2pa.opened` | Opened content |
| `edited` | `c2pa.edited` | Generic edit; description required |
| `cropped` | `c2pa.cropped` | Crop declaration |
| `resized` | `c2pa.resized` | Resize declaration |
| `resized_proportional` | `c2pa.resized.proportional` | Proportional resize |
| `adjustedColor` | `c2pa.adjustedColor` | Color adjustment |
| `filtered` | `c2pa.filtered` | Filter |
| `drawing` | `c2pa.drawing` | Drawing |
| `addedText` | `c2pa.addedText` | Added text |
| `deleted` | `c2pa.deleted` | Deleted content, not a removed ingredient |
| `placed` | `c2pa.placed` | Signed components via `ingredient_ids` |
| `translated` | `c2pa.translated` | Requires language tags |
| `changedSpeed` | `c2pa.changedSpeed` | Speed change |
| `dubbed` | `c2pa.dubbed` | Dubbing |
| `trimmed` | `c2pa.trimmed` | Temporal trimming |
| `transcoded` | `c2pa.transcoded` | MIME change from parent allowed |
| `repackaged` | `c2pa.repackaged` | Container/MIME change allowed |
| `published` | `c2pa.published` | Publication declaration |

`removed` is not available in the public contract; do not substitute `deleted` for it. Specific actions do not automatically add `edited`.

## Action parameters and references

Every action can have a nonblank `description` of at most 2000 characters. Other allowed fields:

| Action | Additional fields |
| --- | --- |
| `created` | `digitalSourceType`: an exact allowed URI |
| `translated` | `sourceLanguage` and `targetLanguage`: BCP 47 tags, at most 255 characters each |
| `placed` | `ingredient_ids`: 1–20 distinct signed SCE IDs |
| All others | No additional fields |

Do not invent crop dimensions, resize dimensions, or other parameters. The validators can reject a present null value where omission is allowed.

Parent and ingredient IDs must be 24-character hexadecimal IDs of already `signed` files accessible within the same organization. There can be at most 20 distinct ingredients across the request. A `404` can mean either nonexistent or inaccessible. Do not substitute JUMBF URLs or blockchain hashes. Child and parent MIME must match unless `transcoded` or `repackaged` applies. The service checks actual files and references beyond JSON validation.

## Allowed digital source types

For `created.digitalSourceType`, the documented validator accepts the exact prefix `http://cv.iptc.org/newscodes/digitalsourcetype/` with these suffixes:

```text
digitalCapture, negativeFilm, positiveFilm, print, computationalCapture,
humanEdits, compositeCapture, algorithmicallyEnhanced, dataDrivenMedia,
digitalCreation, composite, compositeWithTrainedAlgorithmicMedia,
virtualRecording, compositeSynthetic, trainedAlgorithmicMedia,
algorithmicMedia, screenCapture
```

It also accepts `http://c2pa.org/digitalsourcetype/empty` and `http://c2pa.org/digitalsourcetype/trainedAlgorithmicData`. These are identifiers; do not silently rewrite `http` to `https`.

## Request examples

Derivation from a signed parent:

```json
{
  "file_name": "edited.png",
  "parent_id": "507f1f77bcf86cd799439011",
  "action": ["opened", "cropped", "resized", "addedText"],
  "action_parameters": [{}, {}, {}, {"description": "Added a caption"}]
}
```

Composition of signed ingredients:

```json
{
  "file_name": "composition.png",
  "action": ["created", "placed"],
  "action_parameters": [
    {"digitalSourceType": "http://c2pa.org/digitalsourcetype/empty"},
    {"ingredient_ids": ["507f1f77bcf86cd799439012"]}
  ]
}
```

Replace illustrative IDs with real accessible files. Upload only the final resulting bytes.
