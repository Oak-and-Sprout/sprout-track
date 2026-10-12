import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const EXPECTED_HEADER = 'Sex,Agemos,L,M,S,P3,P5,P10,P25,P50,P75,P90,P95,P97';

function readCsv(fileName: string) {
  const content = fs.readFileSync(path.join(__dirname, '../documentation', fileName), 'utf8').trim();
  const lines = content.split(/\r?\n/);
  const rows = lines.slice(1).map(line => line.split(',').map(Number));
  return { header: lines[0], rows };
}

describe.each(['wtage.csv', 'statage.csv'])('%s CDC 2-20 reference', fileName => {
  it('contains the complete finite 24-240 month range for both sexes', () => {
    const { header, rows } = readCsv(fileName);
    const ages = rows.map(row => row[1]);
    const sexes = new Set(rows.map(row => row[0]));
    const pairs = new Set(rows.map(row => `${row[0]}:${row[1]}`));

    expect(header).toBe(EXPECTED_HEADER);
    expect(rows).toHaveLength(436);
    expect(sexes).toEqual(new Set([1, 2]));
    expect(Math.min(...ages)).toBe(24);
    expect(Math.max(...ages)).toBe(240);
    expect(pairs.size).toBe(rows.length);
    expect(rows.every(row => row.length === 14 && row.every(Number.isFinite))).toBe(true);
  });
});
