import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { app, loadSettings } from './app';
import { endScreen } from './screens/end';
import { homeScreen } from './screens/home';
import { playScreen } from './screens/play';
import { settingsScreen } from './screens/settings';
import { claimDaily } from './store/db';
import { h, toast } from './ui/dom';

const root = document.getElementById('app')!;

async function route() {
  app.cleanup?.();
  app.cleanup = null;
  const path = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const [name, arg] = [path.split('/')[0], path.split('/').slice(1).join('/')];
  try {
    if (name === 'jeu' && arg) await playScreen(root, arg);
    else if (name === 'fin' && arg) await endScreen(root, arg);
    else if (name === 'reglages') await settingsScreen(root);
    else await homeScreen(root);
  } catch (e) {
    console.error(e);
    root.replaceChildren(h('div', { class: 'screen' },
      h('p', {}, 'Impossible de charger cet écran.'),
      h('button', { class: 'btn', onclick: () => (location.hash = '') }, 'Accueil')));
  }
  window.scrollTo(0, 0);
}

async function start() {
  await loadSettings();
  const bonus = await claimDaily();
  window.addEventListener('hashchange', route);
  await route();
  if (bonus > 0) toast(`+${bonus} aides offertes aujourd’hui`);
  // Persistance demandée pour que le navigateur ne purge pas la sauvegarde.
  navigator.storage?.persist?.();
  // Nouvelle version (nouvelles grilles) : appliquée automatiquement.
  // Vérifie aussi les mises à jour à chaque retour au premier plan et toutes les 30 min.
  registerSW({
    immediate: true,
    onRegisteredSW(_url, r) {
      if (!r) return;
      app.sw = r;
      const check = () => { if (navigator.onLine) r.update().catch(() => {}); };
      setInterval(check, 30 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    },
  });
  // Changement de jour pendant que l'appli est ouverte : bonus quotidien.
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    const n = await claimDaily();
    if (n > 0) { toast(`+${n} aides offertes aujourd’hui`); if (!location.hash.includes('jeu/')) route(); }
  });
}

start();
