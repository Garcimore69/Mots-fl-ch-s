import { app, go, updateSettings } from '../app';
import { LEVELS } from '../data/grids';
import { levelStats } from '../data/progress';
import { type Settings, allResults, currentStreak, resetAll } from '../store/db';
import { ICON, fmtTime, h, svg, toast } from '../ui/dom';

type BoolKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

const OPTS: [BoolKey, string, string][] = [
  ['vibration', 'Vibration', 'À chaque lettre et fin de mot'],
  ['sounds', 'Sons', 'Effets discrets'],
  ['skipFilled', 'Sauter les cases remplies', 'Le curseur va à la case vide suivante du mot'],
  ['noNet', 'Mode sans filet', 'Erreurs montrées seulement en fin de grille'],
  ['bigClues', 'Définitions en grand', 'Texte des cases plus lisible'],
];

export async function settingsScreen(root: HTMLElement) {
  const [results, streak] = await Promise.all([allResults(), currentStreak()]);
  const hints = results.reduce((a, r) => a + r.hints, 0);
  const t = (ms: number | null) => (ms === null ? '—' : fmtTime(ms));

  const render = () => {
    const s = app.settings;
    root.replaceChildren(h('div', { class: 'screen' },
      h('div', { style: 'display:flex;align-items:center;gap:4px;height:52px;flex:none' },
        h('button', { class: 'icon-btn', 'aria-label': 'Retour', style: 'margin-left:-10px', onclick: () => go('') }, svg(ICON.back)),
        h('div', { style: 'font-size:20px;font-weight:700' }, 'Stats & réglages')),
      h('div', { class: 'tiles' },
        h('div', { style: 'background:var(--lv-moyen)' }, h('b', {}, results.length), h('span', {}, results.length > 1 ? 'grilles finies' : 'grille finie')),
        h('div', { style: 'background:var(--lv-difficile)' }, h('b', {}, streak.current), h('span', {}, streak.current > 1 ? 'jours de série' : 'jour de série')),
        h('div', { style: 'background:var(--lv-facile)' }, h('b', {}, streak.best), h('span', {}, 'record série'))),
      h('div', { class: 'card table' },
        h('div', { class: 'th' }, h('div', {}, 'Niveau'), h('div', {}, 'Finies'), h('div', {}, 'Record'), h('div', {}, 'Moyenne')),
        ...LEVELS.map((l) => {
          const st = levelStats(results, l.id);
          return h('div', {}, h('div', { style: 'font-weight:600' }, l.name), h('div', {}, st.done), h('div', {}, t(st.best)), h('div', {}, t(st.avg)));
        })),
      h('div', { class: 'foot', style: 'text-align:left;margin-top:-6px' }, `${hints} aide${hints > 1 ? 's' : ''} utilisée${hints > 1 ? 's' : ''} au total`),
      h('div', { class: 'label' }, 'Réglages'),
      h('div', { style: 'display:flex;flex-direction:column;gap:2px' }, ...OPTS.map(([k, title, sub]) =>
        h('button', {
          class: 'opt', role: 'switch', 'aria-checked': String(s[k]),
          onclick: async () => { await updateSettings({ [k]: !s[k] }); render(); },
        }, h('span', { class: 'tx' }, h('b', {}, title), h('span', {}, sub)), h('span', { class: 'sw' })))),
      h('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:8px' },
        h('span', { style: 'font-size:15px;font-weight:600' }, 'Style'),
        h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Style' },
          ...([['lumiere', 'Lumière'], ['papier', 'Papier']] as const).map(([v, l]) =>
            h('button', { role: 'radio', 'aria-checked': String(s.theme === v), onclick: async () => { await updateSettings({ theme: v }); render(); } }, l)))),
      h('div', { style: 'margin-top:auto;display:flex;flex-direction:column;align-items:center;gap:4px' },
        h('button', {
          class: 'link-btn',
          onclick: async () => {
            if (!confirm('Effacer toutes les parties, statistiques et aides ? Les réglages sont conservés.')) return;
            await resetAll();
            toast('Données effacées');
            go('');
          },
        }, 'Effacer mes données'),
        h('div', { class: 'foot' }, `Mots fléchés · version ${__APP_VERSION__}`),
        h('button', {
          class: 'link-btn',
          onclick: async () => {
            if (!navigator.onLine) return toast('Pas de connexion');
            toast('Recherche de mise à jour…');
            try {
              await app.sw?.update();
              // Si une nouvelle version s'installe, l'appli se recharge d'elle-même.
              setTimeout(() => { if (!app.sw?.installing && !app.sw?.waiting) toast('Vous avez la dernière version'); }, 2500);
            } catch { toast('Vérification impossible'); }
          },
        }, 'Vérifier les mises à jour')),
    ));
  };
  render();
}
