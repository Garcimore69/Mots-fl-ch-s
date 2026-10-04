// État partagé et navigation (routes en #hash : fonctionne sur GitHub Pages sans configuration).
import { DEFAULT_SETTINGS, type Settings, getSettings, saveSettings } from './store/db';

export const app = {
  settings: { ...DEFAULT_SETTINGS } as Settings,
  cleanup: null as null | (() => void),
};

export async function loadSettings() {
  app.settings = await getSettings();
  applyTheme();
}

export async function updateSettings(patch: Partial<Settings>) {
  app.settings = { ...app.settings, ...patch };
  applyTheme();
  await saveSettings(app.settings);
}

export function applyTheme() {
  const s = app.settings;
  document.documentElement.dataset.theme = s.theme;
  document.documentElement.classList.toggle('big', s.bigClues);
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#ffffff';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
}

export function go(path: string) {
  const target = '#/' + path;
  if (location.hash === target) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = target;
}
