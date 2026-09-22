"""
Concept decay, in Python.

A fourth copy of the same eleven lines, and that is a deliberate trade: the
number appears in SQL (for queries that sort by it), in the Deno functions, in
the browser (so the roadmap can colour a node without a round trip) and here.
They must agree. If you change one, change all four:

    supabase/migrations/20260916090100_eduverse_core_schema.sql  concept_decay_risk()
    supabase/functions/_shared/decay.ts
    src/lib/mastery.ts
    backend/app/services/decay.py
"""

from __future__ import annotations

from datetime import datetime, timezone


def _parse(iso: str) -> datetime:
    value = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def decay_risk(peak_mastery: float, mastery: float, last_practiced_at: str | None) -> float:
    """
    0 means "no reason to revisit this". 100 means "this was learned and has
    been left alone long enough that it probably needs a refresher".

    Two contributions: time since the last practice (capped at 30 days, worth up
    to 60 points) and how far the current score has slipped below its peak
    (worth 0.4 points per point lost). A concept that was never really learned
    — peak below 50 — cannot decay, because there is nothing there to lose.
    """
    if not last_practiced_at or peak_mastery < 50:
        return 0.0

    try:
        elapsed = datetime.now(timezone.utc) - _parse(last_practiced_at)
    except ValueError:
        return 0.0

    days = min(elapsed.total_seconds() / 86_400, 30)
    from_time = (days / 30) * 60
    from_slip = max(peak_mastery - mastery, 0) * 0.4
    return min(100.0, max(0.0, from_time + from_slip))
