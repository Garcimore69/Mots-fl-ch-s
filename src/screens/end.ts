import { go } from '../app';
import type { Progress } from '../game/engine';
import type { Level } from '../game/grid';
import { gridNumber, levelName } from '../data/grids';
import { levelStats, nextGrid } from '../data/progress';
import { AIDES_DAILY, AIDES_MAX, type Streak, allResults } from '../store/db';
import { fmtTime, h } from '../ui/dom';

export interface EndInfo {
  key: string;
  gridId: string;
  level: Level;
  daily?: string;
  progress: Progress;
  added: number;
  aides: number;
  streak: Streak;
  first: boolean;
}

let lastEnd: EndInfo | null = null;
export const setLastEnd = (e: EndInfo) => { lastEnd = e; };

export async function endScreen(root: HTMLElement, key: string) {
  const e = lastEnd;
  if (!e || e.key !== key) return go('');
  const results = await allResults();
  const st = levelStats(results, e.level);
  const p = e.progress;
  const record = st.best !== null && p.elapsed <= st.best;
  const next = await nextGrid(e.level);
  const errors = p.wrongEver.length;

  const rows: [string, string, string][] = [
    ['Temps', fmtTime(p.elapsed), st.done <= 1 ? 'premier temps du niveau' : record ? 'nouveau record !' : `record ${fmtTime(st.best!)}`],
    ['Aides utilisées', String(p.hintsUsed), p.hintsUsed > 1 ? 'lettres révélées' : 'lettre révélée'],
    ['Erreurs', String(errors), errors > 1 ? 'lettres corrigées' : 'lettre corrigée'],
    e.daily
      ? ['Grille du jour', `${e.streak.current} jour${e.streak.current > 1 ? 's' : ''}`, 'série en cours']
      : [`Grilles ${levelName(e.level).toLowerCase()}`, String(st.done), 'terminées'],
  ];
  const label = e.daily ? 'Grille du jour' : `${levelName(e.level)} n° ${gridNumber(e.gridId)}`;

  root.replaceChildren(h('div', { class: 'screen end' },
    h('h2', {}, 'Bravo !'),
    h('div', { class: 'sub' }, `Grille terminée · ${label}`),
    h('div', { class: 'card rows' }, ...rows.map(([k, v, sub]) =>
      h('div', {}, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v, sub ? h('small', {}, sub) : null)))),
    h('div', { class: 'gain' },
      h('div', { style: 'display:flex;justify-content:space-between;align-items:center' },
        h('b', { style: 'font-size:17px' }, e.added > 0 ? `+${e.added} aide${e.added > 1 ? 's' : ''} gagnée${e.added > 1 ? 's' : ''}` : e.first ? 'Plafond d’aides atteint' : 'Grille déjà terminée'),
        h('span', { style: 'font-size:15px;font-weight:600' }, `${e.aides} / ${AIDES_MAX}`)),
      h('div', { class: 'bar' }, h('div', { style: `width:${(100 * e.aides) / AIDES_MAX}%` })),
      h('small', {}, `+${AIDES_DAILY} aides offertes chaque jour, plafond à ${AIDES_MAX}.`)),
    h('div', { class: 'stack' },
      next
        ? h('button', { class: 'btn', style: 'height:56px;font-size:18px', onclick: () => go(`jeu/${next}`) }, `Grille suivante · ${levelName(e.level)}`)
        : h('div', { class: 'foot' }, `Toutes les grilles ${levelName(e.level).toLowerCase()} sont terminées.`),
      h('button', { class: 'btn ghost', onclick: () => go('') }, 'Accueil')),
  ));
}
