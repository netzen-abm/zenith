import { createHash } from 'node:crypto';
import { ResearchProviderError, validateResearchQuery, type ResearchProvider, type ResearchQuery, type ResearchResult, type ResearchWork } from '../../../capabilities/src/research-intelligence.ts';

type RecordRow = { DOI?: unknown; title?: unknown; type?: unknown; published?: unknown; issued?: unknown; license?: unknown; URL?: unknown };
type Message = { items?: unknown; 'next-cursor'?: unknown };
type CacheEntry = { expiresAt: number; result: ResearchResult };
export type CrossrefProviderOptions = { mailto: string; fetchImpl?: typeof fetch; requestIntervalMs?: number; timeoutMs?: number; cacheTtlMs?: number };

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
function str(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  return Array.isArray(value) ? value.find(v => typeof v === 'string' && v.trim())?.trim() : undefined;
}
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  const row = object(value);
  return row ? Object.fromEntries(Object.keys(row).sort().map(k => [k, stable(row[k])])) : value;
}
function hash(value: unknown): string { return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex'); }
function doi(value: unknown): string | undefined {
  const s = str(value)?.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').trim().toLowerCase();
  return s && /^10\.\d{4,9}\/.+/.test(s) ? s : undefined;
}
function pubDate(value: unknown): string | undefined {
  const parts = object(value)?.['date-parts'];
  if (!Array.isArray(parts) || !Array.isArray(parts[0])) return undefined;
  const [y,m,d] = parts[0];
  if (typeof y !== 'number' || !Number.isInteger(y) || y < 1) return undefined;
  if (m === undefined) return String(y);
  if (typeof m !== 'number' || !Number.isInteger(m) || m < 1 || m > 12) return undefined;
  if (d === undefined) return String(y) + '-' + String(m).padStart(2,'0');
  if (typeof d !== 'number' || !Number.isInteger(d) || d < 1 || d > 31) return undefined;
  return String(y) + '-' + String(m).padStart(2,'0') + '-' + String(d).padStart(2,'0');
}
function retryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const n = Number(header);
  if (Number.isFinite(n) && n >= 0) return Math.ceil(n);
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, Math.ceil((date - Date.now()) / 1000)) : undefined;
}
function filtersFor(filters: Readonly<Record<string, unknown>>, warnings: string[]): string[] {
  const out: string[] = [];
  const defs: Record<string, { api: string; kind: 'date'|'text'|'boolean' }> = {
    fromPubDate:{api:'from-pub-date',kind:'date'}, 'from-pub-date':{api:'from-pub-date',kind:'date'},
    untilPubDate:{api:'until-pub-date',kind:'date'}, 'until-pub-date':{api:'until-pub-date',kind:'date'},
    type:{api:'type',kind:'text'}, prefix:{api:'prefix',kind:'text'},
    hasAbstract:{api:'has-abstract',kind:'boolean'}, 'has-abstract':{api:'has-abstract',kind:'boolean'},
    hasFullText:{api:'has-full-text',kind:'boolean'}, 'has-full-text':{api:'has-full-text',kind:'boolean'},
  };
  for (const [key,value] of Object.entries(filters).sort(([a],[b])=>a.localeCompare(b))) {
    const def = defs[key];
    if (!def) { warnings.push('crossref_filter_not_applied:' + key); continue; }
    const valid = def.kind === 'boolean' ? typeof value === 'boolean'
      : def.kind === 'date' ? typeof value === 'string' && /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(value)
      : typeof value === 'string' && /^[a-zA-Z0-9._:-]+$/.test(value);
    if (!valid) { warnings.push('crossref_filter_not_applied:' + key); continue; }
    out.push(def.api + ':' + String(value));
  }
  return out;
}
function mapWork(row: RecordRow): ResearchWork | undefined {
  const id = doi(row.DOI), title = str(row.title);
  if (!id || !title) return undefined;
  const licenses = Array.isArray(row.license) ? row.license.map(v=>str(object(v)?.URL)).filter((v):v is string=>!!v) : [];
  const url = str(row.URL), date = pubDate(row.published) ?? pubDate(row.issued), type = str(row.type);
  return {
    canonicalWorkId: 'doi:' + id, title, ...(type ? {workType:type}:{}), ...(date ? {publicationDate:date}:{}),
    identifiers: ['doi:' + id], sourceProvenance: 'crossref:doi:' + id,
    rightsMetadata: { provider:'Crossref', licenseUrls:[...new Set(licenses)], ...(url ? {metadataUrl:url}: {}) },
  };
}

export class CrossrefResearchProvider implements ResearchProvider {
  readonly providerId = 'crossref';
  readonly adapterVersion = '1.0.0';
  private readonly fetchImpl: typeof fetch;
  private readonly mailto: string;
  private readonly intervalMs: number;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;
  private lastStartedAt = 0;
  private requestTail: Promise<void> = Promise.resolve();
  private readonly cache = new Map<string, CacheEntry>();

