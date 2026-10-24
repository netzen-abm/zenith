import { strict as assert } from 'node:assert';
import { MemoryOperationStore } from './research-operation-store-fixture.ts';
import { ResearchOperation, type ResearchQueryStore } from './research-operation.ts';
import { ResearchProviderError, type ResearchQuery } from './research-intelligence.ts';

const query:ResearchQuery={queryId:'q-provider-error',intent:'discover',text:'Pattanam',pageSize:10,requesterIdentityId:'id-1',organisationId:'org-1',purpose:'research'};
class Store implements ResearchQueryStore {
  private readonly data=new Map<string,ResearchQuery>();
  async save(value:ResearchQuery){this.data.set(value.queryId,value);return value.queryId;}
  async get(id:string){return this.data.get(id);}
}
for(const scenario of [
  {code:'crossref_http_429',retryable:true,expected:'retry_wait' as const},
  {code:'crossref_open_access_constraint_unverified',retryable:false,expected:'rejected' as const},
]){
  const outcomes:string[]=[];
  const operation=new ResearchOperation(new Store(),{providerId:'crossref',adapterVersion:'1.0.0',async search(){throw new ResearchProviderError(scenario.code,scenario.retryable,3);}},{authorization:{authorize:async()=>true},reservation:{reserve:async()=>({allowed:true,decision:'reserved',attemptCount:1})},operationStore:new MemoryOperationStore(),outcomeRecorder:{async record(_op,outcome){outcomes.push(outcome.outcome+':'+outcome.errorCode);return {recorded:true,decision:'recorded'};}}});
  const result=await operation.execute(query);
  assert.equal(result.state,scenario.expected);
  assert.deepEqual(outcomes,[scenario.expected+':'+scenario.code]);
}
console.log('Research provider error semantics: PASS');
