# Space-Time Workstream

## Objective
Provide reusable spatial and temporal primitives for archaeological research without coupling the ecosystem to a single map, GIS vendor, or device.

## Scope
- site and feature geometry
- coordinate precision policies
- temporal intervals and uncertainty
- spatial/temporal queries
- sensitive-location redaction
- field and remote-sensing interoperability

## Safety boundary
Exact coordinates for vulnerable archaeological resources must be policy-controlled. Public, researcher and authorized institutional views may expose different precision.

## Acceptance gate
Spatial and temporal operations consume shared identity, authorization, tenant/RLS, operation, reservation, outcome and provenance contracts.
