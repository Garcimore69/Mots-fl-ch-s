import { describe, expect, it } from 'vitest';
import { hyphenate } from '../src/screens/play';

const show = (s: string) => hyphenate(s).replace(/­/g, '-');
describe('césure', () => {
  it('coupe aux syllabes', () => {
    expect(show('INDISPENSABLE')).toBe('INDIS-PEN-SA-BLE');
    expect(show('DÉMONSTRATIF')).toBe('DÉMONS-TRA-TIF');
    expect(show('Pareil')).toBe('Pareil');
  });
});
