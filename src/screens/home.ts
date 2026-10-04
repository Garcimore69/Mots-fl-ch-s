import { go } from '../app';
import { LEVELS, dailyGridId, getGrid, gridNumber, levelName } from '../data/grids';
import { inProgress, levelStats, nextGrid } from '../data/progress';
import { AIDES_MAX, GAIN, allResults, currentStreak, getGame, getWallet, today } from '../store/db';
import { ICON, fmtTime, h, svg, toast } from '../ui/dom';

const dateFr = (d: string) =>
  new Date(d + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, (c) => c.toUpperCase());

export async function homeScreen(root: HTMLElement) {
  const t = today();
  const [wallet, streak, results, games, dailyId] = await Promise.all([
    getWallet(), currentStreak(), allResults(), inProgress(), dailyGridId(t),
  ]);
  const dailyKey = `daily:${t}`;
  const dailySaved = await getGame(dailyKey);
  const dailyDone = results.some((r) => r.key === dailyKey);
  const nexts = await Promise.all(LEVELS.map((l) => nextGrid(l.id)));

  const dailyLabel = dailyDone ? 'Terminée — à demain !' : dailySaved ? 'Continuer' : 'Jouer';
  const resumeList = games.filter((g) => g.key !== dailyKey).slice(0, 3);

  const resumeCards = await Promise.all(resumeList.map(async (g) => {
    const grid = await getGrid(g.gridId);
    const total = grid.solution.join('').replace(/#/g, '').length;
    const filled = g.progress.letters.replace(/[ #]/g, '').length;
    const name = g.daily ? 'Grille du jour' : `${levelName(g.level)} · grille n° ${gridNumber(g.gridId)}`;
    return h('button', { class: 'card resume', onclick: () => go(`jeu/${g.key}`) },
      h('div', { class: 'row' },
        h('div', {}, h('div', { class: 'label' }, 'Reprendre'), h('div', { class: 'name' }, name)),
        h('div', { style: 'font-size:14px;color:var(--muted)' }, fmtTime(g.progress.elapsed))),
      h('div', { class: 'bar' }, h('div', { style: `width:${Math.round((100 * filled) / total)}%` })));
  }));

  root.replaceChildren(h('div', { class: 'screen' },
    h('div', { class: 'home-head' },
      h('h1', {}, 'MOTS FLÉCHÉS'),
      h('div', { style: 'display:flex;align-items:center;gap:6px' },
        h('div', { class: 'pill', 'aria-label': `${wallet.aides} aides sur ${AIDES_MAX}` }, svg(ICON.bulb, 18), `${wallet.aides}/${AIDES_MAX}`),
        h('button', { class: 'icon-btn', 'aria-label': 'Statistiques et réglages', onclick: () => go('reglages') }, svg(ICON.gear)))),
    h('div', { class: 'hero' },
      h('div', { style: 'display:flex;justify-content:space-between;align-items:flex-start' },
        h('div', {},
          h('div', { class: 'kicker' }, 'GRILLE DU JOUR'),
          h('div', { class: 'title' }, dateFr(t)),
          h('div', { class: 'sub' }, 'Moyen · 9×10')),
        h('div', { class: 'streak', 'aria-label': `Série de ${streak.current} jours` },
          h('b', {}, streak.current), h('span', {}, streak.current > 1 ? 'jours' : 'jour'))),
      h('button', {
        class: 'btn', 'aria-disabled': dailyDone, style: dailyDone ? 'opacity:.7' : null,
        onclick: () => (dailyDone ? toast('Revenez demain pour une nouvelle grille') : go(`jeu/${dailyKey}`)),
      }, dailyLabel)),
    ...resumeCards,
    h('div', { class: 'label', style: 'margin-top:4px' }, 'Nouvelle grille'),
    h('div', { class: 'levels' }, ...LEVELS.map((l, i) => {
      const st = levelStats(results, l.id);
      const id = nexts[i];
      return h('button', {
        class: 'level', style: `background:var(--lv-${l.id})`,
        'aria-disabled': !id,
        onclick: () => (id ? go(`jeu/${id}`) : toast('Toutes les grilles de ce niveau sont jouées. De nouvelles arrivent avec les mises à jour.')),
      },
        h('div', { class: 'n' }, l.name),
        h('div', { class: 's' }, `${l.size} · ${st.done} finie${st.done > 1 ? 's' : ''}`),
        h('div', { class: 'g' }, id ? `+${GAIN[l.id]} aide${GAIN[l.id] > 1 ? 's' : ''}` : 'Toutes jouées'));
    })),
    dailyId ? null : h('div', { class: 'foot' }, 'Aucune grille disponible.'),
  ));
}
