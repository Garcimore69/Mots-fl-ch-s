import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/engine';
import { type GridData, slotsOf } from '../src/game/grid';

const layout = ['#.#.#.#.#', '......#..', '#........', '.........', '#...#....', '......#..', '#.##.#.#.', '.........', '#...#....', '.........'];
const solution = ['#E#T#D#A#', 'HUMIDE#MA', '#RESULTAT', 'CONSCIENT', '#PEU#TETE', 'VERSES#SI', '#E##U#T#N', 'INSISTANT', '#NUL#AXEE', 'DESSINEES'];

function grid(): GridData {
  const g: GridData = { id: 't', level: 'moyen', cols: 9, rows: 10, layout, solution, clues: [] };
  g.clues = slotsOf(g).map((s) => ({ d: s.d, r: s.r, c: s.c, n: s.n, t: `def ${s.d}${s.r},${s.c}` }));
  return g;
}
const opts = { skipFilled: false, noNet: false };

describe('slots', () => {
  it('chaque case-lettre est couverte et chaque définition a une flèche', () => {
    const g = grid();
    const s = slotsOf(g);
    const covered = new Set(s.flatMap((x) => x.cells));
    for (let k = 0; k < 90; k++) if (layout.join('')[k] === '.') expect(covered.has(k)).toBe(true);
    const H1 = s.find((x) => x.d === 'H' && x.r === 1 && x.c === 0)!;
    expect(H1.arrow).toBe('downright');
    const V01 = s.find((x) => x.d === 'V' && x.r === 0 && x.c === 1)!;
    expect(V01.arrow).toBe('rightdown');
  });
});

describe('Game', () => {
  it('saisie, avance dans le mot et signale les erreurs quand le mot est complet', () => {
    const g = new Game(grid(), opts);
    const w = g.slots.find((x) => x.d === 'H' && x.r === 1 && x.c === 0)!; // HUMIDE
    g.pickSlot(w);
    for (const ch of 'HUMIDA') g.type(ch);
    expect(g.errors.has(w.cells[5])).toBe(true);
    expect(g.errors.size).toBe(1);
    g.erase(); // efface le A fautif
    expect(g.letters[w.cells[5]]).toBe('');
    g.type('E');
    expect(g.errors.size).toBe(0);
  });

  it('mode sans filet : pas d’erreur affichée en cours de grille', () => {
    const g = new Game(grid(), { ...opts, noNet: true });
    g.pickSlot(g.slots.find((x) => x.d === 'H' && x.r === 1 && x.c === 0)!);
    for (const ch of 'XXXXXX') g.type(ch);
    expect(g.errors.size).toBe(0);
  });

  it('aide : révèle et verrouille la lettre, la saisie passe à la case suivante', () => {
    const g = new Game(grid(), opts);
    const w = g.slots.find((x) => x.d === 'H' && x.r === 3 && x.c === 0)!; // CONSCIENT
    g.pickSlot(w);
    expect(g.hint()).not.toBeNull();
    expect(g.letters[w.cells[0]]).toBe('C');
    expect(g.hintsUsed).toBe(1);
    g.cell = w.cells[0];
    g.type('Z');
    expect(g.letters[w.cells[0]]).toBe('C');
    expect(g.letters[w.cells[1]]).toBe('Z');

  });

  it('grille terminée et sauvegarde/reprise', () => {
    const g = new Game(grid(), opts);
    const sol = solution.join('');
    let last: string[] = [];
    for (let k = 0; k < sol.length; k++) if (sol[k] !== '#') { g.cell = k; g.d = g.slotAt(k, 'H') ? 'H' : 'V'; last = g.type(sol[k]); }
    expect(last).toContain('complete');
    expect(g.done).toBe(true);
    const p = g.progress();
    const h = new Game(grid(), opts, p);
    expect(h.done).toBe(true);
    expect(h.letters.join('')).toBe(sol.replace(/#/g, ''));
  });

  it('sauter les cases remplies : passe au mot incomplet suivant', () => {
    const g = new Game(grid(), { ...opts, skipFilled: true });
    const w = g.slots.find((x) => x.d === 'H' && x.r === 1 && x.c === 7)!; // MA
    g.pickSlot(w);
    g.type('M'); g.type('A');
    expect(g.current().i).not.toBe(w.i);
  });
});
