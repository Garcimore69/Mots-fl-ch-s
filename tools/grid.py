"""Géométrie d'une grille de mots fléchés.

Gabarit : liste de chaînes, '#' = case définition, '.' = case lettre.
Un emplacement (slot) = (sens, ligne, colonne, longueur), sens 'H' ou 'V'.
La logique miroir côté app est dans src/game/grid.ts : les deux doivent
rester identiques.
"""
from collections import defaultdict

Slot = tuple  # (d, r, c, n)


def slots_of(layout: list[str]) -> list[Slot]:
    R, C = len(layout), len(layout[0])

    def L(r, c):
        return 0 <= r < R and 0 <= c < C and layout[r][c] == "."

    slots = []
    for r in range(R):
        c = 0
        while c < C:
            if L(r, c):
                s = c
                while L(r, c):
                    c += 1
                if c - s >= 2:
                    slots.append(("H", r, s, c - s))
            else:
                c += 1
    for c in range(C):
        r = 0
        while r < R:
            if L(r, c):
                s = r
                while L(r, c):
                    r += 1
                if r - s >= 2:
                    slots.append(("V", s, c, r - s))
            else:
                r += 1
    return slots


def owner(layout: list[str], slot: Slot):
    """Case définition qui porte le mot, et forme de la flèche.

    'right' : définition à gauche du mot, flèche →
    'down' : définition au-dessus, flèche ↓
    'downright' : mot horizontal en colonne 0, définition au-dessus (↳)
    'rightdown' : mot vertical en ligne 0, définition à gauche (⤵)
    """
    d, r, c, n = slot

    def isclue(rr, cc):
        return 0 <= rr < len(layout) and 0 <= cc < len(layout[0]) and layout[rr][cc] == "#"

    if d == "H":
        if isclue(r, c - 1):
            return (r, c - 1, "right")
        if c == 0 and isclue(r - 1, 0):
            return (r - 1, 0, "downright")
    else:
        if isclue(r - 1, c):
            return (r - 1, c, "down")
        if r == 0 and isclue(0, c - 1):
            return (0, c - 1, "rightdown")
    return None


def cells(slot: Slot) -> list[tuple[int, int]]:
    d, r, c, n = slot
    return [(r, c + i) if d == "H" else (r + i, c) for i in range(n)]


def check_layout(layout: list[str]):
    """Renvoie la liste des slots si le gabarit est valide, sinon None."""
    R, C = len(layout), len(layout[0])
    if any(len(row) != C for row in layout):
        return None
    sl = slots_of(layout)
    cnt = defaultdict(int)
    covered = set()
    for s in sl:
        o = owner(layout, s)
        if not o:
            return None
        cnt[o[:2]] += 1
        covered.update(cells(s))
    if any(v > 2 for v in cnt.values()):
        return None
    for r in range(R):
        for c in range(C):
            if layout[r][c] == "#" and cnt[(r, c)] == 0:
                return None
            if layout[r][c] == "." and (r, c) not in covered:
                return None
    return sl


def same_family(a: str, b: str) -> bool:
    """Deux mots de la même famille (TUE/TUEE, TETE/TETES, HUMIDE/HUMIDITE)."""
    if a == b:
        return True
    m = min(len(a), len(b))
    if m >= 3 and (a.startswith(b) or b.startswith(a)):
        return True
    p = 0
    while p < m and a[p] == b[p]:
        p += 1
    return p >= max(4, m - 2)
