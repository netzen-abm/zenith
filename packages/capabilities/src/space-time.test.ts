import { validateSpatialRepresentation, validateTimeSpan } from './space-time.ts';

validateTimeSpan({
  id: 'time-1', organisationId: 'org-1', label: 'Early period',
  startAt: '2020-01-01T00:00:00Z', endAt: '2021-01-01T00:00:00Z',
  startPrecision: 'year', endPrecision: 'year',
});
try {
  validateTimeSpan({
    id: 'time-2', organisationId: 'org-1', label: 'Invalid',
    startAt: '2022-01-01T00:00:00Z', endAt: '2021-01-01T00:00:00Z',
    startPrecision: 'year', endPrecision: 'year',
  });
  throw new Error('expected temporal validation failure');
} catch (error) {
  if (!(error instanceof Error) || error.message !== 'space_time_temporal_range_invalid') throw error;
}
validateSpatialRepresentation({
  id: 'spatial-1', resourceId: 'site-1', representationType: 'point',
  precisionLevel: 'generalized', coordinateConfidence: 0.8,
});
console.log('space-time-contract: PASS');
