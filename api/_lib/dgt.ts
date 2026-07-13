import { XMLParser } from 'fast-xml-parser';

export type DgtClosure = 'complete' | 'carriageway' | 'lane' | 'intermittent' | 'affected';

export interface DgtIncident {
  id: string;
  road: string;
  municipality: string;
  province: string;
  cause: string;
  kind: string;
  closure: DgtClosure;
  fireRelated: boolean;
  updatedAt: string;
  coordinates: [number, number][];
}

type XmlObject = Record<string, unknown>;

const COMPLETE = new Set(['roadClosed']);
const CARRIAGEWAY = new Set(['carriagewayClosures']);
const LANE = new Set(['laneClosures']);
const INTERMITTENT = new Set(['intermittentShortTermClosures']);
const IMPORTANT_CAUSES = new Set(['forestFire', 'smokeHazard', 'vehicleOnFire']);

function object(value: unknown): XmlObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as XmlObject : {};
}

function text(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  const record = object(value);
  return typeof record['#text'] === 'string' ? record['#text'] : '';
}

function firstLeaf(value: unknown): string {
  const direct = text(value);
  if (direct) return direct;
  for (const child of Object.values(object(value))) {
    const leaf = firstLeaf(child);
    if (leaf) return leaf;
  }
  return '';
}

function coordinate(value: unknown): [number, number] | null {
  const point = object(object(value).pointCoordinates);
  const latitude = Number(point.latitude);
  const longitude = Number(point.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || longitude < -19 || longitude > 5 || latitude < 27 || latitude > 44.5) return null;
  return [longitude, latitude];
}

function pointDetails(value: unknown) {
  const point = object(value);
  return object(object(point._tpegNonJunctionPointExtension).extendedTpegNonJunctionPoint);
}

function normalizeRecord(recordValue: unknown, situationId: string): DgtIncident | null {
  const record = object(recordValue);
  const location = object(record.locationReference);
  const linear = object(location.tpegLinearLocation);
  const pointLocation = object(location.tpegPointLocation);
  const from = object(linear.from);
  const to = object(linear.to);
  const singlePoint = object(pointLocation.point);
  const coordinates = [coordinate(from), coordinate(to)].filter((item): item is [number, number] => item !== null);
  if (!coordinates.length) {
    const pointCoordinate = coordinate(singlePoint);
    if (pointCoordinate) coordinates.push(pointCoordinate);
  }
  if (!coordinates.length) return null;

  const position = Object.keys(from).length ? from : Object.keys(singlePoint).length ? singlePoint : to;
  const details = pointDetails(position);
  const roadInfo = object(object(location.supplementaryPositionalDescription).roadInformation);
  const kind = text(record.roadOrCarriagewayOrLaneManagementType)
    || text(record.poorEnvironmentType)
    || text(record.obstructionType)
    || text(record.abnormalTrafficType)
    || text(record.generalInstructionToRoadUsersType)
    || firstLeaf(record.cause)
    || 'trafficIncident';
  const cause = firstLeaf(object(record.cause).detailedCauseType) || text(object(record.cause).causeType) || kind;
  const fireRelated = IMPORTANT_CAUSES.has(kind) || IMPORTANT_CAUSES.has(cause);
  const closure: DgtClosure = COMPLETE.has(kind) ? 'complete'
    : CARRIAGEWAY.has(kind) ? 'carriageway'
      : LANE.has(kind) ? 'lane'
        : INTERMITTENT.has(kind) ? 'intermittent' : 'affected';
  if (closure === 'affected' && !fireRelated) return null;

  const updatedAt = text(record.situationRecordVersionTime) || text(record.situationRecordCreationTime);
  return {
    id: `${situationId}:${text(record['@_id']) || updatedAt}`,
    road: text(roadInfo.roadName) || 'Carretera sin identificar',
    municipality: text(details.municipality),
    province: text(details.province),
    cause,
    kind,
    closure,
    fireRelated,
    updatedAt,
    coordinates,
  };
}

export function parseDgtDatex(xml: string) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    isArray: (name) => name === 'situation' || name === 'situationRecord',
  });
  const parsed = parser.parse(xml) as XmlObject;
  const payload = object(parsed.payload);
  const situations = Array.isArray(payload.situation) ? payload.situation : [];
  const incidents = situations.flatMap((situationValue) => {
    const situation = object(situationValue);
    const situationId = text(situation['@_id']);
    const records = Array.isArray(situation.situationRecord) ? situation.situationRecord : [];
    return records.map((record) => normalizeRecord(record, situationId)).filter((incident): incident is DgtIncident => incident !== null);
  });
  return {
    publishedAt: text(payload.publicationTime),
    incidents: incidents.slice(0, 750),
  };
}
