// Croise l'index des grilles et la sauvegarde locale.
import type { Level } from '../game/grid';
import { type Result, type SavedGame, allGames, allResults } from '../store/db';
import { getIndex } from './grids';

/** Prochaine grille jamais commencée d'un niveau (null si toutes jouées). */
export async function nextGrid(level: Level): Promise<string | null> {
  const [idx, games, results] = await Promise.all([getIndex(), allGames(), allResults()]);
  const used = new Set([...games.map((g) => g.gridId), ...results.map((r) => r.gridId)]);
  return idx.levels[level].find((id) => !used.has(id)) ?? null;
}

export async function inProgress(): Promise<SavedGame[]> {
  return (await allGames()).filter((g) => !g.progress.done).sort((a, b) => b.updatedAt - a.updatedAt);
}

export interface LevelStats { done: number; best: number | null; avg: number | null; hints: number }

export function levelStats(results: Result[], level: Level): LevelStats {
  const r = results.filter((x) => x.level === level);
  const times = r.map((x) => x.time);
  return {
    done: r.length,
    best: times.length ? Math.min(...times) : null,
    avg: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null,
    hints: r.reduce((a, x) => a + x.hints, 0),
  };
}
