// Accès aux grilles embarquées (public/grids), mises en cache par le service worker.
import type { GridData, Level } from '../game/grid';

export const LEVELS: { id: Level; name: string; size: string }[] = [
  { id: 'facile', name: 'Facile', size: '7×8' },
  { id: 'moyen', name: 'Moyen', size: '9×10' },
  { id: 'difficile', name: 'Difficile', size: '9×11' },
  { id: 'expert', name: 'Expert', size: '9×11' },
];
export const levelName = (l: Level) => LEVELS.find((x) => x.id === l)!.name;

interface Index { version: number; levels: Record<Level, string[]> }

let index: Promise<Index> | null = null;
const cache = new Map<string, Promise<GridData>>();

export function getIndex(): Promise<Index> {
  index ??= fetch('grids/index.json').then((r) => {
    if (!r.ok) throw new Error('index des grilles introuvable');
    return r.json();
  });
  return index;
}

export function getGrid(id: string): Promise<GridData> {
  let p = cache.get(id);
  if (!p) {
    p = fetch(`grids/${id}.json`).then((r) => {
      if (!r.ok) throw new Error(`grille ${id} introuvable`);
      return r.json();
    });
    cache.set(id, p);
  }
  return p;
}

/** Numéro affiché d'une grille dans son niveau (moyen-007 → 7). */
export const gridNumber = (id: string) => Number(id.split('-')[1]);

/** Grille du jour : niveau Moyen, choisie de façon déterministe selon la date. */
export async function dailyGridId(date: string): Promise<string> {
  const ids = (await getIndex()).levels.moyen;
  const day = Math.floor(Date.parse(date + 'T12:00Z') / 86400000);
  return ids[day % ids.length];
}
