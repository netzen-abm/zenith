import { strict as assert } from 'node:assert';
import { CrossrefResearchProvider } from './crossref-provider.ts';
import { ResearchProviderError, type ResearchQuery } from '../../../capabilities/src/research-intelligence.ts';

const query:ResearchQuery={queryId:'research-q-1',intent:'discover',text:'Pattanam archaeology',concepts:['Maritime trade'],pageSize:1,requestedFields:['title','doi','publicationDate'],requesterIdentityId:'identity-1',organisationId:'organisation-1',purpose:'archaeological discovery'};
const payload={message:{'next-cursor':'next+cursor/with=characters',items:[{DOI:'https://doi.org/10.1000/ABC.1',title:['Pattanam and Maritime Trade'],type:'journal-article',published:{'date-parts':[[2021,5,2]]},license:[{URL:'https://creativecommons.org/licenses/by/4.0/'}],URL:'https://doi.org/10.1000/abc.1'}]}};
const requests:Array<{url:URL;init?:RequestInit}>=[];
let calls=0;
const provider=new CrossrefResearchProvider({mailto:'research-test@example.org',requestIntervalMs:0,fetchImpl:async(input,init)=>{calls++;requests.push({url:new URL(String(input)),init});return new Response(JSON.stringify(payload),{status:200,headers:{'content-type':'application/json'}});}});
const first=await provider.search(query);
assert.equal(first.providerId,'crossref');
assert.equal(first.results.length,1);
assert.equal(first.results[0].canonicalWorkId,'doi:10.1000/abc.1');
assert.equal(first.results[0].title,'Pattanam and Maritime Trade');
assert.equal(first.results[0].publicationDate,'2021-05-02');
assert.equal(first.results[0].sourceProvenance,'crossref:doi:10.1000/abc.1');
assert.deepEqual(first.results[0].rightsMetadata,{provider:'Crossref',licenseUrls:['https://creativecommons.org/licenses/by/4.0/'],metadataUrl:'https://doi.org/10.1000/abc.1'});
assert.equal(first.nextCursor,'next+cursor/with=characters');
assert.equal(requests[0].url.origin,'https://api.crossref.org');
assert.equal(requests[0].url.pathname,'/works');
assert.equal(requests[0].url.searchParams.get('query.bibliographic'),'Pattanam archaeology Maritime trade');
assert.equal(requests[0].url.searchParams.get('mailto'),'research-test@example.org');
assert.equal(requests[0].url.searchParams.get('cursor'),'*');
assert.equal(requests[0].url.searchParams.get('rows'),'1');
assert.equal((requests[0].init?.headers as Record<string,string>)['User-Agent'],'ZENITH-Research/1.0 (mailto:research-test@example.org)');
assert.equal(requests[0].url.searchParams.has('organisation-1'),false,'tenant identity is never sent');
const replay=await provider.search(query);
assert.equal(calls,1,'identical requests use bounded memory cache');
assert.equal(replay.retrievedAt,first.retrievedAt);
const nextQuery=await provider.search({...query,queryId:'different-id'});
assert.equal(nextQuery.queryId,'different-id','cache must not return another operation ID');
assert.equal(calls,1);

let oaCalls=0;
const oaProvider=new CrossrefResearchProvider({mailto:'research-test@example.org',requestIntervalMs:0,fetchImpl:async()=>{oaCalls++;return new Response(JSON.stringify(payload));}});
await assert.rejects(()=>oaProvider.search({...query,openAccessRequired:true}),(e:unknown)=>e instanceof ResearchProviderError&&e.code==='crossref_open_access_constraint_unverified'&&!e.retryable);
assert.equal(oaCalls,0,'unverified rights constraint fails before network access');

const filterProvider=new CrossrefResearchProvider({mailto:'research-test@example.org',requestIntervalMs:0,fetchImpl:async()=>new Response(JSON.stringify({message:{items:[]}}))});
const filtered=await filterProvider.search({...query,filters:{region:'Kerala'}});
assert.equal(filtered.partial,true);
assert.deepEqual(filtered.warnings,['crossref_filter_not_applied:region']);

const limited=new CrossrefResearchProvider({mailto:'research-test@example.org',requestIntervalMs:0,fetchImpl:async()=>new Response('rate limited',{status:429,headers:{'retry-after':'3'}})});
await assert.rejects(()=>limited.search(query),(e:unknown)=>e instanceof ResearchProviderError&&e.code==='crossref_http_429'&&e.retryable&&e.retryAfterSeconds===3);
await assert.rejects(()=>provider.search({...query,intent:'extract'}),(e:unknown)=>e instanceof ResearchProviderError&&e.code==='crossref_unsupported_intent'&&!e.retryable);
console.log('Crossref adapter contract: PASS');
