"""Affiche ou renseigne les définitions d'un brouillon.

  python3 tools/clues.py drafts/moyen-001.json            # liste des mots
  python3 tools/clues.py drafts/moyen-001.json defs.txt   # applique les définitions

defs.txt : une ligne « RÉPONSE | définition » par mot (ordre libre ; si une
réponse apparaît deux fois, les lignes sont appliquées dans l'ordre des mots).
"""
import json
import sys
from pathlib import Path


def main():
    p = Path(sys.argv[1])
    g = json.loads(p.read_text())
    if len(sys.argv) == 2:
        print("\n".join(g["solution"]))
        for w in g["words"]:
            print(f'{w["d"]}{w["r"]},{w["c"]} {w["answer"]:<11} {"/".join(w["forms"]):<24} {w["clue"]}')
        return
    lines = [l for l in Path(sys.argv[2]).read_text().splitlines() if "|" in l]
    todo = {}
    for l in lines:
        a, t = (x.strip() for x in l.split("|", 1))
        todo.setdefault(a.upper(), []).append(t)
    for w in g["words"]:
        q = todo.get(w["answer"])
        if q:
            w["clue"] = q.pop(0)
    left = {k: v for k, v in todo.items() if v}
    if left:
        print("non utilisées :", left)
    missing = [w["answer"] for w in g["words"] if not w["clue"]]
    if missing:
        print("sans définition :", missing)
    p.write_text(json.dumps(g, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
