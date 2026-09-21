import type { ResearchQuery, ResearchQueryStore } from './research-operation.ts';

export type SqlRow = Readonly<Record<string, unknown>>;
export type SqlClient = {
  query<T extends SqlRow = SqlRow>(text: string, values?: readonly unknown[]): Promise<{ rows: readonly T[] }>;
};

type ResearchQueryRow = {
  id: string;
  research_question_id: string | null;
  intent: string;
  query_text: string;
  concepts: unknown;
  filters: unknown;
  sort: unknown;
  page_size: number;
  cursor: string | null;
  requested_fields: unknown;
  open_access_required: boolean;
  requester_identity_id: string;
  organisation_id: string;
  purpose: string;
};

function arrayOfStrings(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    throw new Error('research_query_json_shape_invalid');
  }
  return value;
}

function objectRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('research_query_filter_shape_invalid');
  }
  return value as Readonly<Record<string, unknown>>;
}

function toQuery(row: ResearchQueryRow): ResearchQuery {
  return {
    queryId: row.id,
    researchQuestionId: row.research_question_id ?? undefined,
    intent: row.intent,
    text: row.query_text,
    concepts: arrayOfStrings(row.concepts),
    filters: objectRecord(row.filters),
    sort: arrayOfStrings(row.sort),
    pageSize: row.page_size,
    cursor: row.cursor ?? undefined,
    requestedFields: arrayOfStrings(row.requested_fields),
    openAccessRequired: row.open_access_required,
    requesterIdentityId: row.requester_identity_id,
    organisationId: row.organisation_id,
    purpose: row.purpose,
  };
}

export class PostgresResearchQueryStore implements ResearchQueryStore {
  constructor(private readonly db: SqlClient) {}

  async save(query: ResearchQuery): Promise<string> {
    const result = await this.db.query<{ id: string }>(
      `insert into core.research_query_requests
        (id, organisation_id, identity_id, research_question_id, intent, query_text,
         concepts, filters, sort, page_size, cursor, requested_fields,
         open_access_required, purpose)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11, $12::jsonb, $13, $14)
       returning id`,
      [
        query.queryId,
        query.organisationId,
        query.requesterIdentityId,
        query.researchQuestionId ?? null,
        query.intent,
        query.text,
        JSON.stringify(query.concepts ?? []),
        JSON.stringify(query.filters ?? {}),
        JSON.stringify(query.sort ?? []),
        query.pageSize,
        query.cursor ?? null,
        JSON.stringify(query.requestedFields ?? []),
        query.openAccessRequired ?? false,
        query.purpose,
      ],
    );
    const id = result.rows[0]?.id;
    if (!id) throw new Error('research_query_persistence_failed');
    return id;
  }

  async get(id: string): Promise<ResearchQuery | undefined> {
    const result = await this.db.query<ResearchQueryRow>(
      `select id, research_question_id, intent, query_text, concepts, filters, sort,
              page_size, cursor, requested_fields, open_access_required,
              identity_id as requester_identity_id, organisation_id, purpose
         from core.research_query_requests
        where id = $1
        limit 1`,
      [id],
    );
    const row = result.rows[0];
    return row ? toQuery(row) : undefined;
  }
}
