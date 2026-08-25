# Enrichment cache and budget

The product enrichment pipeline now performs one factual vision extraction,
renders AR/FR catalog copy locally, and generates one studio image.

To persist cache/checkpoint data, add these optional fields to the NocoDB
products table:

| Field | Type | Purpose |
| --- | --- | --- |
| `Enrichment_Cache` | Long text | JSON cache: source hash, facts, template copy, usage and assets |
| `Enrichment_Assets` | Long text | JSON references to gallery/approval asset files (do not store image buffers) |
| `Enrichment_State` | Single select or text | `queued`, `running`, `awaiting_approval`, `approved`, `rejected`, `failed` |

The code continues working before these fields exist; it logs and skips the
state/cache patch if NocoDB rejects unknown columns. Adding the fields enables
repeat uploads of the same photos to reuse facts and avoid another paid vision
analysis.

Runtime settings:

- `OPENROUTER_FACTS_MODEL` defaults to `google/gemini-3.1-flash-lite`.
- `AI_PRODUCT_BUDGET_SOFT_USD` defaults to `0.055`.
- `AI_PRODUCT_BUDGET_HARD_USD` defaults to `0.08`; a new paid facts pass is
  stopped when cached usage is already at/over the hard limit.
