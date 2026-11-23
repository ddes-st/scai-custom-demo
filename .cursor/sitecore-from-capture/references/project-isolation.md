# Project isolation

- Write TSX only into the current rendering host.
- Write YAML only into the current serialization module.
- Do not import components, styles, GUIDs, or YAML from sibling projects.
- You may inspect sibling projects for patterns, but recreate implementation in the target project.
- Generate fresh GUIDs for new serialized items.
