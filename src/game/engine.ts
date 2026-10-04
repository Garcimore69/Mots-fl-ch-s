// Moteur de jeu : état d'une partie, sans dépendance au DOM (testable).
import { type Dir, type GridData, type Slot, slotsOf } from './grid';

export interface Progress {
  letters: string; // une lettre ou ' ' par case, longueur rows*cols
  hinted: number[]; // cases révélées par une aide (verrouillées)
  errors: number[]; // cases signalées fausses actuellement
  wrongEver: number[]; // cases signalées fausses au moins une fois
  hintsUsed: number;
  elapsed: number; // ms
  cur: { cell: number; d: Dir };
  done: boolean;
}

export interface Options {
  skipFilled: boolean;
  noNet: boolean; // erreurs montrées seulement en fin de grille
}

export type GameEvent = 'letter' | 'word' | 'error' | 'complete' | 'blocked';

export class Game {
  readonly g: GridData;
  readonly slots: Slot[];
  readonly sol: string; // solution aplatie
  letters: string[];
  hinted: Set<number>;
  errors: Set<number>;
  solved = new Set<number>(); // cases des mots entièrement justes (verrouillées)
  wrongEver: Set<number>;
  hintsUsed: number;
  elapsed: number;
  cell: number;
  d: Dir;
  done: boolean;
  opts: Options;
  private byCell: Map<number, { H?: Slot; V?: Slot }> = new Map();

  constructor(g: GridData, opts: Options, p?: Progress) {
    this.g = g;
    this.opts = opts;
    this.slots = slotsOf(g);
    this.sol = g.solution.join('');
    for (const s of this.slots) for (const k of s.cells) {
      const e = this.byCell.get(k) ?? {};
      e[s.d] = s;
      this.byCell.set(k, e);
    }
    const n = g.rows * g.cols;
    this.letters = p ? [...p.letters.padEnd(n, ' ')].map((x) => (x === ' ' ? '' : x)) : Array(n).fill('');
    this.hinted = new Set(p?.hinted ?? []);
    this.errors = new Set(p?.errors ?? []);
    this.wrongEver = new Set(p?.wrongEver ?? []);
    this.hintsUsed = p?.hintsUsed ?? 0;
    this.elapsed = p?.elapsed ?? 0;
    this.done = p?.done ?? false;
    if (!this.done) this.refresh(); // verrous et erreurs recalculés depuis les lettres
    const first = this.slots[0];
    this.cell = p?.cur.cell ?? first.cells[0];
    this.d = p?.cur.d ?? first.d;
    if (!this.slotAt(this.cell, this.d)) this.d = this.d === 'H' ? 'V' : 'H';
  }

  progress(): Progress {
    return {
      letters: this.letters.map((x) => x || ' ').join(''),
      hinted: [...this.hinted],
      errors: [...this.errors],
      wrongEver: [...this.wrongEver],
      hintsUsed: this.hintsUsed,
      elapsed: Math.round(this.elapsed),
      cur: { cell: this.cell, d: this.d },
      done: this.done,
    };
  }

  isLetter(k: number) { return this.sol[k] !== '#'; }
  slotAt(k: number, d: Dir) { return this.byCell.get(k)?.[d]; }
  current(): Slot {
    return this.slotAt(this.cell, this.d) ?? this.slotAt(this.cell, this.d === 'H' ? 'V' : 'H')!;
  }
  /** Nombre de cases-lettres et de cases remplies. */
  fill() {
    let total = 0, filled = 0;
    for (let k = 0; k < this.sol.length; k++) if (this.isLetter(k)) { total++; if (this.letters[k]) filled++; }
    return { total, filled };
  }

  tapCell(k: number) {
    if (!this.isLetter(k)) return;
    const o: Dir = this.d === 'H' ? 'V' : 'H';
    if (k === this.cell) { if (this.slotAt(k, o)) this.d = o; }
    else if (!this.slotAt(k, this.d)) this.d = o;
    this.cell = k;
  }

  pickSlot(s: Slot) {
    this.d = s.d;
    this.cell = s.cells.find((k) => !this.letters[k]) ?? s.cells[0];
  }

  step(delta: number) {
    const n = this.slots.length;
    this.pickSlot(this.slots[(this.current().i + delta + n) % n]);
  }

  /** Case non modifiable : révélée par une aide, ou appartenant à un mot entièrement juste. */
  locked(k: number) { return this.done || this.hinted.has(k) || this.solved.has(k); }

