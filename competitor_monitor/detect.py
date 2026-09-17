"""Compare freshly scraped pages against stored state and record changes."""

from __future__ import annotations

import difflib
import hashlib
import logging
import re
from dataclasses import dataclass
from urllib.parse import urlsplit, urlunsplit

from .config import CompetitorConfig, DetectionConfig
from .scraper import ScrapedPage
from .storage import PageRow, Store

log = logging.getLogger(__name__)


@dataclass
class Change:
    competitor: str
    url: str
    page_type: str
    title: str | None
    change_type: str  # 'new' | 'changed'
    diff_text: str
    changed_chars: int


def normalize_url(url: str) -> str:
    """Strip fragments, tracking params and trailing slashes so the same page hashes once."""
    parts = urlsplit(url)
    query = "&".join(
        kv for kv in parts.query.split("&")
        if kv and not kv.lower().startswith(("utm_", "ref=", "fbclid=", "gclid="))
    )
    path = parts.path.rstrip("/") or "/"
    return urlunsplit((parts.scheme, parts.netloc.lower(), path, query, ""))


def normalize_content(text: str) -> str:
    """Whitespace-normalise before hashing so reflowed markup doesn't register as a change."""
    lines = [re.sub(r"[ \t]+", " ", ln).strip() for ln in text.splitlines()]
    return "\n".join(ln for ln in lines if ln)


def content_hash(text: str) -> str:
    return hashlib.sha256(normalize_content(text).encode("utf-8")).hexdigest()


def classify_page_type(url: str, competitor: CompetitorConfig) -> str:
    """Inherit the page type of the configured start URL this page lives under."""
    best: tuple[int, str] = (-1, "other")
    for p in competitor.pages:
        prefix = normalize_url(str(p.url))
        if url == prefix or url.startswith(prefix + "/"):
            if len(prefix) > best[0]:
                best = (len(prefix), p.type)
    return best[1]


def unified_diff(old: str, new: str, url: str) -> tuple[str, int]:
    old_lines = normalize_content(old).splitlines(keepends=True)
    new_lines = normalize_content(new).splitlines(keepends=True)
    diff = list(difflib.unified_diff(old_lines, new_lines, fromfile=f"before {url}", tofile=f"after {url}", n=2))
    changed_chars = sum(
        len(ln) - 1 for ln in diff
        if (ln.startswith("+") or ln.startswith("-")) and not ln.startswith(("+++", "---"))
    )
    return "".join(diff), changed_chars


def detect_changes(
    store: Store,
    run_id: int,
    competitor: CompetitorConfig,
    pages: list[ScrapedPage],
    detection: DetectionConfig,
    full: bool = False,
) -> list[Change]:
    """Persist the new page state and return the list of meaningful changes.

    On the first run for a competitor there is nothing to diff against, so every
    page is stored as baseline and (unless ``full``) no change is reported.
    """
    had_baseline = store.has_baseline(competitor.slug)
    changes: list[Change] = []
    seen: set[str] = set()

    for page in pages:
        url = normalize_url(page.url)
        if url in seen:
            continue
        seen.add(url)

        new_hash = content_hash(page.content)
        page_type = classify_page_type(url, competitor)
        prev = store.get_page(competitor.slug, url)
        row = PageRow(competitor.slug, url, page_type, page.title or None, new_hash, page.content)

        if prev is None:
            store.upsert_page(row, changed=True)
            if had_baseline or full:
                changes.append(Change(
                    competitor.slug, url, page_type, page.title, "new",
                    normalize_content(page.content), len(page.content),
                ))
            continue

        if prev.content_hash == new_hash:
            store.upsert_page(row, changed=False)
            if full:
                changes.append(Change(
                    competitor.slug, url, page_type, page.title, "unchanged",
                    normalize_content(page.content), 0,
                ))
            continue

        diff_text, changed_chars = unified_diff(prev.content, page.content, url)
        store.upsert_page(row, changed=True)
        if changed_chars < detection.min_changed_chars and not full:
            log.info("[%s] ignoring minor change (%d chars) on %s", competitor.slug, changed_chars, url)
            continue
        changes.append(Change(
            competitor.slug, url, page_type, page.title, "changed", diff_text, changed_chars
        ))

    for c in changes:
        if c.change_type != "unchanged":
            store.add_change(run_id, c.competitor, c.url, c.page_type, c.title,
                             c.change_type, c.diff_text, c.changed_chars)
    store.commit()

    if not had_baseline and not full:
        log.info("[%s] baseline stored (%d pages); changes will be reported from the next run",
                 competitor.slug, len(seen))
    else:
        log.info("[%s] %d page(s) to analyze", competitor.slug, len(changes))
    return changes
