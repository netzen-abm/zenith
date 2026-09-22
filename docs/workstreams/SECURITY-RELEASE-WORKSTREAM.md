# Security and Release Engineering Workstream

## Objective
Make repository and release hygiene an enforceable engineering property.

## Controls
- immutable CI action pins
- CodeQL and dependency monitoring
- source-size governance based on inspected content
- fresh-database reconciliation
- SQL security checks
- execution-kernel conformance
- branch lifecycle governance
- release provenance

## Branch rule
Nine active slots are reserved for substantive workstreams. Historical, merged, superseded and obsolete branches must be retired; placeholder branches are prohibited.

## Acceptance gate
A release is eligible only when architecture, security and repository-integrity gates pass.
