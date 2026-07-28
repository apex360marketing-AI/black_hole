#!/usr/bin/env python3
"""
Konshus/Alfred context-export pipeline.

Turns a real Claude.ai data export (the .zip from Settings > Data & Privacy
> Export Data, or the conversations.json inside it) into a structured,
source-cited Markdown dossier organized into the ten sections of the
Konshus/Alfred context-export template.

Ground rule: this tool only extracts and quotes text that actually appears
in your own (human-authored) turns. It never reads assistant turns as facts
about you, never infers across messages into a "fact," and never fills a
section it found nothing for -- empty sections are reported under Gaps
instead of being padded with guesses.

Usage:
    python3 export_pipeline.py <export.zip | conversations.json | dir> \
        [-o dossier.md] [--keywords keywords.json]

See README.md in this directory for where to get a real export and how
the section keyword lists work.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

# ---------------------------------------------------------------------------
# Default keyword triggers per dossier section. These decide which of YOUR
# messages get pulled into which section -- they don't decide what's true,
# they just narrow down where to look. Override/extend via --keywords.
# ---------------------------------------------------------------------------

DEFAULT_SECTIONS: dict[str, list[str]] = {
    "1. Identity & Contact": [
        "my name is", "call me", "i live in", "i'm based in", "i am based in",
        "based in", "my phone", "my email", "reach me at", "my address",
        "founder of", "ceo of", "i run", "i own", "my company", "my business",
        "my role", "i work as", "my website", "my handle",
    ],
    "2. Family & Personal Context": [
        "my wife", "my husband", "my partner", "my son", "my daughter",
        "my kid", "my kids", "my children", "my family", "my dog", "my cat",
        "my pet", "years old", "my hobby", "my hobbies", "married",
        "divorced", "my household", "my home",
    ],
    "3. How I Work & Communicate": [
        "from now on", "going forward", "i prefer", "i want you to",
        "when you respond", "please format", "don't ever", "never do",
        "always do", "stop doing", "make sure you", "the rule is",
        "my rule", "i hate when", "i like when",
    ],
    "4. Projects & Products": [
        # user-supplied known names
        "cypher", "cipher", "apex360", "apex 360", "realty rocket",
        "echovault", "romeo", "legacy vault", "proteum", "ascension",
        "apex agent", "leadalpha",
        # generic markers
        "my project", "my product", "my app", "my saas", "my startup",
        "the agency", "we're building", "i'm building", "i am building",
    ],
    "5. Preferences & Rules": [
        "output format", "output as", "don't use emojis", "no emojis",
        "brand color", "visual style", "never use", "always use",
        "not acceptable", "i reject", "do not", "please don't",
    ],
    "6. Technical Environment": [
        # user-supplied known platforms
        "hermes", "claude code", "perplexity", "chatgpt", "abacus",
        "github", "supabase", "vercel", "netlify", "firebase", "ghl",
        # generic markers
        "aws", "azure", "gcp", "docker", "database", "api key", "hosting",
        "repo", "repository", "stack",
    ],
    "7. Legal / Case Context": [
        "lawsuit", "legal", "attorney", "lawyer", "court", "case number",
        "contract dispute", "sued", "subpoena", "settlement",
        "cease and desist", "nda breach",
    ],
}

# Extra section used only to seed Section 8 (verbatim statements) -- looks
# for the same rule/preference language as sections 3 and 5, but every hit
# is kept verbatim and deduped rather than summarized.
VERBATIM_TRIGGERS = DEFAULT_SECTIONS["3. How I Work & Communicate"] + [
    "i need", "i want", "my priority", "the goal is",
]

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(r"(?<!\d)(\+?\d[\d\-\s().]{7,}\d)(?!\d)")
URL_RE = re.compile(r"https?://[^\s)]+")


@dataclass
class Message:
    role: str  # "human" or "assistant"
    text: str
    created_at: str | None


@dataclass
class Conversation:
    conv_id: str
    title: str
    created_at: str | None
    messages: list[Message] = field(default_factory=list)

    def human_messages(self) -> Iterable[Message]:
        return (m for m in self.messages if m.role == "human")


@dataclass
class Hit:
    section: str
    keyword: str
    snippet: str
    conv_title: str
    conv_id: str
    timestamp: str | None


# ---------------------------------------------------------------------------
# Loading / normalizing the export. Claude.ai exports have shipped a couple
# of shapes over time (message text as a plain string vs. a list of content
# blocks, sender field named "sender" vs "role", etc.) -- normalize_message
# and normalize_conversation absorb that so the extraction logic below
# doesn't have to care.
# ---------------------------------------------------------------------------


def _extract_text(raw: Any) -> str:
    if isinstance(raw, str):
        return raw
    if isinstance(raw, list):
        parts = []
        for block in raw:
            if isinstance(block, dict):
                if isinstance(block.get("text"), str):
                    parts.append(block["text"])
            elif isinstance(block, str):
                parts.append(block)
        return "\n".join(parts)
    return ""


def _normalize_role(raw: Any) -> str:
    val = str(raw or "").lower()
    if val in ("human", "user"):
        return "human"
    if val in ("assistant", "ai", "bot"):
        return "assistant"
    return val or "unknown"


def normalize_message(raw: dict) -> Message | None:
    role = _normalize_role(raw.get("sender") or raw.get("role"))
    text = _extract_text(raw.get("text") if "text" in raw else raw.get("content"))
    if not text.strip():
        return None
    return Message(role=role, text=text, created_at=raw.get("created_at") or raw.get("timestamp"))


def normalize_conversation(raw: dict, fallback_id: str) -> Conversation:
    conv_id = str(raw.get("uuid") or raw.get("id") or fallback_id)
    title = raw.get("name") or raw.get("title") or f"Untitled ({conv_id[:8]})"
    created_at = raw.get("created_at")
    msgs_raw = raw.get("chat_messages") or raw.get("messages") or []
    messages = [m for m in (normalize_message(r) for r in msgs_raw if isinstance(r, dict)) if m]
    return Conversation(conv_id=conv_id, title=title, created_at=created_at, messages=messages)


def load_conversations(source: Path) -> list[Conversation]:
    conversations: list[Conversation] = []

    def load_json_blob(data: Any, name_hint: str):
        if isinstance(data, list):
            if data and isinstance(data[0], dict) and ("chat_messages" in data[0] or "messages" in data[0]):
                for i, item in enumerate(data):
                    conversations.append(normalize_conversation(item, f"{name_hint}-{i}"))
            elif data and isinstance(data[0], dict) and ("sender" in data[0] or "role" in data[0]):
                # a single conversation's message list with no wrapper
                conversations.append(normalize_conversation({"messages": data}, name_hint))
        elif isinstance(data, dict):
            if "chat_messages" in data or "messages" in data:
                conversations.append(normalize_conversation(data, name_hint))
            elif "conversations" in data and isinstance(data["conversations"], list):
                for i, item in enumerate(data["conversations"]):
                    conversations.append(normalize_conversation(item, f"{name_hint}-{i}"))

    if source.is_dir():
        for path in sorted(source.rglob("*.json")):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                continue
            load_json_blob(data, path.stem)
        for path in sorted(list(source.rglob("*.txt")) + list(source.rglob("*.md"))):
            text = path.read_text(encoding="utf-8", errors="ignore")
            conversations.append(
                Conversation(
                    conv_id=path.stem,
                    title=path.stem,
                    created_at=None,
                    messages=[Message(role="human", text=text, created_at=None)],
                )
            )
    elif source.suffix == ".zip":
        with zipfile.ZipFile(source) as zf:
            names = [n for n in zf.namelist() if n.endswith("conversations.json")]
            if not names:
                names = [n for n in zf.namelist() if n.endswith(".json")]
            for name in names:
                with zf.open(name) as fh:
                    try:
                        data = json.loads(fh.read().decode("utf-8"))
                    except (json.JSONDecodeError, UnicodeDecodeError):
                        continue
                load_json_blob(data, Path(name).stem)
    elif source.suffix == ".json":
        data = json.loads(source.read_text(encoding="utf-8"))
        load_json_blob(data, source.stem)
    else:
        raise ValueError(f"Unsupported input: {source} (expected a .zip, .json, or directory)")

    return conversations


# ---------------------------------------------------------------------------
# Extraction
# ---------------------------------------------------------------------------


def _snippet(text: str, keyword: str, radius: int = 160) -> str:
    idx = text.lower().find(keyword.lower())
    if idx == -1:
        return text.strip()[: radius * 2]
    start = max(0, idx - radius)
    end = min(len(text), idx + len(keyword) + radius)
    prefix = "..." if start > 0 else ""
    suffix = "..." if end < len(text) else ""
    return f"{prefix}{text[start:end].strip()}{suffix}"


def extract_hits(conversations: list[Conversation], sections: dict[str, list[str]]) -> list[Hit]:
    hits: list[Hit] = []
    for conv in conversations:
        for msg in conv.human_messages():
            lower = msg.text.lower()
            for section, keywords in sections.items():
                for kw in keywords:
                    if kw in lower:
                        hits.append(
                            Hit(
                                section=section,
                                keyword=kw,
                                snippet=_snippet(msg.text, kw),
                                conv_title=conv.title,
                                conv_id=conv.conv_id,
                                timestamp=msg.created_at or conv.created_at,
                            )
                        )
    return hits


def extract_contacts(conversations: list[Conversation]) -> list[Hit]:
    hits: list[Hit] = []
    for conv in conversations:
        for msg in conv.human_messages():
            for pattern, label in ((EMAIL_RE, "email"), (URL_RE, "url"), (PHONE_RE, "phone")):
                for m in pattern.finditer(msg.text):
                    hits.append(
                        Hit(
                            section="1. Identity & Contact",
                            keyword=f"[{label}] {m.group(0)}",
                            snippet=_snippet(msg.text, m.group(0)),
                            conv_title=conv.title,
                            conv_id=conv.conv_id,
                            timestamp=msg.created_at or conv.created_at,
                        )
                    )
    return hits


def extract_verbatim(conversations: list[Conversation]) -> list[Hit]:
    hits: list[Hit] = []
    seen: set[str] = set()
    for conv in conversations:
        for msg in conv.human_messages():
            lower = msg.text.lower()
            if any(t in lower for t in VERBATIM_TRIGGERS):
                for sentence in re.split(r"(?<=[.!?])\s+", msg.text.strip()):
                    s_lower = sentence.lower()
                    if any(t in s_lower for t in VERBATIM_TRIGGERS) and sentence not in seen:
                        seen.add(sentence)
                        hits.append(
                            Hit(
                                section="8. Verbatim Statements",
                                keyword="",
                                snippet=sentence.strip(),
                                conv_title=conv.title,
                                conv_id=conv.conv_id,
                                timestamp=msg.created_at or conv.created_at,
                            )
                        )
    return hits


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------


def render_dossier(conversations: list[Conversation], sections: dict[str, list[str]]) -> str:
    keyword_hits = extract_hits(conversations, sections)
    contact_hits = extract_contacts(conversations)
    verbatim_hits = extract_verbatim(conversations)

    by_section: dict[str, list[Hit]] = defaultdict(list)
    for h in keyword_hits + contact_hits:
        by_section[h.section].append(h)

    lines: list[str] = []
    lines.append("# Konshus/Alfred Context Export Dossier")
    lines.append("")
    lines.append(
        "Every line below was extracted from your own (human-authored) messages in the "
        "supplied export. Nothing here is inferred, summarized-then-guessed, or "
        "auto-completed. Sections with no matches are listed under Gaps, not filled in."
    )
    lines.append("")

    section_order = list(DEFAULT_SECTIONS.keys())
    for section in section_order:
        lines.append(f"## {section}")
        lines.append("")
        hits = by_section.get(section, [])
        if not hits:
            lines.append("_No matches found in this export._")
        else:
            dedup: dict[tuple[str, str], Hit] = {}
            for h in hits:
                dedup[(h.conv_id, h.snippet)] = h
            for h in dedup.values():
                ts = f", {h.timestamp}" if h.timestamp else ""
                lines.append(
                    f"- **[I SAID THIS]** \"{h.snippet}\" "
                    f"(matched: `{h.keyword}`; source: *{h.conv_title}*{ts})"
                )
        lines.append("")

    lines.append("## 8. Verbatim Statements")
    lines.append("")
    if not verbatim_hits:
        lines.append("_No matches found in this export._")
    else:
        seen_snips: set[str] = set()
        for h in verbatim_hits:
            if h.snippet in seen_snips:
                continue
            seen_snips.add(h.snippet)
            ts = f", {h.timestamp}" if h.timestamp else ""
            lines.append(f"- **[I SAID THIS]** \"{h.snippet}\" (source: *{h.conv_title}*{ts})")
    lines.append("")

    lines.append("## 9. Gaps")
    lines.append("")
    empty = [s for s in section_order if not by_section.get(s)]
    if not verbatim_hits:
        empty.append("8. Verbatim Statements")
    if empty:
        lines.append("No data found in this export for:")
        for s in empty:
            lines.append(f"- {s}")
    else:
        lines.append("_Every section had at least one match. Review each match for accuracy before trusting it._")
    lines.append("")

    lines.append("## 10. Source Inventory")
    lines.append("")
    if not conversations:
        lines.append("_No conversations parsed from this input._")
    else:
        lines.append("| Conversation | Date | ID | Human messages |")
        lines.append("|---|---|---|---|")
        for conv in conversations:
            n = sum(1 for _ in conv.human_messages())
            lines.append(f"| {conv.title} | {conv.created_at or 'unknown'} | `{conv.conv_id}` | {n} |")
    lines.append("")
    lines.append(
        "---\n\n_Generated by `konshus/export_pipeline.py`. Review every line above before "
        "feeding it to Alfred -- keyword matching finds candidates, it does not verify truth, "
        "and a match can be sarcasm, a hypothetical, or someone else's data quoted back to you._"
    )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input", type=Path, help="Path to export .zip, conversations.json, or a directory of exports")
    parser.add_argument("-o", "--output", type=Path, default=Path("dossier.md"), help="Output Markdown path")
    parser.add_argument("--keywords", type=Path, default=None, help="Optional JSON file overriding section keyword lists")
    args = parser.parse_args(argv)

    if not args.input.exists():
        print(f"error: input not found: {args.input}", file=sys.stderr)
        return 1

    sections = DEFAULT_SECTIONS
    if args.keywords:
        custom = json.loads(args.keywords.read_text(encoding="utf-8"))
        sections = {**DEFAULT_SECTIONS, **custom}

    conversations = load_conversations(args.input)
    if not conversations:
        print("warning: no conversations were parsed from this input", file=sys.stderr)

    dossier = render_dossier(conversations, sections)
    args.output.write_text(dossier, encoding="utf-8")
    print(f"Parsed {len(conversations)} conversation(s). Wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
