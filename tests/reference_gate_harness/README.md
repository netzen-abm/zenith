# ZENITH Reference Gate Harness

Non-production reference implementation preserved from the Past Intelligence Core gate harness v0.1.

It covers tenant-boundary decisions, sensitive-heritage generalization/denial, epistemic separation, provenance tracing and lifecycle transitions.

It is **not** the production authorization system and cannot by itself establish the final architecture/runtime gate. Production verification must run against the real PostgreSQL/PostGIS, RLS, trusted identity context, durable audit/outbox, federation, AI and infrastructure layers.

Run from this directory with `python -m pytest -q` when pytest is available.
