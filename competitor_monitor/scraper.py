"""Page scraping backends.

- ``apify``: runs Apify's Website Content Crawler once per competitor and returns
  cleaned markdown/text for every crawled page. This is the production backend.
- ``http``: a dependency-free fallback that fetches each configured URL directly
  and strips the HTML. Useful for smoke tests without an Apify token; it does not
  follow links (``depth`` is ignored) and cannot render JS-only pages.
"""

from __future__ import annotations

import logging
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser

from .config import CompetitorConfig, ScraperConfig

log = logging.getLogger(__name__)


@dataclass
class ScrapedPage:
    url: str
    title: str
    content: str  # markdown when available, otherwise plain text
    fetched_at: str  # ISO-8601 UTC


# --------------------------------------------------------------------------- #
# Apify backend
# --------------------------------------------------------------------------- #


def _build_crawler_input(competitor: CompetitorConfig, scraper: ScraperConfig) -> dict:
    """Translate a competitor's page list into Website Content Crawler input.

    Start URLs are always fetched. For pages configured with depth > 0 we add a
    glob so the crawler is allowed to follow links beneath that path (e.g. new
    blog posts under /blog/), while everything else on the site stays out.
    """
    start_urls = [{"url": str(p.url)} for p in competitor.pages]
    max_depth = max(p.depth for p in competitor.pages)
    include_globs = [
        {"glob": str(p.url).rstrip("/") + "/**"} for p in competitor.pages if p.depth > 0
    ]
    return {
        "startUrls": start_urls,
        "crawlerType": "playwright:adaptive",
        "maxCrawlDepth": max_depth,
        "maxCrawlPages": scraper.max_pages_per_competitor,
        "includeUrlGlobs": include_globs,
        "saveMarkdown": True,
        "saveHtml": False,
        "saveScreenshots": False,
        "htmlTransformer": "readableText",
        "removeCookieWarnings": True,
        "removeElementsCssSelector": "nav, footer, script, style, noscript, svg, img[src^='data:'], [role=\"alert\"], [role=\"banner\"], [role=\"dialog\"], [role=\"alertdialog\"], [role=\"region\"][aria-label*=\"skip\" i], [aria-modal=\"true\"]",
        "proxyConfiguration": {"useApifyProxy": True},
    }


def scrape_with_apify(
    competitor: CompetitorConfig, scraper: ScraperConfig, token: str
) -> list[ScrapedPage]:
    from apify_client import ApifyClient

    client = ApifyClient(token)
    run_input = _build_crawler_input(competitor, scraper)
    log.info("[%s] starting Apify run (%d start URLs)", competitor.slug, len(run_input["startUrls"]))

    run = client.actor(scraper.actor_id).call(
        run_input=run_input,
        timeout_secs=scraper.timeout_seconds,
        wait_secs=scraper.timeout_seconds,
        # The actor's own log is very chatty; only stream it when we're in debug mode.
        logger="default" if log.isEnabledFor(logging.DEBUG) else None,
    )
    if not run or run.get("status") != "SUCCEEDED":
        status = run.get("status") if run else "no run returned"
        raise RuntimeError(f"[{competitor.slug}] Apify run did not succeed: {status}")

    pages: list[ScrapedPage] = []
    for item in client.dataset(run["defaultDatasetId"]).iterate_items():
        content = (item.get("markdown") or item.get("text") or "").strip()
        if not content:
            continue
        crawl = item.get("crawl") or {}
        metadata = item.get("metadata") or {}
        pages.append(
            ScrapedPage(
                url=crawl.get("loadedUrl") or item.get("url"),
                title=(metadata.get("title") or "").strip(),
                content=content,
                fetched_at=crawl.get("loadedTime") or _now_iso(),
            )
        )
    log.info("[%s] Apify returned %d pages", competitor.slug, len(pages))
    return pages


# --------------------------------------------------------------------------- #
# Plain HTTP fallback
# --------------------------------------------------------------------------- #

_SKIP_TAGS = {"script", "style", "noscript", "svg", "nav", "footer", "header", "iframe"}
_BLOCK_TAGS = {"p", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6", "tr", "br", "section", "article"}


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._skip_depth = 0
        self._in_title = False
        self.title = ""
        self._parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in _SKIP_TAGS:
            self._skip_depth += 1
        elif tag == "title":
            self._in_title = True
        elif tag in _BLOCK_TAGS:
            self._parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in _SKIP_TAGS and self._skip_depth:
            self._skip_depth -= 1
        elif tag == "title":
            self._in_title = False
        elif tag in _BLOCK_TAGS:
            self._parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data
        elif not self._skip_depth:
            self._parts.append(data)

    def text(self) -> str:
        raw = "".join(self._parts)
        lines = [re.sub(r"[ \t]+", " ", ln).strip() for ln in raw.splitlines()]
        return re.sub(r"\n{3,}", "\n\n", "\n".join(ln for ln in lines if ln)).strip()


def _fetch_one(url: str) -> ScrapedPage | None:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; RetellCompetitorMonitor/0.1)",
            "Accept": "text/html,application/xhtml+xml",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            html = resp.read().decode(resp.headers.get_content_charset() or "utf-8", "replace")
            final_url = resp.geturl()
    except Exception as exc:  # noqa: BLE001 - one bad page must not abort the run
        log.warning("fetch failed for %s: %s", url, exc)
        return None
    parser = _TextExtractor()
    parser.feed(html)
    content = parser.text()
    if not content:
        return None
    return ScrapedPage(url=final_url, title=parser.title.strip(), content=content, fetched_at=_now_iso())


def scrape_with_http(competitor: CompetitorConfig) -> list[ScrapedPage]:
    urls = [str(p.url) for p in competitor.pages]
    log.info("[%s] fetching %d URLs over plain HTTP", competitor.slug, len(urls))
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(_fetch_one, urls))
    return [p for p in results if p]


# --------------------------------------------------------------------------- #


def scrape_competitor(
    competitor: CompetitorConfig, scraper: ScraperConfig, apify_token: str | None
) -> list[ScrapedPage]:
    if scraper.backend == "apify":
        if not apify_token:
            raise RuntimeError(
                "APIFY_TOKEN is not set. Add it to .env, or set scraper.backend to 'http' "
                "in config/competitors.json for a token-free smoke test."
            )
        return scrape_with_apify(competitor, scraper, apify_token)
    return scrape_with_http(competitor)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")
