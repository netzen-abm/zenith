import { validateFieldObservation } from './field-acquisition.ts';

const valid = {
  id: 'observation-1', organisationId: 'org-1', evidenceId: 'evidence-1',
  observationType: 'ceramic_fragment', value: { count: 3 },
  observerIdentityId: 'identity-1', observedAt: '2026-09-21T10:00:00Z',
};
validateFieldObservation(valid);
for (const [name, value, expected] of [
  ['missing evidence', { ...valid, evidenceId: '' }, 'field_observation_context_required'],
  ['missing type', { ...valid, observationType: ' ' }, 'field_observation_type_required'],
  ['invalid value', { ...valid, value: [] }, 'field_observation_value_invalid'],
  ['invalid time', { ...valid, observedAt: 'not-a-date' }, 'field_observation_time_invalid'],
] as const) {
  try { validateFieldObservation(value); throw new Error(name + ': expected failure'); }
  catch (error) {
    if (!(error instanceof Error) || error.message !== expected) throw error;
  }
}
console.log('field-acquisition-contract: PASS');
