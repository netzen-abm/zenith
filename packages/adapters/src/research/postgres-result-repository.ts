import type { OperationEnvelope } from '../../contracts/src/operation.ts';
import type { ResearchProvider, ResearchQuery, ResearchResult } from '../../capabilities/src/research-intelligence.ts';
import type { ResearchResultStore, StoredResearchResult } from '../../capabilities/src/research/result-repository.ts';
import type { SqlClient } from './postgres-repository.ts';

type ResultRow = { result_set_id: string; result_hash: string; result_payload: ResearchResult | string };

function payload(value: ResearchResult | string): ResearchResult {
  return typeof value === 'string' ? JSON.parse(value) as ResearchResult : value;
}
function stored(row: ResultRow | undefined): StoredResearchResult | undefined {
  return row ? { resultSetId: row.result_set_id, resultHash: row.result_hash, result: payload(row.result_payload) } : undefined;
}

export class PostgresResearchResultStore implements ResearchResultStore {
  private readonly db: SqlClient;

  constructor(db: SqlClient) {
    this.db = db;
  }

  async save(operation: OperationEnvelope, query: ResearchQuery, provider: Pick<ResearchProvider, 'providerId'|'adapterVersion'>, result: ResearchResult): Promise<StoredResearchResult> {
    if (!operation.contentHash) throw new Error('research_operation_payload_hash_required');
    if (result.queryId !== query.queryId || result.providerId !== provider.providerId || !result.providerQueryReference) {
      throw new Error('research_result_identity_mismatch');
    }
    const persisted = await this.db.query<{ result_set_id: string; result_hash: string }>(
      'select * from core_private.persist_research_query_result_set($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8::jsonb)',
      [operation.operationId, query.queryId, provider.providerId, provider.adapterVersion, operation.contentHash,
        query.cursor?.trim() || '*', result.providerQueryReference, JSON.stringify(result)],
    );
    const row = persisted.rows[0];
    if (!row?.result_set_id) {
      throw new Error('research_result_persistence_failed:result_set_id_missing');
    }
    if (!row.result_hash) {
      throw new Error('research_result_persistence_failed:result_hash_missing');
    }
    return { resultSetId: row.result_set_id, resultHash: row.result_hash, result };
  }

  async findForOperation(operation: OperationEnvelope, query: ResearchQuery, providerId: string): Promise<StoredResearchResult | undefined> {
    if (!operation.contentHash) return undefined;
    const found = await this.db.query<ResultRow>(
      `select r.id as result_set_id, r.result_hash, r.result_payload
         from core.research_query_result_sets r
         join operations.operations o on o.id = $1::uuid
        where o.organisation_id = $2::uuid and o.identity_id = $3::uuid
          and o.action = 'research.query' and o.payload_ref = $4 and o.payload_hash = $5
          and r.organisation_id = $2::uuid and r.identity_id = $3::uuid
          and r.query_id = $4::uuid and r.request_hash = $5 and r.provider_id = $6
        order by r.retrieved_at desc, r.created_at desc
        limit 1`,
      [operation.operationId, query.organisationId, query.requesterIdentityId, query.queryId, operation.contentHash, providerId],
    );
    return stored(found.rows[0]);
  }

  async get(resultSetId: string, organisationId: string, identityId: string): Promise<StoredResearchResult | undefined> {
    const found = await this.db.query<ResultRow>(
      `select r.id as result_set_id, r.result_hash, r.result_payload
         from core.research_query_result_sets r
        where r.id = $1::uuid and r.organisation_id = $2::uuid and r.identity_id = $3::uuid
        limit 1`,
      [resultSetId, organisationId, identityId],
    );
    return stored(found.rows[0]);
  }
}