  constructor(options: CrossrefProviderOptions) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(options.mailto.trim())) throw new Error('crossref_mailto_required');
    this.mailto = options.mailto.trim();
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.intervalMs = Math.max(0, options.requestIntervalMs ?? 350);
    this.timeoutMs = Math.max(1, options.timeoutMs ?? 10_000);
    this.cacheTtlMs = Math.max(0, options.cacheTtlMs ?? 21_600_000);
  }

  async search(query: ResearchQuery): Promise<ResearchResult> {
    validateResearchQuery(query);
    if (query.intent !== 'discover') throw new ResearchProviderError('crossref_unsupported_intent', false);
    if (query.openAccessRequired) throw new ResearchProviderError('crossref_open_access_constraint_unverified', false);
    const identity = { text:query.text.trim(), concepts:query.concepts??[], filters:query.filters??{}, sort:query.sort??[], pageSize:query.pageSize, cursor:query.cursor??'*', requestedFields:query.requestedFields??[] };
    const key = hash(identity), cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return { ...cached.result, queryId: query.queryId };
    if (cached) this.cache.delete(key);

    const warnings: string[] = [], url = new URL('https://api.crossref.org/works');
    url.searchParams.set('query.bibliographic', [query.text.trim(),...(query.concepts??[])].filter(Boolean).join(' '));
    url.searchParams.set('rows',String(query.pageSize));
    url.searchParams.set('cursor',query.cursor?.trim()||'*');
    url.searchParams.set('mailto',this.mailto);
    url.searchParams.set('select','DOI,title,type,published,issued,license,URL');
    const filters = filtersFor(query.filters??{},warnings);
    if (filters.length) url.searchParams.set('filter',filters.join(','));
    const wanted = query.sort?.[0]?.trim().toLowerCase();
    const sorts: Record<string,string> = {relevance:'score',score:'score',date:'published',published:'published',created:'created',updated:'updated',indexed:'indexed','is-referenced-by-count':'is-referenced-by-count'};
    if (wanted && !sorts[wanted]) warnings.push('crossref_sort_not_applied');
    url.searchParams.set('sort',wanted ? (sorts[wanted]??'score') : 'score');
    url.searchParams.set('order','desc');

    const response = await this.serializedFetch(url);
    if (!response.ok) {
      const transient = [408,425,429].includes(response.status) || response.status >= 500;
      throw new ResearchProviderError('crossref_http_' + response.status,transient,retryAfter(response.headers.get('retry-after')));
    }
    let body: {message?:Message};
    try { body = await response.json() as {message?:Message}; }
    catch { throw new ResearchProviderError('crossref_response_invalid_json',true); }
    if (!body.message || !Array.isArray(body.message.items)) throw new ResearchProviderError('crossref_response_shape_invalid',false);

    const works: ResearchWork[] = [];
    for (const raw of body.message.items) {
      const work = mapWork(object(raw) ?? {});
      if (work) works.push(work); else warnings.push('crossref_record_missing_doi_or_title');
    }
    const next = typeof body.message['next-cursor'] === 'string' ? body.message['next-cursor'] : undefined;
    const result: ResearchResult = {
      queryId:query.queryId, providerId:this.providerId, providerQueryReference:'crossref:works:' + key,
      retrievedAt:new Date().toISOString(), results:works,
      ...(works.length >= query.pageSize && next && next !== (query.cursor??'*') ? {nextCursor:next}: {}),
      partial:warnings.length>0, warnings:[...new Set(warnings)],
    };
    if (this.cacheTtlMs > 0) {
      if (this.cache.size >= 100) { const first=this.cache.keys().next().value; if (first) this.cache.delete(first); }
      this.cache.set(key,{expiresAt:Date.now()+this.cacheTtlMs,result});
    }
    return result;
  }

  private async serializedFetch(url: URL): Promise<Response> {
    const previous = this.requestTail;
    let release!: () => void;
    this.requestTail = new Promise<void>(resolve=>{release=resolve;});
    await previous;
    try {
      const wait = Math.max(0,this.intervalMs-(Date.now()-this.lastStartedAt));
      if (wait>0) await new Promise<void>(resolve=>setTimeout(resolve,wait));
      this.lastStartedAt = Date.now();
      try {
        return await this.fetchImpl(url,{headers:{Accept:'application/json','User-Agent':'ZENITH-Research/1.0 (mailto:'+this.mailto+')'},signal:AbortSignal.timeout(this.timeoutMs)});
      } catch { throw new ResearchProviderError('crossref_network_error',true); }
    } finally { release(); }
  }
}
