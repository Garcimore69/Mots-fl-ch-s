import { app, go } from '../app';
import { type GameEvent, Game } from '../game/engine';
import type { Slot } from '../game/grid';
import { dailyGridId, getGrid, gridNumber, levelName } from '../data/grids';
import { type SavedGame, finishGame, getGame, getWallet, saveGame, useAide } from '../store/db';
import { ICON, fmtTime, h, svg, toast } from '../ui/dom';
import { feedback } from '../ui/feedback';
import { setLastEnd } from './end';

const ROWS = ['AZERTYUIOP', 'QSDFGHJKLM', 'WXCVBN'];
const SVG_DR = '<path d="M2 0v6h5" fill="none"/><path d="M6 3.5l3 2.5-3 2.5z" fill="currentColor" stroke="none"/>';
const SVG_RD = '<path d="M0 2h6v5" fill="none"/><path d="M3.5 6l2.5 3 2.5-3z" fill="currentColor" stroke="none"/>';

const VOW = /[AEIOUYÀÂÄÉÈÊËÎÏÔÖÙÛÜŸŒÆ]/i;
const KEEP = /^(CH|PH|TH|GN|[BCDFGKPTV][LR])$/i;
/** Césure française approximative (V-CV, VC-CV) avec traits d'union conditionnels. */
export function hyphenate(text: string) {
  return text.replace(/[A-Za-zÀ-ÿŒœÆæ]{7,}/g, (w) => {
    const cut: number[] = [];
    let i = 0;
    while (i < w.length) {
      // groupe de consonnes entre deux voyelles : la dernière (ou un groupe CH, TR…) part avec la voyelle suivante
      if (VOW.test(w[i])) { i++; continue; }
      const s = i;
      while (i < w.length && !VOW.test(w[i])) i++;
      if (s === 0 || i >= w.length) continue;
      const n = i - s;
      const at = n >= 2 && KEEP.test(w.slice(i - 2, i)) ? i - 2 : i - 1;
      if (at >= 3 && w.length - at >= 3) cut.push(at);
    }
    let out = '', last = 0;
    for (const c of cut) { out += w.slice(last, c) + '\u00AD'; last = c; }
    return out + w.slice(last);
  });
}

function marker(markup: string, cls: string, w: number, hgt: number) {
  const s = svg(markup);
  s.setAttribute('viewBox', `0 0 ${w} ${hgt}`);
  s.setAttribute('width', String(w));
  s.setAttribute('height', String(hgt));
  s.setAttribute('stroke-width', '1.4');
  s.classList.add('mk', cls);
  return s;
}

