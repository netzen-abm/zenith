export type FieldObservation = {
  id: string;
  organisationId: string;
  evidenceId: string;
  observationType: string;
  value: Readonly<Record<string, unknown>>;
  observedAt?: string;
  observerIdentityId: string;
  method?: Readonly<Record<string, unknown>>;
  uncertainty?: Readonly<Record<string, unknown>>;
};

export function validateFieldObservation(value: FieldObservation): void {
  if (!value.id || !value.organisationId || !value.evidenceId || !value.observerIdentityId) {
    throw new Error('field_observation_context_required');
  }
  if (!value.observationType.trim()) throw new Error('field_observation_type_required');
  if (!value.value || typeof value.value !== 'object' || Array.isArray(value.value)) {
    throw new Error('field_observation_value_invalid');
  }
  if (value.observedAt && Number.isNaN(new Date(value.observedAt).getTime())) {
    throw new Error('field_observation_time_invalid');
  }
}
