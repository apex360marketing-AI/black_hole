# Konshus/Alfred context-export pipeline

Turns a real Claude.ai data export into a structured, source-cited Markdown
dossier for handoff to another agent (e.g. Alfred). It extracts and quotes
only what your own messages actually contain — it does not infer, guess, or
pad empty sections.

## 1. Get a real export

Claude.ai → Settings → Data & Privacy → **Export data**. You'll receive a
`.zip` by email containing (among other files) `conversations.json`.

## 2. Run it

```bash
python3 export_pipeline.py path/to/export.zip -o dossier.md
# or point it directly at conversations.json, or a folder of exports
python3 export_pipeline.py conversations.json -o dossier.md
```

No dependencies beyond the Python 3 standard library.

## 3. What it does

- Parses every conversation in the export, normalizing the couple of shapes
  Claude.ai exports have used (`chat_messages` vs `messages`, `sender` vs
  `role`, plain-string vs content-block message text).
- Reads **only human-authored turns**. Assistant turns are never treated as
  facts about you.
- Scans each human message against per-section keyword lists (see
  `DEFAULT_SECTIONS` in `export_pipeline.py`) and pulls a quoted snippet
  plus a source citation (conversation title, id, timestamp) for every hit.
- Regex-extracts emails/URLs/phone numbers into Section 1.
- Builds Section 8 (verbatim statements) from sentences matching
  rule/preference language, deduplicated.
- Section 9 (Gaps) is computed, not written by hand: any section with zero
  matches is listed there automatically.
- Section 10 (Source Inventory) lists every conversation parsed, with a
  human-message count, whether or not it contributed any hits.

Every extracted line is labeled `[I SAID THIS]` because it is a verbatim
quote from a human turn. The pipeline does not attempt the other labels
from the dossier template (`[I SHARED THIS DOCUMENT]`,
`[OBSERVED FROM MY BEHAVIOR]`, `[INFERENCE]`) — those require judgment
about context that keyword matching can't provide, so the output leaves
that curation step to you (or to a review pass) rather than asserting it
automatically.

## 4. Customizing what it looks for

Pass `--keywords keywords.json` with a JSON object shaped like
`DEFAULT_SECTIONS` (section name → list of lowercase trigger phrases) to
add or override the built-in lists, e.g. to search for your own project
codenames or platforms without editing the script.

## 5. Testing without real data

`fixtures/sample_export.json` is synthetic data (a fictional "Jane Sample")
used only to verify the pipeline runs end-to-end:

```bash
python3 export_pipeline.py fixtures/sample_export.json -o /tmp/dossier.md
```

## Caveats

Keyword matching finds *candidates*, not verified facts. A hit can be
sarcasm, a hypothetical ("what if my company were called X"), or someone
else's data quoted back into the chat. Read every line in the generated
dossier before handing it to Alfred or anything else automated.