  /** Saisie d'une lettre dans la case courante. */
  type(ch: string): GameEvent[] {
    if (this.done) return [];
    const s = this.current();
    let k = this.cell;
    // Case verrouillée : on écrit dans la case modifiable suivante du mot.
    if (this.locked(k)) {
      const pos = s.cells.indexOf(k);
      const nxt = s.cells.slice(pos + 1).find((x) => !this.locked(x));
      if (nxt === undefined) return ['blocked'];
      k = nxt;
    }
    return this.put(k, ch, false);
  }

  /** Aide : révèle la lettre de la case courante. Renvoie null si inutile. */
  hint(): GameEvent[] | null {
    if (this.locked(this.cell)) return null;
    this.hintsUsed++;
    return this.put(this.cell, this.sol[this.cell], true);
  }

  private full(w: Slot) { return w.cells.every((x) => this.letters[x]); }
  private right(w: Slot) { return w.cells.every((x) => this.letters[x] === this.sol[x]); }

  /**
   * Recalcule les verrous et les erreurs à partir des lettres :
   * - un mot entièrement écrit et juste est verrouillé ;
   * - une lettre fausse n'est signalée que si un mot qui la contient est entièrement écrit
   *   (mode sans filet : seulement quand toute la grille est remplie).
   * Renvoie true si une erreur nouvellement signalée apparaît.
   */
  refresh(): boolean {
    this.solved.clear();
    for (const w of this.slots) if (this.full(w) && this.right(w)) w.cells.forEach((x) => this.solved.add(x));
    const before = new Set(this.errors);
    this.errors.clear();
    const gridFull = this.fill().filled === this.fill().total;
    for (const w of this.slots) {
      if (!this.full(w) || (this.opts.noNet && !gridFull)) continue;
      for (const x of w.cells) if (this.letters[x] !== this.sol[x]) this.errors.add(x);
    }
    let fresh = false;
    for (const x of this.errors) { this.wrongEver.add(x); if (!before.has(x)) fresh = true; }
    return fresh;
  }

  private put(k: number, ch: string, isHint: boolean): GameEvent[] {
    const ev: GameEvent[] = ['letter'];
    const s = this.current();
    this.letters[k] = ch;
    if (isHint) this.hinted.add(k);
    for (const d of ['H', 'V'] as Dir[]) {
      const w = this.slotAt(k, d);
      if (w && this.full(w)) ev.push('word');
    }
    if (this.refresh()) ev.push('error');
    if (this.checkComplete()) { ev.push('complete'); return ev; }
    this.advance(s, k);
    return ev;
  }

  private checkComplete() {
    for (let k = 0; k < this.sol.length; k++) if (this.isLetter(k) && this.letters[k] !== this.sol[k]) return false;
    this.done = true;
    this.errors.clear();
    return true;
  }

  private advance(s: Slot, k: number) {
    const pos = s.cells.indexOf(k);
    this.d = s.d;
    const rest = s.cells.slice(pos + 1).filter((x) => !this.locked(x));
    if (this.opts.skipFilled) {
      const empty = rest.find((x) => !this.letters[x]) ?? s.cells.find((x) => !this.letters[x]);
      if (empty !== undefined) { this.cell = empty; return; }
      // Mot complet : on passe au prochain mot incomplet.
      const n = this.slots.length;
      for (let j = 1; j <= n; j++) {
        const t = this.slots[(s.i + j) % n];
        if (t.cells.some((x) => !this.letters[x])) { this.pickSlot(t); return; }
      }
      this.cell = k;
      return;
    }
    if (rest[0] !== undefined) { this.cell = rest[0]; return; }
    // Fin du mot : si le mot est juste (verrouillé), on passe au mot suivant incomplet.
    if (this.solved.has(k)) {
      const n = this.slots.length;
      for (let j = 1; j <= n; j++) {
        const t = this.slots[(s.i + j) % n];
        if (t.cells.some((x) => !this.letters[x])) { this.pickSlot(t); return; }
      }
    }
    this.cell = k;
  }

  erase() {
    if (this.done) return;
    const s = this.current();
    let k = this.cell;
    if (!this.letters[k] || this.locked(k)) {
      const pos = s.cells.indexOf(k);
      const prev = s.cells.slice(0, pos).reverse().find((x) => !this.locked(x) && this.letters[x]);
      if (prev === undefined) return;
      k = prev;
    }
    this.letters[k] = '';
    this.cell = k;
    this.d = s.d;
    this.refresh();
  }
}
