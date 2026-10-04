"""Validateur bloquant des grilles.

Usage : python3 tools/validate.py <fichier.json>...   (brouillons ou public/grids)
Code de sortie 1 si une grille échoue. Utilisé aussi par la CI avant déploiement.

Contrôles (cf. claude/decisions.md) :
- dimensions conformes au niveau, gabarit et solution cohérents ;
- chaque case-lettre couverte, chaque case-définition porte 1 ou 2 définitions ;
- les mots déclarés correspondent exactement aux emplacements du gabarit ;
- croisements cohérents (le mot se lit dans la solution) ;
- tous les mots existent dans le lexique ;
- pas de doublon ni de mots de même famille ;
- mots de 2 lettres limités à la liste blanche ;
- pas de vocabulaire violent ou sordide (réponses et définitions) ;
- chaque définition existe, est courte et ne contient pas la réponse.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

from grid import check_layout, same_family
from wordlists import DEUX_LETTRES, INTERDITS, INTERDITS_EXACTS

HERE = Path(__file__).parent
LEX = json.loads((HERE / "data" / "lex.json").read_text())
SIZES = {"facile": (7, 8), "moyen": (9, 10), "difficile": (9, 11), "expert": (9, 11)}
MAX_CLUE = 34  # caractères, pour rester lisible dans une case


def norm(s: str) -> str:
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return s.upper().replace("Œ", "OE").replace("Æ", "AE")


def banned(n: str) -> bool:
    return n in INTERDITS_EXACTS or any(n.startswith(p) for p in INTERDITS)


def word_list(g):
    """Accepte le format brouillon (words) ou publié (clues)."""
    if "words" in g:
        return [(w["d"], w["r"], w["c"], w["n"], w.get("clue", "")) for w in g["words"]]
    return [(w["d"], w["r"], w["c"], w["n"], w.get("t", "")) for w in g["clues"]]


def validate(g) -> list[str]:
    err = []
    C, R = g["cols"], g["rows"]
    lay, sol = g["layout"], g["solution"]
    if SIZES.get(g["level"]) != (C, R):
        err.append(f"taille {C}×{R} non conforme au niveau {g['level']}")
    if len(lay) != R or len(sol) != R or any(len(x) != C for x in lay + sol):
        return err + ["dimensions du gabarit ou de la solution incorrectes"]
    for r in range(R):
        for c in range(C):
            if (lay[r][c] == "#") != (sol[r][c] == "#"):
                err.append(f"case ({r},{c}) : gabarit et solution divergent")
            elif lay[r][c] == "." and not re.fullmatch("[A-Z]", sol[r][c]):
                err.append(f"case ({r},{c}) : lettre invalide {sol[r][c]!r}")
    sl = check_layout(lay)
    if sl is None:
        return err + ["gabarit invalide (case non couverte, définition orpheline ou >2 définitions par case)"]
    words = word_list(g)
    if {s for s in sl} != {w[:4] for w in words} or len(words) != len(sl):
        err.append("les mots déclarés ne correspondent pas aux emplacements du gabarit")
    answers = []
    for d, r, c, n, clue in words:
        a = "".join(sol[r][c + i] if d == "H" else sol[r + i][c] for i in range(n))
        if "#" in a:
            err.append(f"{d}{r},{c} : traverse une case définition")
            continue
        answers.append(a)
        tag = f"{a} ({d}{r},{c})"
        if a not in LEX:
            err.append(f"{tag} : absent du lexique")
        if n == 2 and a not in DEUX_LETTRES:
            err.append(f"{tag} : mot de 2 lettres hors liste blanche")
        if banned(a):
            err.append(f"{tag} : vocabulaire interdit")
        if not clue.strip():
            err.append(f"{tag} : définition manquante")
            continue
        if len(clue) > MAX_CLUE:
            err.append(f"{tag} : définition trop longue ({len(clue)} > {MAX_CLUE})")
        toks = re.findall(r"[A-Z]+", norm(clue))
        if a in toks or (len(a) >= 4 and a in norm(clue).replace(" ", "")):
            err.append(f"{tag} : la définition contient la réponse")
        if any(len(t) >= 4 and same_family(t, a) for t in toks):
            err.append(f"{tag} : la définition contient un mot de la même famille")
        if any(banned(t) for t in toks):
            err.append(f"{tag} : vocabulaire interdit dans la définition")
    # Une définition ne doit pas livrer un autre mot de la grille.
    for d, r, c, n, clue in words:
        toks = set(re.findall(r"[A-Z]+", norm(clue)))
        for a in answers:
            if len(a) >= 4 and any(t == a or (len(t) >= 4 and (t.startswith(a) or a.startswith(t))) for t in toks):
                err.append(f"définition « {clue} » : livre {a}, autre mot de la grille")
    for i, a in enumerate(answers):
        for b in answers[i + 1:]:
            if a == b:
                err.append(f"doublon : {a}")
            elif same_family(a, b):
                err.append(f"même famille : {a} / {b}")
    return err


def main(paths):
    bad = 0
    for p in paths:
        g = json.loads(Path(p).read_text())
        e = validate(g)
        if e:
            bad += 1
            print(f"✗ {p}")
            for x in e:
                print(f"   - {x}")
        else:
            print(f"✓ {p}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main(sys.argv[1:])
