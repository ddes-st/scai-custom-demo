# System template and foundation GUIDs

Copy verbatim when hand-authoring. The generator embeds these in templates — they are **not** remapped.

## Item template IDs

| Item | Template GUID |
|------|----------------|
| Template branch root | `0437fee2-44c9-46a6-abe9-28858d9fee8c` |
| Datasource / folder / rendering-params template | `ab86861a-6030-46c5-b394-e8f99e8b87db` |
| **Data section** (`Data.yml`) | `e269fbb5-3750-427a-9149-7aa950b49301` |
| Field definition (`Data/{Field}.yml`) | `455a3e98-a627-4b40-8035-e683a0331ac7` |
| Json rendering | `04646a89-996f-4ee7-878a-ffdbf1f0ef0d` |
| Insert options rule | `3aea335c-d06d-45b1-841a-cbc8d2d1ce40` |

## Base templates

| Base | GUID | Used on |
|------|------|---------|
| **Standard template** | `{1930BBEB-7805-471A-A3BE-4858AC7CF696}` | Datasource template ([Standard template structure](https://doc.sitecore.com/xp/en/developers/104/sitecore-experience-manager/the-structure-of-the-standard-template.html)) |
| Page content / headless base | `{44A022DB-56D3-419A-B43B-E27E4D8E9C41}` | Datasource template |
| Rendering parameters (SXA) | `{4247AAD4-EBDE-4994-998F-E067A51B1FE4}` | Parameters template |
| Rendering parameters (styling) | `{5C74E985-E055-43FF-B28C-DB6C6A6450A2}` | Parameters template |
| Rendering parameters (common) | `{3DB3EB10-F8D0-4CC9-BE26-18CE7B139EC8}` | Parameters template |

## Insert options

| Field | Value |
|-------|-------|
| `Location` (headless data bucket) | `{BA2F959D-A614-4C92-8B57-F1FC1A323ABE}` |

Shared across headless projects — points at the Sitecore insert-options bucket for datasource folders.

## Field definition shared fields

```yaml
SharedFields:
- ID: "ab162cc0-dc80-4abf-8871-998ee5d7ba32"
  Hint: Type
  Value: "Single-Line Text"
- ID: "ba3f86a2-4a1c-4d78-b63d-91c2779c1b5e"
  Hint: __Sortorder
  Value: 100
```

Field `Title` uses language field `19a69332-a23e-4e70-8d16-b2640cb24cc8`.
