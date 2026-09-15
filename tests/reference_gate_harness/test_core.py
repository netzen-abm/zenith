from core import *

def test_tenant_isolation():
    a=Identity('u-a','org-a'); b=Identity('u-b','org-b'); r=Resource(organisation_id='org-a')
    d=PolicyBoundary().decide(r,PolicyContext(b,'read'))
    assert d.decision=='deny' and d.reason_code=='TENANT_BOUNDARY'

def test_sensitive_public_geometry_is_generalized():
    u=Identity('u','org-a'); r=Resource(organisation_id='org-a',sensitive=True)
    d=PolicyBoundary().decide(r,PolicyContext(u,'read',purpose='public',precision='public'))
    assert d.decision=='allow' and 'generalize_geometry' in d.obligations

def test_sensitive_precise_requires_research_context():
    u=Identity('u','org-a'); r=Resource(organisation_id='org-a',sensitive=True)
    assert PolicyBoundary().decide(r,PolicyContext(u,'read',purpose='public',precision='precise')).decision=='deny'

def test_epistemic_status_never_collapses():
    assert EpistemicStatus.OBSERVED != EpistemicStatus.HYPOTHESIZED
    assert EpistemicStatus.DOCUMENTED != EpistemicStatus.TRADITIONAL_ORAL

def test_provenance_is_append_only_and_traceable():
    p=ProvenanceLedger(); p.append(EvidenceLink('source-1','evidence-1','claim-1',EpistemicStatus.DOCUMENTED)); p.append(EvidenceLink('source-2','evidence-2','claim-1',EpistemicStatus.INTERPRETED))
    trace=p.trace('claim-1'); assert len(trace)==2 and {x.source_id for x in trace}=={'source-1','source-2'}

def test_lifecycle_transitions():
    assert can_transition(Lifecycle.DRAFT,Lifecycle.REVIEW)
    assert can_transition(Lifecycle.REVIEW,Lifecycle.PUBLISHED)
    assert can_transition(Lifecycle.PUBLISHED,Lifecycle.WITHDRAWN)
    assert not can_transition(Lifecycle.ARCHIVED,Lifecycle.PUBLISHED)
