"""AI analysis of detected changes using Claude.

Two calls per run:
1. ``analyze_competitor`` - once per competitor with changes; returns structured
   insights (category, significance, implications for us, recommended action).
2. ``write_executive_summary`` - once, across all competitors; returns a short
   narrative for the top of the report.
"""

from __future__ import annotations

import json
import logging
from typing import Literal

import anthropic
from pydantic import BaseModel, Field

from .config import AnalysisConfig, CompanyConfig, CompetitorConfig
from .detect import Change

log = logging.getLogger(__name__)

# Opus 5 safety classifiers can decline a request. With server-side fallbacks the
# API re-runs a declined request on Anthropic's recommended fallback model instead
# of returning a refusal, so a single odd competitor page can't blank the report.
_BETAS = ["server-side-fallback-2026-07-01"]

Category = Literal[
    "new_feature", "product_update", "pricing_change", "business_change",
    "partnership_or_integration", "content_or_marketing", "hiring_or_team", "other",
]


class Insight(BaseModel):
    category: Category
    significance: Literal["high", "medium", "low"] = Field(
        description="high = likely to affect our roadmap, pricing or positioning within a quarter; "
                    "medium = worth tracking; low = minor or routine."
    )
    title: str = Field(description="One line, specific, no marketing fluff.")
    summary: str = Field(description="2-4 sentences: what changed, with concrete details (numbers, names, dates).")
    implications_for_us: str = Field(description="What this means for our product, pricing, sales or positioning.")
    recommended_action: str = Field(description="One concrete next step, and who should own it (PM, Sales, Marketing, Eng).")
    evidence_urls: list[str] = Field(description="URLs from the provided pages that support this insight.")


class CompetitorAnalysis(BaseModel):
    insights: list[Insight]
    ignored_as_noise: str = Field(
        description="Brief note on which provided changes were skipped as cosmetic/noise, or 'none'."
    )


class ExecutiveSummary(BaseModel):
    headline: str = Field(description="One sentence: the single most important development this period.")
    summary: str = Field(description="3-6 short paragraphs or bullets covering the key themes across competitors.")
    watch_list: list[str] = Field(description="Up to 5 things to watch next period.")


def _system_prompt(company: CompanyConfig) -> str:
    return f"""You are a competitive-intelligence analyst working for {company.name} ({company.website}).

About {company.name}:
{company.profile}

Your job: read raw diffs and page contents captured from competitor websites and extract
what actually matters to {company.name}'s product, pricing, sales and marketing teams.

Guidelines:
- Report facts from the material provided. Never invent features, prices or dates that are not in the text.
- Prefer specifics: exact prices, model names, feature names, regions, customer names, dates.
- Cosmetic changes (copy tweaks, reordered testimonials, cookie banners, rotating logos, updated
  copyright years, tracking parameters) are noise - do not create insights for them.
- Merge related changes across pages into a single insight rather than one per page.
- For 'changed' pages you receive a unified diff: lines starting with '-' were removed, '+' were added.
  Judge significance by what was added/removed, not by the surrounding context lines.
- For 'new' pages (e.g. a new blog post or changelog entry) you receive the full content.
- Frame implications and actions specifically for {company.name}; generic advice is not useful.
- Return only the structured output requested."""


def _format_changes(competitor: CompetitorConfig, changes: list[Change]) -> str:
    parts = [f"# Competitor: {competitor.name} ({competitor.domain})\n"]
    for c in changes:
        parts.append(
            f"\n## [{c.change_type.upper()}] {c.page_type} page: {c.url}\n"
            f"Title: {c.title or '(none)'}\n"
            f"Changed characters: {c.changed_chars}\n\n"
            f"```\n{c.diff_text}\n```\n"
        )
    return "".join(parts)


def _check_stop(response: anthropic.types.Message, context: str) -> None:
    if response.stop_reason == "refusal":
        details = response.stop_details
        raise RuntimeError(
            f"{context}: model declined the request"
            + (f" (category={details.category}: {details.explanation})" if details else "")
        )
    if response.stop_reason == "max_tokens":
        raise RuntimeError(f"{context}: output truncated at max_tokens; raise the limit")


def analyze_competitor(
    client: anthropic.Anthropic,
    config: AnalysisConfig,
    company: CompanyConfig,
    competitor: CompetitorConfig,
    changes: list[Change],
) -> CompetitorAnalysis:
    user_content = (
        _format_changes(competitor, changes)
        + "\n\nAnalyze the material above and extract the insights that matter."
    )
    log.info("[%s] analyzing %d change(s) with %s", competitor.slug, len(changes), config.model)

    response = client.beta.messages.parse(
        model=config.model,
        max_tokens=16000,
        betas=_BETAS,
        fallbacks="default",
        thinking={"type": "adaptive"},
        output_config={"effort": config.effort},
        system=[{
            "type": "text",
            "text": _system_prompt(company),
            "cache_control": {"type": "ephemeral"},
        }],
        messages=[{"role": "user", "content": user_content}],
        output_format=CompetitorAnalysis,
    )
    _check_stop(response, f"[{competitor.slug}] analysis")
    if response.parsed_output is None:
        raise RuntimeError(f"[{competitor.slug}] analysis: could not parse structured output")
    _log_usage(response, competitor.slug)
    return response.parsed_output


def write_executive_summary(
    client: anthropic.Anthropic,
    config: AnalysisConfig,
    company: CompanyConfig,
    insights_by_competitor: dict[str, list[Insight]],
    period_label: str,
) -> ExecutiveSummary:
    payload = {
        name: [i.model_dump() for i in insights]
        for name, insights in insights_by_competitor.items()
    }
    user_content = (
        f"Reporting period: {period_label}\n\n"
        f"Structured insights extracted from competitor websites this period:\n\n"
        f"```json\n{json.dumps(payload, indent=2)}\n```\n\n"
        f"Write the executive summary for {company.name}'s leadership and product team. "
        "Lead with what is most consequential, group by theme where competitors are moving "
        "in the same direction, and be direct about what we should do."
    )

    response = client.beta.messages.parse(
        model=config.model,
        max_tokens=16000,
        betas=_BETAS,
        fallbacks="default",
        thinking={"type": "adaptive"},
        output_config={"effort": config.effort},
        system=[{
            "type": "text",
            "text": _system_prompt(company),
            "cache_control": {"type": "ephemeral"},
        }],
        messages=[{"role": "user", "content": user_content}],
        output_format=ExecutiveSummary,
    )
    _check_stop(response, "executive summary")
    if response.parsed_output is None:
        raise RuntimeError("executive summary: could not parse structured output")
    _log_usage(response, "summary")
    return response.parsed_output


def _log_usage(response: anthropic.types.Message, label: str) -> None:
    u = response.usage
    log.info(
        "[%s] tokens in=%d cache_read=%s cache_write=%s out=%d model=%s",
        label, u.input_tokens, u.cache_read_input_tokens, u.cache_creation_input_tokens,
        u.output_tokens, response.model,
    )
