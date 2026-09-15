from dataclasses import dataclass, field
from enum import Enum
from uuid import uuid4

class EpistemicStatus(str, Enum):
    OBSERVED='observed'; DOCUMENTED='documented'; DERIVED='derived'; INTERPRETED='interpreted'; HYPOTHESIZED='hypothesized'; TRADITIONAL_ORAL='traditional_oral'; CONTESTED='contested'; UNKNOWN='unknown'

class Lifecycle(str, Enum):
    DRAFT='draft'; REVIEW='review'; PUBLISHED='published'; SUPERSEDED='superseded'; WITHDRAWN='withdrawn'; ARCHIVED='archived'

@dataclass(frozen=True)
class Identity:
    id: str
    organisation_id: str

@dataclass
class Resource:
    id: str = field(default_factory=lambda: str(uuid4()))
    organisation_id: str = ''
    lifecycle: Lifecycle = Lifecycle.DRAFT
    sensitive: bool = False
    public_precision: str = 'generalized'

@dataclass(frozen=True)
class PolicyContext:
    subject: Identity
    action: str
    purpose: str = 'general'
    precision: str = 'public'

@dataclass(frozen=True)
class Decision:
    decision: str
    obligations: tuple[str,...] = ()
    reason_code: str = ''

class PolicyBoundary:
    '''Reference-only policy boundary. Not production authorization.'''
    def decide(self, resource: Resource, ctx: PolicyContext) -> Decision:
        if ctx.subject.organisation_id != resource.organisation_id and ctx.purpose != 'federated_public':
            return Decision('deny', reason_code='TENANT_BOUNDARY')
        if resource.sensitive and ctx.precision == 'precise' and ctx.purpose != 'research':
            return Decision('deny', ('generalize_geometry',), 'SENSITIVE_PRECISION')
        if resource.sensitive and ctx.precision == 'public':
            return Decision('allow', ('generalize_geometry',), 'PUBLIC_GENERALIZATION')
        return Decision('allow', reason_code='POLICY_MATCH')

@dataclass(frozen=True)
class EvidenceLink:
    source_id: str
    evidence_id: str
    target_id: str
    epistemic_status: EpistemicStatus

class ProvenanceLedger:
    '''Append-only in-memory reference ledger for gate tests.'''
    def __init__(self): self.links=[]
    def append(self, link): self.links.append(link)
    def trace(self, target_id): return [x for x in self.links if x.target_id == target_id]

VALID_TRANSITIONS={
    Lifecycle.DRAFT:{Lifecycle.REVIEW,Lifecycle.ARCHIVED}, Lifecycle.REVIEW:{Lifecycle.PUBLISHED,Lifecycle.DRAFT,Lifecycle.ARCHIVED},
    Lifecycle.PUBLISHED:{Lifecycle.SUPERSEDED,Lifecycle.WITHDRAWN}, Lifecycle.SUPERSEDED:{Lifecycle.ARCHIVED}, Lifecycle.WITHDRAWN:{Lifecycle.ARCHIVED}, Lifecycle.ARCHIVED:set()
}
def can_transition(current,target): return target in VALID_TRANSITIONS[current]
