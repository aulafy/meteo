import { describe, expect, it } from 'vitest';
import { parseDgtDatex } from './dgt';

const xml = `<?xml version="1.0"?><d2:payload xmlns:d2="d2" xmlns:com="com" xmlns:sit="sit" xmlns:loc="loc"><com:publicationTime>2026-07-14T01:00:00+02:00</com:publicationTime><sit:situation id="42"><sit:situationRecord id="7"><sit:situationRecordVersionTime>2026-07-14T00:55:00+02:00</sit:situationRecordVersionTime><sit:cause><sit:detailedCauseType><sit:environmentalObstructionType>forestFire</sit:environmentalObstructionType></sit:detailedCauseType></sit:cause><sit:locationReference><loc:supplementaryPositionalDescription><loc:roadInformation><loc:roadName>A-1</loc:roadName></loc:roadInformation></loc:supplementaryPositionalDescription><loc:tpegLinearLocation><loc:from><loc:pointCoordinates><loc:latitude>40.4</loc:latitude><loc:longitude>-3.7</loc:longitude></loc:pointCoordinates><loc:_tpegNonJunctionPointExtension><loc:extendedTpegNonJunctionPoint><loc:municipality>Madrid</loc:municipality><loc:province>Madrid</loc:province></loc:extendedTpegNonJunctionPoint></loc:_tpegNonJunctionPointExtension></loc:from><loc:to><loc:pointCoordinates><loc:latitude>40.5</loc:latitude><loc:longitude>-3.6</loc:longitude></loc:pointCoordinates></loc:to></loc:tpegLinearLocation></sit:locationReference><sit:roadOrCarriagewayOrLaneManagementType>roadClosed</sit:roadOrCarriagewayOrLaneManagementType></sit:situationRecord></sit:situation></d2:payload>`;

describe('DGT DATEX II', () => {
  it('normaliza un corte por incendio forestal', () => {
    const parsed = parseDgtDatex(xml);
    expect(parsed.publishedAt).toBe('2026-07-14T01:00:00+02:00');
    expect(parsed.incidents).toEqual([expect.objectContaining({ id: '42:7', road: 'A-1', municipality: 'Madrid', cause: 'forestFire', closure: 'complete', fireRelated: true, coordinates: [[-3.7, 40.4], [-3.6, 40.5]] })]);
  });
});
