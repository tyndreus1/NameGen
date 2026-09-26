# Owner reference designs

Hand-made laser-cut name pendant references (owner originals). The Grok edits
client sends two of these per request as style inputs.

| File | Notes |
|---|---|
| `merve.png` | Classic script, extra center ring |
| `zeynep.png` | Hearts / classic script |
| `aleyna.png` | Hearts + small star |
| `sophia.png` | Butterfly perched on the last letter (`Sophiaa`) |
| `charlotte.png` | Classic / zarif, heart on the swash |

Rules used by `src/lib/generate/references.ts`:

- Always send **two** references.
- Never include a reference whose name matches the target name.
- Butterfly style always includes `sophia.png` unless the target is Sophia.

Every prompt from the live 27-image xAI test is in [`prompts.md`](prompts.md).
