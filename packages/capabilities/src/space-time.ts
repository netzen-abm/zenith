export type SpaceTimePrecision = 'exact' | 'generalized' | 'regional' | 'unknown';
export type SpaceTimeEpistemicStatus =
  | 'observed' | 'documented' | 'derived' | 'interpreted'
  | 'hypothesized' | 'traditional_oral' | 'contested_disputed' | 'unknown';

export type TimeSpan = {
  id: string;
  organisationId: string;
  label: string;
  startAt?: string;
  endAt?: string;
  startPrecision: string;
  endPrecision: string;
  chronologySystem?: string;
  uncertainty?: Readonly<Record<string, unknown>>;
};

export type SpatialRepresentation = {
  id: string;
  resourceId: string;
  representationType: string;
  precisionLevel: SpaceTimePrecision;
  coordinateConfidence?: number;
  sourceEvidenceId?: string;
};

export function validateTimeSpan(value: TimeSpan): void {
  if (!value.id || !value.organisationId || !value.label.trim()) throw new Error('space_time_context_required');
  if (!value.startPrecision || !value.endPrecision) throw new Error('space_time_precision_required');
  if (value.startAt && value.endAt && new Date(value.endAt).getTime() < new Date(value.startAt).getTime()) {
    throw new Error('space_time_temporal_range_invalid');
  }
}

export function validateSpatialRepresentation(value: SpatialRepresentation): void {
  if (!value.id || !value.resourceId || !value.representationType.trim()) throw new Error('space_time_spatial_context_required');
  if (value.coordinateConfidence !== undefined &&
      (!Number.isFinite(value.coordinateConfidence) || value.coordinateConfidence < 0 || value.coordinateConfidence > 1)) {
    throw new Error('space_time_coordinate_confidence_invalid');
  }
}
