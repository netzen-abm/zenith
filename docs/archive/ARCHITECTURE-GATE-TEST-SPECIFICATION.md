# ZENITH — Final Architecture Gate Test Specification v1.0

## Objective
Convert architecture conditions into explicit acceptance tests. Production implementation is not considered ready unless all CRITICAL tests pass and HIGH tests are either passed or have an explicitly approved non-blocking remediation plan.

## Required fixture classes
The gate must include at least two organisations, public resources, restricted archaeology, community knowledge, federated records and AI/tool calls. Tests must include positive and negative cases; security tests must prove denial as well as successful access.

## Critical gate families
- Tenant isolation
- Policy context and authorization
- Sensitive heritage precision/generalization
- Evidence and provenance continuity
- Epistemic separation
- Lifecycle integrity
- Auditability
- Federation authority/rights/provenance
- AI context restriction
- Cross-surface consistency

## Representative negative tests
- Authenticated user from organisation B cannot read organisation A protected resource.
- Public route cannot expose precise sensitive heritage geometry.
- UI route cannot escalate spatial precision.
- AI cannot retrieve protected evidence outside the caller's authorization context.
- A hypothesis cannot be silently returned as an observed fact.
- A federation mapping cannot erase source authority or provenance.
- Background workers cannot acquire blanket tenant authority.

## Evidence standard
Unit tests alone do not constitute an architecture-gate pass. The final gate must run against the real authorization/data layers and cover runtime, audit, backup/restore, federation and performance dependencies.
