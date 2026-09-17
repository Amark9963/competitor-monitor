"""Configuration loading and validation."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from pydantic import BaseModel, Field, HttpUrl

PageType = Literal[
    "homepage", "pricing", "features", "changelog", "blog", "docs", "about", "careers", "other"
]


class PageConfig(BaseModel):
    url: HttpUrl
    type: PageType = "other"
    depth: int = Field(default=0, ge=0, le=3)


class CompetitorConfig(BaseModel):
    name: str
    slug: str
    domain: str
    pages: list[PageConfig]


class CompanyConfig(BaseModel):
    name: str
    website: str
    profile: str


class ScraperConfig(BaseModel):
    backend: Literal["apify", "http"] = "apify"
    actor_id: str = "apify/website-content-crawler"
    max_pages_per_competitor: int = 40
    timeout_seconds: int = 900


class DetectionConfig(BaseModel):
    # Changes whose added+removed text is shorter than this are treated as noise
    # (rotating testimonials, "last updated" dates, cookie banners, etc.).
    min_changed_chars: int = 120


class AnalysisConfig(BaseModel):
    model: str = "claude-opus-5"
    effort: Literal["low", "medium", "high", "xhigh", "max"] = "high"


class Config(BaseModel):
    company: CompanyConfig
    competitors: list[CompetitorConfig]
    scraper: ScraperConfig = ScraperConfig()
    detection: DetectionConfig = DetectionConfig()
    analysis: AnalysisConfig = AnalysisConfig()


class Env(BaseModel):
    apify_token: str | None
    slack_webhook_url: str | None
    db_path: Path
    reports_dir: Path
    # Shared secret required by POST /api/runs when set (public deployments).
    run_token: str | None
    # Copied to db_path on first start when db_path does not exist yet (fresh disk).
    seed_db: Path | None


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG_PATH = PROJECT_ROOT / "config" / "competitors.json"


def load_config(path: Path | None = None) -> Config:
    path = path or DEFAULT_CONFIG_PATH
    with path.open("r", encoding="utf-8") as f:
        return Config.model_validate(json.load(f))


def load_env() -> Env:
    load_dotenv(PROJECT_ROOT / ".env")
    return Env(
        apify_token=os.getenv("APIFY_TOKEN") or None,
        slack_webhook_url=os.getenv("SLACK_WEBHOOK_URL") or None,
        db_path=Path(os.getenv("MONITOR_DB_PATH", PROJECT_ROOT / "data" / "monitor.db")),
        reports_dir=Path(os.getenv("MONITOR_REPORTS_DIR", PROJECT_ROOT / "reports")),
        run_token=os.getenv("MONITOR_RUN_TOKEN") or None,
        seed_db=Path(os.getenv("MONITOR_SEED_DB")) if os.getenv("MONITOR_SEED_DB") else None,
    )


def ensure_seeded(env: Env) -> bool:
    """Copy the seed database into place if the target does not exist yet. Returns True if copied."""
    if env.seed_db is None or env.db_path.exists():
        return False
    seed = env.seed_db if env.seed_db.is_absolute() else PROJECT_ROOT / env.seed_db
    if not seed.exists():
        return False
    import shutil

    env.db_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(seed, env.db_path)
    return True
