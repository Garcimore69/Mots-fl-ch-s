// Géométrie d'une grille. Miroir de tools/grid.py : garder les deux identiques.

export type Dir = 'H' | 'V';
export type Arrow = 'right' | 'down' | 'downright' | 'rightdown';
export type Level = 'facile' | 'moyen' | 'difficile' | 'expert';

export interface GridData {
  id: string;
  level: Level;
  cols: number;
  rows: number;
  layout: string[]; // '#' définition, '.' lettre
  solution: string[];
  clues: { d: Dir; r: number; c: number; n: number; t: string }[];
}

export interface Slot {
  i: number; // index dans l'ordre de lecture
  d: Dir;
  r: number;
  c: number;
  n: number;
  text: string;
  cells: number[]; // index linéaires r*cols+c
  owner: number; // index de la case définition
  arrow: Arrow;
  top: boolean; // affichée en haut de sa case définition
}

export function slotsOf(g: GridData): Slot[] {
  const { rows: R, cols: C, layout } = g;
  const isL = (r: number, c: number) => r >= 0 && r < R && c >= 0 && c < C && layout[r][c] === '.';
  const isC = (r: number, c: number) => r >= 0 && r < R && c >= 0 && c < C && layout[r][c] === '#';
  const raw: { d: Dir; r: number; c: number; n: number }[] = [];
  for (let r = 0; r < R; r++) {
    let c = 0;
    while (c < C) {
      if (isL(r, c)) {
        const s = c;
        while (isL(r, c)) c++;
        if (c - s >= 2) raw.push({ d: 'H', r, c: s, n: c - s });
      } else c++;
    }
  }
  for (let c = 0; c < C; c++) {
    let r = 0;
    while (r < R) {
      if (isL(r, c)) {
        const s = r;
        while (isL(r, c)) r++;
        if (r - s >= 2) raw.push({ d: 'V', r: s, c, n: r - s });
      } else r++;
    }
  }
  const text = new Map(g.clues.map((k) => [`${k.d}${k.r},${k.c}`, k.t]));
  const slots = raw.map((x) => {
    let or = -1, oc = -1, arrow: Arrow = 'right';
    if (x.d === 'H') {
      if (isC(x.r, x.c - 1)) [or, oc, arrow] = [x.r, x.c - 1, 'right'];
      else if (x.c === 0 && isC(x.r - 1, 0)) [or, oc, arrow] = [x.r - 1, 0, 'downright'];
    } else {
      if (isC(x.r - 1, x.c)) [or, oc, arrow] = [x.r - 1, x.c, 'down'];
      else if (x.r === 0 && isC(0, x.c - 1)) [or, oc, arrow] = [0, x.c - 1, 'rightdown'];
    }
    if (or < 0) throw new Error(`grille ${g.id} : mot sans définition ${x.d}${x.r},${x.c}`);
    const cells: number[] = [];
    for (let k = 0; k < x.n; k++) cells.push(x.d === 'H' ? x.r * C + x.c + k : (x.r + k) * C + x.c);
    return {
      i: 0, ...x, cells, arrow,
      owner: or * C + oc,
      top: arrow === 'right' || arrow === 'rightdown',
      text: text.get(`${x.d}${x.r},${x.c}`) ?? '?',
    };
  });
  slots.sort((a, b) => a.owner - b.owner || Number(b.top) - Number(a.top));
  slots.forEach((s, i) => (s.i = i));
  return slots;
}
