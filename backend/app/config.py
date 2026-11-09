"""Application settings — loaded from environment / .env file."""
from functools import lru_cache

from pydantic import ValidationInfo, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"
    api_prefix: str = "/api"
    cors_origins: str = "http://localhost:3000"

    # Auth — SECRET_KEY signs session tokens. Production refuses to start with
    # the dev default (see validate_for_production).
    secret_key: str = "dev-secret"
    access_token_expire_minutes: int = 60
    # Comma-separated emails of platform owners (credential vault, all users,
    # audit log, demo reset).
    owner_emails: str = ""

    # Optional hardening — when set, mutating requests require X-API-Key.
    api_key: str | None = None

    # LLM — Groq (OpenAI-compatible). Free tier model works for the demo.
    groq_api_key: str | None = None
    groq_model: str = "openai/gpt-oss-120b"

    # Email — either provider works, both have free tiers.
    # Option A: Resend API (resend.com — 3,000 emails/mo free).
    resend_api_key: str | None = None
    resend_from: str = "Autopilot <onboarding@resend.dev>"
    # Option B: any free SMTP (Brevo 300/day, Gmail app password, MailerSend).
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None  # defaults to smtp_user

    # Database — MongoDB Atlas (Motor). When unset the app keeps working
    # fully in-memory.
    mongodb_uri: str | None = None
    mongodb_db: str = "autopilot"

    # Freelancer.com connector — official API (OAuth). When unset, the connector
    # serves a realistic sandbox feed so the UI works in the demo.
    freelancer_oauth_token: str | None = None
    freelancer_sandbox: bool = True
    # Keep production API calls disabled until written permission covers this
    # commercial, multi-user product (see docs/platform-matrix.md).
    freelancer_api_approved: bool = False

    # Upwork OAuth is per-user through Nango; commercial use needs written approval.
    upwork_commercial_approved: bool = False
    # Operation-specific approval switches. A general API key or commercial
    # approval does not imply proposal or message permissions.
    upwork_proposal_submit_approved: bool = False
    upwork_message_read_approved: bool = False
    upwork_message_send_approved: bool = False

    # Reddit's Data API requires OAuth, and commercial use requires approval.
    reddit_access_token: str | None = None
    reddit_commercial_approved: bool = False
    hn_commercial_reuse_approved: bool = False

    # Job Radar sources (backend/app/job_sources.py). Comma-separated source ids.
    # APPROVED turns on public feeds whose reuse terms needed a recorded review;
    # DISABLED switches any source off, including default-on public feeds.
    job_sources_approved: str = ""
    job_sources_disabled: str = ""
    # Optional keys for job-search APIs; each source stays off until its key is set
    # (The Muse works without one at a lower rate limit).
    the_muse_api_key: str | None = None
    usajobs_api_key: str | None = None
    usajobs_user_agent: str | None = None  # the email registered with the key
    adzuna_app_id: str | None = None
    adzuna_app_key: str | None = None
    adzuna_country: str = "us"
    jooble_api_key: str | None = None
    reed_api_key: str | None = None
    findwork_api_token: str | None = None
    web3_career_token: str | None = None

    # Automation Worker (browser automation, separate service). When unset, the
    # automation engine simulates the step log so the queue/approval UX works.
    worker_url: str | None = None
    worker_key: str | None = None

    # Launch mode: only real data. Demo/fabricated seeds are opt-IN for
    # development — set SEED_DEMO_DATA=true locally to explore with mock data.
    # When false, startup also purges fabricated collections already persisted.
    seed_demo_data: bool = False
    database_url: str | None = None
    redis_url: str | None = None
    sentry_dsn: str | None = None
    chromadb_url: str | None = None
    inbound_email_domain: str | None = None
    inbound_email_webhook_secret: str | None = None
    inbound_email_platforms: str = ""
    # Outlook inbox import stays disabled until the approved OAuth consent,
    # Mail.Read scope, and privacy review are complete.
    outlook_inbox_read_approved: bool = False
    nango_secret_key: str | None = None
    nango_base_url: str = "https://api.nango.dev"
    # Comma-separated Nango integration IDs explicitly enabled for user OAuth.
    nango_integrations: str = ""
    composio_api_key: str | None = None
    # Empty means no toolkit can be exposed to an agent.
    composio_allowed_toolkits: str = ""
    activepieces_webhook_url: str | None = None
    activepieces_webhook_secret: str | None = None

    @field_validator("*", mode="before")
    @classmethod
    def _blank_is_unset(cls, value, info: ValidationInfo):
        # Hosting dashboards (Render prompts for every `sync: false` key) can
        # store a cleared variable as "". For switches and numbers that means
        # "use the default"; blank strings stay blank so tests can override .env.
        if value == "" and info.field_name:
            field = cls.model_fields[info.field_name]
            if field.annotation in (bool, int):
                return field.default
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def owner_email_set(self) -> set[str]:
        return {e.strip().lower() for e in self.owner_emails.split(",") if e.strip()}

    def validate_for_production(self) -> None:
        """Fail fast on settings that would make a production deploy insecure."""
        if self.environment != "production":
            return
        if self.secret_key in ("dev-secret", "change-me-in-production") or len(self.secret_key) < 32:
            raise RuntimeError(
                "SECRET_KEY must be a random value of at least 32 characters in production."
            )


@lru_cache
def get_settings() -> Settings:
    return Settings()
