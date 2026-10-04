"""Publie les brouillons validés dans public/grids/.

Usage : python3 tools/publish.py [brouillon.json ...]   (défaut : tous les brouillons)
Un brouillon n'est publié que s'il passe le validateur. Le fichier
public/grids/index.json (liste des grilles par niveau) est régénéré.
"""
import json
import sys
from pathlib import Path

from validate import validate

HERE = Path(__file__).parent
OUT = HERE.parent / "public" / "grids"
ORDER = ["facile", "moyen", "difficile", "expert"]


def main(paths):
    OUT.mkdir(parents=True, exist_ok=True)
    files = [Path(p) for p in paths] or sorted((HERE / "drafts").glob("*.json"))
    failed = 0
    for f in files:
        g = json.loads(f.read_text())
        e = validate(g)
        if e:
            failed += 1
            print(f"✗ {f.name} non publié ({len(e)} erreur(s)) — lancer validate.py")
            continue
        pub = {
            "id": g["id"], "level": g["level"], "cols": g["cols"], "rows": g["rows"],
            "layout": g["layout"], "solution": g["solution"],
            "clues": [{"d": w["d"], "r": w["r"], "c": w["c"], "n": w["n"], "t": w["clue"]} for w in g["words"]],
        }
        (OUT / f"{g['id']}.json").write_text(json.dumps(pub, ensure_ascii=False, separators=(",", ":")))
        print(f"✓ {g['id']} publié")
    index = {lv: [] for lv in ORDER}
    for f in sorted(OUT.glob("*.json")):
        if f.name == "index.json":
            continue
        g = json.loads(f.read_text())
        index[g["level"]].append(g["id"])
    (OUT / "index.json").write_text(json.dumps({"version": 1, "levels": index}, ensure_ascii=False, indent=1))
    print("index :", {k: len(v) for k, v in index.items()})
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main(sys.argv[1:])
