"""Générateur de grilles : gabarit aléatoire + remplissage par backtracking.

Usage :
  python3 tools/gen.py <niveau> <nombre> [--seed N]
  ex. python3 tools/gen.py moyen 3 --seed 42

Écrit des brouillons dans tools/drafts/<niveau>-<NNN>.json, avec les
définitions vides. On rédige ensuite les définitions, puis :
  python3 tools/validate.py tools/drafts/*.json
  python3 tools/publish.py
"""
import argparse
import json
import random
import time
from collections import defaultdict
from pathlib import Path

from grid import cells, check_layout, same_family

HERE = Path(__file__).parent
LEX = {k: tuple(v) for k, v in json.loads((HERE / "data" / "lex.json").read_text()).items()}

# cols × rows ; rang max du vocabulaire (fréquence wordfreq).
LEVELS = {
    "facile": dict(cols=7, rows=8, maxrank=6000, dens=0.16),
    "moyen": dict(cols=9, rows=10, maxrank=15000, dens=0.17),
    "difficile": dict(cols=9, rows=11, maxrank=30000, dens=0.17),
    "expert": dict(cols=9, rows=11, maxrank=60000, dens=0.16),
}


def rand_layout(R, C, rnd, dens):
    g = [["."] * C for _ in range(R)]
    for c in range(0, C, 2):
        g[0][c] = "#"
    for r in range(0, R, 2):
        g[r][0] = "#"
    for r in range(1, R):
        for c in range(1, C):
            if rnd.random() < dens:
                g[r][c] = "#"
    return ["".join(x) for x in g]


def layout_ok(L, sl):
    if sum(1 for s in sl if s[3] == 2) > 4:
        return False
    # pas de bloc de cases définitions
    if any("###" in row for row in L):
        return False
    for r in range(len(L) - 1):
        for c in range(1, len(L[0]) - 1):
            if L[r][c] == L[r][c + 1] == L[r + 1][c] == L[r + 1][c + 1] == "#":
                return False
    # colonnes : pas 3 définitions empilées
    for c in range(len(L[0])):
        col = "".join(row[c] for row in L)
        if "###" in col:
            return False
    return True


def fill(sl, maxrank, rnd, timeout=6, avoid=frozenset()):
    bylen = defaultdict(list)
    for w, (rank, _) in LEX.items():
        if rank <= maxrank and w not in avoid:
            bylen[len(w)].append(w)
    for k in bylen:
        rnd.shuffle(bylen[k])
    idx = defaultdict(set)
    for n, ws in bylen.items():
        for w in ws:
            for i, ch in enumerate(w):
                idx[(n, i, ch)].add(w)
    grid, used, assign = {}, [], {}
    t0 = time.time()

    def ok(w):
        return not any(same_family(u, w) for u in used)

    def cands(s):
        cs = cells(s)
        n = len(cs)
        res = None
        for i, p in enumerate(cs):
            if p in grid:
                st = idx[(n, i, grid[p])]
                res = st if res is None else res & st
                if not res:
                    return []
        return bylen[n] if res is None else res

    def rec():
        if time.time() - t0 > timeout:
            raise TimeoutError
        todo = [s for s in sl if s not in assign]
        if not todo:
            return True
        best, bc = None, None
        for s in todo:
            c = cands(s)
            if not c:
                return False
            if bc is None or len(c) < len(bc):
                best, bc = s, c
        bc = [w for w in bc if ok(w)]
        if not bc:
            return False
        rnd.shuffle(bc)
        for w in bc[:40]:
            placed = []
            for p, ch in zip(cells(best), w):
                if p not in grid:
                    grid[p] = ch
                    placed.append(p)
            assign[best] = w
            used.append(w)
            if rec():
                return True
            del assign[best]
            used.pop()
            for p in placed:
                del grid[p]
        return False

    try:
        return (assign, grid) if rec() else None
    except TimeoutError:
        return None


def generate(level, rnd, avoid=frozenset()):
    p = LEVELS[level]
    R, C = p["rows"], p["cols"]
    for t in range(200000):
        L = rand_layout(R, C, rnd, p["dens"])
        sl = check_layout(L)
        if not sl or not layout_ok(L, sl):
            continue
        res = fill(sl, p["maxrank"], rnd, avoid=avoid)
        if not res:
            continue
        assign, g = res
        sol = ["".join(g.get((r, c), "#") for c in range(C)) for r in range(R)]
        words = []
        for (d, r, c, n), w in sorted(assign.items(), key=lambda x: (x[0][0], x[0][1], x[0][2])):
            rank, forms = LEX[w]
            words.append(dict(d=d, r=r, c=c, n=n, answer=w, forms=list(forms), rank=rank, clue=""))
        return dict(level=level, cols=C, rows=R, layout=L, solution=sol, words=words)
    raise RuntimeError("aucune grille trouvée")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("level", choices=LEVELS)
    ap.add_argument("count", type=int)
    ap.add_argument("--seed", type=int, default=None)
    a = ap.parse_args()
    rnd = random.Random(a.seed)
    out = HERE / "drafts"
    out.mkdir(exist_ok=True)
    # Évite les mots (5 lettres et plus) déjà utilisés dans les grilles existantes
    # pour varier le vocabulaire d'une grille à l'autre.
    existing = sorted(out.glob("*-*.json")) + sorted((HERE.parent / "public" / "grids").glob("*-*.json"))
    seen = set()
    nums = [0]
    for f in existing:
        try:
            if f.stem.startswith(a.level + "-"):
                nums.append(int(f.stem.split("-")[1]))
        except (IndexError, ValueError):
            pass
        g0 = json.loads(f.read_text())
        for row in [w["answer"] for w in g0.get("words", [])]:
            if len(row) >= 5:
                seen.add(row)
    taken = set(nums)
    for _ in range(a.count):
        n = min(i for i in range(1, 1000) if i not in taken)  # comble les trous
        taken.add(n)
        g = generate(a.level, rnd, avoid=frozenset(seen))
        g["id"] = f"{a.level}-{n:03d}"
        g = {"id": g.pop("id"), **g}
        (out / f"{g['id']}.json").write_text(json.dumps(g, ensure_ascii=False, indent=1))
        seen.update(w["answer"] for w in g["words"] if w["n"] >= 5)
        print(g["id"], flush=True)
        print("\n".join(g["solution"]))


if __name__ == "__main__":
    main()
