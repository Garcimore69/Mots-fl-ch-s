"""Construit tools/data/lex.json à partir de wordfreq ∩ dictionnaire français.

Usage : python3 tools/build_lexicon.py
Prérequis : pip install wordfreq ; tools/data/dict-fr.json
(paquet npm an-array-of-french-words, fichier index.json).

Sortie : {FORME: [rang, [formes accentuées...]]} ; rang = position dans les
fréquences wordfreq (0 = le plus fréquent).
"""
import json
import re
import unicodedata
from pathlib import Path

from wordfreq import top_n_list

from wordlists import ANGLICISMES, DEUX_LETTRES, EXCLUS, INTERDITS, INTERDITS_EXACTS

HERE = Path(__file__).parent
VOYELLES = set("AEIOUY")


def norm(w: str) -> str:
    s = "".join(c for c in unicodedata.normalize("NFD", w) if unicodedata.category(c) != "Mn")
    return s.upper().replace("Œ", "OE").replace("Æ", "AE")


def banned(n: str) -> bool:
    return n in INTERDITS_EXACTS or any(n.startswith(p) for p in INTERDITS)


def main() -> None:
    d = set(json.loads((HERE / "data" / "dict-fr.json").read_text()))
    out: dict[str, list] = {}
    for rank, w in enumerate(top_n_list("fr", 80000)):
        if w not in d or not re.fullmatch(r"[a-zàâäçéèêëîïôöùûüÿœæ]+", w):
            continue
        if not 2 <= len(w) <= 11:
            continue
        n = norm(w)
        if len(n) == 2 and n not in DEUX_LETTRES:
            continue
        if not VOYELLES & set(n):
            continue
        if n in ANGLICISMES or n in EXCLUS or banned(n):
            continue
        if n in out:
            if w not in out[n][1]:
                out[n][1].append(w)
        else:
            out[n] = [rank, [w]]
    (HERE / "data" / "lex.json").write_text(json.dumps(out, ensure_ascii=False))
    print(f"{len(out)} mots")


if __name__ == "__main__":
    main()
