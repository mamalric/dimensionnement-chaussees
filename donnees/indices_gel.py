"""Indices de gel des stations Météo-France à partir des données quotidiennes ouvertes (data.gouv.fr).

Pour chaque station et chaque hiver (août à juillet, repéré par l'année de janvier) :
  - somme : somme des températures moyennes journalières négatives, en valeur absolue (°C.jour) ;
  - ecart : plus grande baisse de la courbe des températures moyennes cumulées (un dégel
    intermédiaire réduit l'indice).
Un hiver n'est retenu que si novembre à mars est complet à 97 % au moins.
Sortie : un JSON par département dans le dossier de sortie, avec les indices de chaque hiver.

Usage : python donnees/indices_gel.py <dossier de travail>   (environ 900 Mo téléchargés, effacés au fur et à mesure)
Pour une nouvelle année, mettre à jour les noms de fichiers ("previous-1950-2024", "latest-2025-2026").
"""
import csv, gzip, io, json, os, sys, urllib.request, concurrent.futures as cf
from datetime import date

BASE = "https://meteofrance.s3.sbg.io.cloud.ovh.net/data/synchro_ftp/BASE/QUOT/"
DEPS = [f"{i:02d}" for i in range(1, 96)]          # la Corse est le fichier 20
OUT = sys.argv[1]
RAW = os.path.join(OUT, "brut")
os.makedirs(RAW, exist_ok=True)

def telecharger(nom):
    chemin = os.path.join(RAW, nom)
    if not os.path.exists(chemin):
        urllib.request.urlretrieve(BASE + nom, chemin + ".part")
        os.replace(chemin + ".part", chemin)
    return chemin

def lire(chemin, postes):
    with gzip.open(chemin, "rt", encoding="utf-8", errors="replace", newline="") as f:
        r = csv.reader(f, delimiter=";")
        tete = next(r)
        ix = {k: tete.index(k) for k in ("NUM_POSTE", "NOM_USUEL", "LAT", "LON", "ALTI", "AAAAMMJJ", "TN", "QTN", "TX", "QTX", "TNTXM", "QTNTXM")}
        for l in r:
            tm = l[ix["TNTXM"]].strip()
            q = l[ix["QTNTXM"]].strip()
            if tm == "" or q == "2":
                tn, tx = l[ix["TN"]].strip(), l[ix["TX"]].strip()
                if tn == "" or tx == "" or l[ix["QTN"]].strip() == "2" or l[ix["QTX"]].strip() == "2":
                    continue
                tm = (float(tn) + float(tx)) / 2
            else:
                tm = float(tm)
            num = l[ix["NUM_POSTE"]].strip()
            p = postes.get(num)
            if p is None:
                p = postes[num] = {"nom": l[ix["NOM_USUEL"]].strip(), "lat": float(l[ix["LAT"]]), "lon": float(l[ix["LON"]]), "alt": float(l[ix["ALTI"]] or 0), "jours": {}}
            p["jours"][l[ix["AAAAMMJJ"]].strip()] = tm

def hivers(jours):
    """Indices par hiver (année de janvier) : {annee: (somme, ecart)} pour les hivers assez complets."""
    par = {}
    for d, t in jours.items():
        a, m = int(d[:4]), int(d[4:6])
        h = a + 1 if m >= 8 else a
        par.setdefault(h, []).append((d, t))
    res = {}
    for h, js in par.items():
        js.sort()
        coeur = sum(1 for d, _ in js if (d[4:6] in ("11", "12") and int(d[:4]) == h - 1) or (d[4:6] in ("01", "02", "03") and int(d[:4]) == h))
        attendu = (date(h, 4, 1) - date(h - 1, 11, 1)).days
        if coeur < 0.97 * attendu:
            continue
        somme, cumul, haut, ecart = 0.0, 0.0, 0.0, 0.0
        for _, t in js:
            if t < 0: somme -= t
            cumul += t
            haut = max(haut, cumul)
            ecart = max(ecart, haut - cumul)
        res[h] = (round(somme, 1), round(ecart, 1))
    return res

def traiter(dep):
    sortie = os.path.join(OUT, f"dep_{dep}.json")
    if os.path.exists(sortie):
        return dep, "déjà fait"
    postes = {}
    fichiers = [f"Q_{dep}_previous-1950-2024_RR-T-Vent.csv.gz", f"Q_{dep}_latest-2025-2026_RR-T-Vent.csv.gz"]
    for nom in fichiers:
        lire(telecharger(nom), postes)
    resultat = {}
    for num, p in postes.items():
        h = hivers(p["jours"])
        if len(h) >= 10:
            resultat[num] = {"nom": p["nom"], "lat": p["lat"], "lon": p["lon"], "alt": p["alt"], "hivers": h}
    with open(sortie, "w", encoding="utf-8") as f:
        json.dump(resultat, f, ensure_ascii=False)
    for nom in fichiers:
        os.remove(os.path.join(RAW, nom))
    return dep, f"{len(resultat)} stations"

if __name__ == "__main__":
    with cf.ThreadPoolExecutor(max_workers=6) as ex:
        for fut in cf.as_completed([ex.submit(traiter, d) for d in DEPS]):
            try:
                print(*fut.result(), flush=True)
            except Exception as e:
                print("erreur", e, flush=True)