export async function playScreen(root: HTMLElement, key: string) {
  const daily = key.startsWith('daily:') ? key.slice(6) : undefined;
  const gridId = daily ? await dailyGridId(daily) : key;
  const [grid, saved, wallet0] = await Promise.all([getGrid(gridId), getGame(key), getWallet()]);
  const s = app.settings;
  const game = new Game(grid, { skipFilled: s.skipFilled, noNet: s.noNet }, saved?.progress);
  let aides = wallet0.aides;
  const C = grid.cols, R = grid.rows;

  // ---- Construction du DOM ----
  const timeEl = h('span', {}, '');
  const title = daily ? 'Grille du jour' : `Grille n° ${gridNumber(gridId)}`;
  const gridEl = h('div', { class: 'grid', role: 'grid', 'aria-label': 'Grille' });
  gridEl.style.gridTemplateColumns = `repeat(${C}, var(--cs))`;
  gridEl.style.gridTemplateRows = `repeat(${R}, var(--cs))`;
  const cellEls: HTMLElement[] = [];
  const clueBtns = new Map<number, HTMLButtonElement>(); // slot.i -> bouton
  const owners = new Map<number, Slot[]>();
  for (const sl of game.slots) owners.set(sl.owner, [...(owners.get(sl.owner) ?? []), sl]);

  for (let k = 0; k < R * C; k++) {
    if (!game.isLetter(k)) {
      const box = h('div', { class: 'clue' });
      for (const sl of owners.get(k) ?? []) {
        const b = h('button', { 'aria-label': `Définition : ${sl.text} (${sl.n} lettres)`, onclick: () => { game.pickSlot(sl); paint(); } }, sl.text);
        b.dataset.t = sl.text;
        clueBtns.set(sl.i, b);
        box.append(b);
      }
      cellEls.push(box);
      gridEl.append(box);
      continue;
    }
    const b = h('button', { class: 'cell', 'aria-label': `Ligne ${Math.floor(k / C) + 1}, colonne ${(k % C) + 1}`, onclick: () => { game.tapCell(k); paint(); } });
    for (const sl of game.slots.filter((x) => x.cells[0] === k)) {
      const two = (owners.get(sl.owner)?.length ?? 1) > 1;
      if (sl.arrow === 'right') {
        const m = h('span', { class: 'mk r' });
        m.style.top = two ? 'calc(var(--cs) * 0.25 - 4px)' : 'calc(50% - 4px)';
        b.append(m);
      } else if (sl.arrow === 'down') b.append(h('span', { class: 'mk d' }));
      else if (sl.arrow === 'downright') b.append(marker(SVG_DR, 'dr', 11, 10));
      else b.append(marker(SVG_RD, 'rd', 10, 11));
    }
    b.append(h('span', { class: 'ch' }), h('span', { class: 'dot', hidden: true }));
    cellEls.push(b);
    gridEl.append(b);
  }

  const clueText = h('div', { class: 't', 'aria-live': 'polite' });
  const badge = h('span', { class: 'badge' }, aides);
  const hintKey = h('button', { class: 'key hint', 'aria-label': 'Aide : révéler la lettre de la case', onclick: () => hint() }, svg(ICON.bulb, 20), 'AIDE', badge);
  const keyBtn = (l: string) => h('button', { class: 'key', onclick: () => type(l) }, l);
  const kbd = h('div', { class: 'kbd' },
    h('div', { class: 'row' }, ...[...ROWS[0]].map(keyBtn)),
    h('div', { class: 'row' }, ...[...ROWS[1]].map(keyBtn)),
    h('div', { class: 'row last' }, hintKey, ...[...ROWS[2]].map(keyBtn),
      h('button', { class: 'key erase', 'aria-label': 'Effacer', onclick: () => erase() }, svg(ICON.erase))));
  const wrap = h('div', { class: 'grid-wrap' }, gridEl);

  root.replaceChildren(h('div', { class: 'screen play' },
    h('div', { class: 'play-head' },
      h('button', { class: 'icon-btn', 'aria-label': "Retour à l'accueil", onclick: () => go('') }, svg(ICON.back)),
      h('div', { class: 'mid' }, h('b', {}, levelName(grid.level)), h('span', {}, `${title} · `, timeEl)),
      h('div', { class: 'pill', style: 'width:44px;visibility:hidden' })),
    wrap,
    h('div', { class: 'cluebar' },
      h('button', { class: 'icon-btn', 'aria-label': 'Définition précédente', onclick: () => { game.step(-1); paint(); } }, svg(ICON.back, 22)),
      clueText,
      h('button', { class: 'icon-btn', 'aria-label': 'Définition suivante', onclick: () => { game.step(1); paint(); } }, svg(ICON.next, 22))),
    kbd,
  ));

  // ---- Taille des cases : la grille occupe tout l'espace disponible, cases carrées ----
  const fitClues = () => {
    const cs = parseFloat(gridEl.style.getPropertyValue('--cs')) || 40;
    const max = cs * (s.bigClues ? 0.32 : 0.26);
    const fit = (b: HTMLElement) => {
      let f = max;
      b.style.fontSize = f + 'px';
      while (f > 6 && (b.scrollHeight > b.clientHeight + 1 || b.scrollWidth > b.clientWidth + 1)) {
        f -= 0.5;
        b.style.fontSize = f + 'px';
      }
      return f;
    };
    for (const b of clueBtns.values()) {
      // 1) sans coupure ; 2) si le texte devient trop petit, on autorise la césure.
      b.classList.remove('brk');
      b.textContent = b.dataset.t!;
      const plain = fit(b);
      if (plain < max * 0.75) {
        b.classList.add('brk');
        b.textContent = hyphenate(b.dataset.t!);
        const hy = fit(b);
        if (hy < plain + 1) { b.classList.remove('brk'); b.textContent = b.dataset.t!; fit(b); }
      }
    }
  };
  const resize = () => {
    const W = wrap.clientWidth - 6, H = wrap.clientHeight - 6;
    const cs = Math.floor(Math.min((W - 2 * (C - 1)) / C, (H - 2 * (R - 1)) / R, 64));
    gridEl.style.setProperty('--cs', cs + 'px');
    gridEl.style.fontSize = Math.round(cs * 0.55) + 'px';
    fitClues();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(wrap);
  document.fonts?.ready.then(fitClues);

  // ---- Rendu de l'état ----
  function paint() {
    const cur = game.current();
    const inWord = new Set(cur.cells);
    for (let k = 0; k < R * C; k++) {
      if (!game.isLetter(k)) continue;
      const el = cellEls[k];
      const ch = game.letters[k];
      el.classList.toggle('cur', k === game.cell && !game.done);
      el.classList.toggle('word', inWord.has(k) && !game.done);
      el.classList.toggle('err', game.errors.has(k));
      el.classList.toggle('hinted', game.hinted.has(k));
      (el.querySelector('.ch') as HTMLElement).textContent = ch;
      (el.querySelector('.dot') as HTMLElement).hidden = !game.hinted.has(k);
      el.setAttribute('aria-label', `Ligne ${Math.floor(k / C) + 1}, colonne ${(k % C) + 1}${ch ? ', ' + ch : ', vide'}`);
    }
    for (const [i, b] of clueBtns) b.classList.toggle('on', i === cur.i && !game.done);
    clueText.replaceChildren(cur.text + ' ', h('small', {}, `(${cur.n})`));
    badge.textContent = String(aides);
    hintKey.setAttribute('aria-disabled', String(aides <= 0 || game.done));
    timeEl.textContent = fmtTime(game.elapsed);
  }

  // ---- Sauvegarde ----
  const record = (): SavedGame => ({ key, gridId, level: grid.level, daily, progress: game.progress(), updatedAt: Date.now() });
  let saveT = 0;
  const save = () => { clearTimeout(saveT); saveT = window.setTimeout(() => saveGame(record()), 300); };

  // ---- Chronomètre (s'arrête quand l'appli passe en arrière-plan) ----
  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    if (!game.done && document.visibilityState === 'visible') game.elapsed += now - last;
    last = now;
    timeEl.textContent = fmtTime(game.elapsed);
  };
  const timer = window.setInterval(tick, 1000);
  const onVis = () => { tick(); if (document.visibilityState === 'hidden') saveGame(record()); };
  document.addEventListener('visibilitychange', onVis);

  // ---- Actions ----
  async function handle(ev: GameEvent[]) {
    if (ev.includes('complete')) return complete();
    if (ev.includes('error')) feedback('error', s);
    else if (ev.includes('word')) feedback('word', s);
    else if (ev.includes('letter')) feedback('key', s);
    if (ev.includes('error') && s.noNet) toast('Il reste des erreurs');
    paint();
    save();
  }
  function type(l: string) { if (!game.done) handle(game.type(l)); }
  function erase() { if (!game.done) { game.erase(); feedback('key', s); paint(); save(); } }
  async function hint() {
    if (game.done) return;
    if (game.hinted.has(game.cell)) return toast('Lettre déjà révélée');
    if (game.solved.has(game.cell)) return toast('Ce mot est déjà trouvé');
    if (game.letters[game.cell] && game.letters[game.cell] === game.sol[game.cell] && !s.noNet) return toast('Cette lettre est déjà juste');
    if (aides <= 0) return toast('Plus d’aide : terminez une grille pour en gagner');
    if (!(await useAide())) return;
    aides--;
    feedback('hint', s);
    const ev = game.hint();
    if (ev) handle(ev);
  }
  async function complete() {
    tick();
    paint();
    feedback('complete', s);
    cellEls.forEach((el, k) => { if (game.isLetter(k)) { el.style.animationDelay = `${(k % C + Math.floor(k / C)) * 25}ms`; el.classList.add('solved'); } });
    const rec = record();
    await saveGame(rec);
    const res = await finishGame(rec);
    setLastEnd({ key, gridId, level: grid.level, daily, progress: rec.progress, ...res });
    setTimeout(() => go(`fin/${key}`), 900);
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toUpperCase();
    if (/^[A-Z]$/.test(k)) type(k);
    else if (e.key === 'Backspace') erase();
    else if (e.key === 'ArrowRight' || e.key === 'Tab') { game.step(1); paint(); }
    else if (e.key === 'ArrowLeft') { game.step(-1); paint(); }
    else return;
    e.preventDefault();
  };
  window.addEventListener('keydown', onKey);

  app.cleanup = () => {
    clearInterval(timer);
    ro.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('keydown', onKey);
    if (!game.done) saveGame(record());
  };
  paint();
  if (!saved) saveGame(record());
}
