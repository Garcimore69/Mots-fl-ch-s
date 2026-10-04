// Sauvegarde locale (IndexedDB) : parties en cours, résultats, réglages, aides, série.
import { type DBSchema, type IDBPDatabase, openDB } from 'idb';
import type { Progress } from '../game/engine';
import type { Level } from '../game/grid';

export interface Settings {
  vibration: boolean;
  sounds: boolean;
  skipFilled: boolean;
  noNet: boolean;
  bigClues: boolean;
  theme: 'lumiere' | 'papier';
}
export const DEFAULT_SETTINGS: Settings = {
  vibration: true, sounds: false, skipFilled: true, noNet: false, bigClues: false, theme: 'lumiere',
};

export interface Wallet { aides: number; lastDaily: string }
export interface Streak { current: number; best: number; lastDay: string }

export interface SavedGame {
  key: string; // id de grille, ou "daily:AAAA-MM-JJ"
  gridId: string;
  level: Level;
  daily?: string;
  progress: Progress;
  updatedAt: number;
}

export interface Result {
  key: string;
  gridId: string;
  level: Level;
  time: number; // ms
  hints: number;
  errors: number;
  at: number;
  daily?: string;
}

interface Schema extends DBSchema {
  kv: { key: string; value: unknown };
  games: { key: string; value: SavedGame };
  results: { key: number; value: Result; indexes: { level: string } };
}

export const AIDES_START = 4;
export const AIDES_MAX = 25;
export const AIDES_DAILY = 3;
export const GAIN: Record<Level, number> = { facile: 1, moyen: 2, difficile: 3, expert: 4 };

let dbp: Promise<IDBPDatabase<Schema>> | null = null;
function db() {
  dbp ??= openDB<Schema>('mots-fleches', 1, {
    upgrade(d) {
      d.createObjectStore('kv');
      d.createObjectStore('games', { keyPath: 'key' });
      d.createObjectStore('results', { autoIncrement: true }).createIndex('level', 'level');
    },
  });
  return dbp;
}

export function today(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function dayDiff(a: string, b: string) {
  return Math.round((Date.parse(b + 'T12:00') - Date.parse(a + 'T12:00')) / 86400000);
}

async function kvGet<T>(k: string, def: T): Promise<T> {
  const v = (await (await db()).get('kv', k)) as T | undefined;
  return v === undefined ? def : { ...def, ...v };
}
async function kvSet(k: string, v: unknown) { await (await db()).put('kv', v, k); }

export const getSettings = () => kvGet<Settings>('settings', DEFAULT_SETTINGS);
export const saveSettings = (s: Settings) => kvSet('settings', s);

export const getStreak = () => kvGet<Streak>('streak', { current: 0, best: 0, lastDay: '' });

/** Série affichée : remise à zéro si un jour a été sauté. */
export async function currentStreak(): Promise<Streak> {
  const s = await getStreak();
  if (s.lastDay && dayDiff(s.lastDay, today()) > 1) return { ...s, current: 0 };
  return s;
}

export async function getWallet(): Promise<Wallet> {
  return kvGet<Wallet>('wallet', { aides: AIDES_START, lastDaily: '' });
}

/** +3 aides offertes chaque jour (plafond 25). Renvoie le nombre réellement ajouté. */
export async function claimDaily(): Promise<number> {
  const w = await getWallet();
  const t = today();
  if (w.lastDaily === t) return 0;
  const first = w.lastDaily === '';
  const add = first ? 0 : Math.min(AIDES_DAILY, AIDES_MAX - w.aides);
  await kvSet('wallet', { aides: w.aides + Math.max(0, add), lastDaily: t });
  return Math.max(0, add);
}

export async function addAides(n: number): Promise<{ added: number; aides: number }> {
  const w = await getWallet();
  const aides = Math.max(0, Math.min(AIDES_MAX, w.aides + n));
  await kvSet('wallet', { ...w, aides });
  return { added: aides - w.aides, aides };
}

export async function getGame(key: string) { return (await db()).get('games', key); }
export async function saveGame(g: SavedGame) { await (await db()).put('games', g); }
export async function allGames() { return (await db()).getAll('games'); }

export async function allResults() { return (await db()).getAll('results'); }

/** Enregistre une grille terminée : résultat, gain d'aides, série du jour. */
export async function finishGame(g: SavedGame): Promise<{ added: number; aides: number; streak: Streak; first: boolean }> {
  const d = await db();
  const previous = (await d.getAll('results')).some((r) => r.gridId === g.gridId);
  const p = g.progress;
  await d.add('results', {
    key: g.key, gridId: g.gridId, level: g.level, time: p.elapsed, hints: p.hintsUsed,
    errors: p.wrongEver.length, at: Date.now(), daily: g.daily,
  });
  // Pas de gain en rejouant une grille déjà terminée.
  const gain = previous ? { added: 0, aides: (await getWallet()).aides } : await addAides(GAIN[g.level]);
  let streak = await getStreak();
  if (g.daily && g.daily === today() && streak.lastDay !== g.daily) {
    const cur = streak.lastDay && dayDiff(streak.lastDay, g.daily) === 1 ? streak.current + 1 : 1;
    streak = { current: cur, best: Math.max(streak.best, cur), lastDay: g.daily };
    await kvSet('streak', streak);
  }
  return { ...gain, streak: await currentStreak(), first: !previous };
}

export async function useAide(): Promise<boolean> {
  const w = await getWallet();
  if (w.aides <= 0) return false;
  await kvSet('wallet', { ...w, aides: w.aides - 1 });
  return true;
}

/** Remise à zéro complète (réglages conservés). */
export async function resetAll() {
  const d = await db();
  await d.clear('games');
  await d.clear('results');
  await d.delete('kv', 'wallet');
  await d.delete('kv', 'streak');
}
