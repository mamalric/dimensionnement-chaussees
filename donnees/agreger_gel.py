"""Agrège les indices par station, valide sur le catalogue de 1998 et écrit le tableau compact pour la page.

Usage : python donnees/agreger_gel.py <dossier de sortie de indices_gel.py> donnees [index.html]
Avec le troisième argument, le tableau STATIONS_MF de la page est remplacé.

Hiver exceptionnel (HE) : indice le plus fort de la période. Hiver rigoureux non exceptionnel (HRNE) :
n-ième plus fort, n = nombre d'hivers / 10 arrondi (catalogue de 1998, § 5.1). Définition de l'indice d'un
hiver : plus grande baisse de la courbe des températures moyennes journalières cumulées.
"""
import glob, json, os, re, sys, unicodedata
sys.stdout.reconfigure(encoding="utf-8")
SORTIE, SCRATCH = sys.argv[1], sys.argv[2]
PAGE = sys.argv[3] if len(sys.argv) > 3 else None
PERIODES = {"A": (1951, 1997), "B": (1951, 2026)}
MIN_HIVERS = 20

def stats(h, a0, a1):
    v = sorted((x[1] for y, x in h.items() if a0 <= int(y) <= a1), reverse=True)
    if len(v) < MIN_HIVERS: return None
    n = max(1, int(len(v) / 10 + 0.5))
    return len(v), v[0], v[n - 1]

def dep_de(num, lat, lon):
    d = num[:2]
    if d != "20": return d
    limite = 42.27 + (41.86 - 42.27) * (lon - 8.69) / (9.40 - 8.69)
    return "2A" if lat < limite else "2B"

PETITS = {"le", "la", "les", "de", "du", "des", "sur", "en", "et", "sous", "aux", "au", "d", "l", "lès", "les"}
def joli(nom):
    nom = nom.replace("_", " ").strip()
    morceaux = re.split(r"([ \-'/])", nom.lower())
    out, premier = [], True
    for m in morceaux:
        if m in (" ", "-", "'", "/", ""): out.append(m); continue
        out.append(m if (m in PETITS and not premier) else m[:1].upper() + m[1:])
        premier = False
    return "".join(out)

stations = []
for f in sorted(glob.glob(os.path.join(SORTIE, "dep_*.json"))):
    for num, p in json.load(open(f, encoding="utf-8")).items():
        a = stats(p["hivers"], *PERIODES["A"]); b = stats(p["hivers"], *PERIODES["B"])
        if not a and not b: continue
        stations.append({"num": num, "nom": p["nom"], "dep": dep_de(num, p["lat"], p["lon"]), "lat": p["lat"], "lon": p["lon"], "alt": p["alt"], "A": a, "B": b})
print("stations retenues :", len(stations), "dont période du catalogue :", sum(1 for s in stations if s["A"]))

# Validation sur les 83 stations du catalogue
cat = []
for m in re.finditer(r'\["(\w{2})", "([^"]+)", (\d+), (\d+)\]', open(os.path.join(SCRATCH, "catalogue-1998-indices-gel.txt"), encoding="utf-8").read()):
    cat.append((m.group(1), m.group(2), int(m.group(3)), int(m.group(4))))
def norm(t):
    t = unicodedata.normalize("NFD", t.upper()); t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"[^A-Z]", " ", t)
ALIAS = {"Marignane": "MARIGNANE", "Paris Le Bourget": "BOURGET", "Lyon-Bron": "BRON", "Rouen-Boos": "BOOS", "Le-Puy-Chadrac": "CHADRAC",
         "La Hève": "HEVE", "Saint-Raphaël": "RAPHAEL", "Luz-la-Croix-Haute": "CROIX HAUTE", "Boulogne-sur-mer": "BOULOGNE",
         "Mont-Saint-Vincent": "MONT ST VINCENT", "Chateau-Chinon": "CHATEAU CHINON", "Challes-les-Eaux": "CHALLES", "Bourg-Saint-Maurice": "BOURG ST MAURICE",
         "Saint-Etienne": "ETIENNE", "Saint-Quentin": "ST QUENTIN", "Saint-Auban": "AUBAN", "Saint-Girons": "GIRONS", "Saint-Dizier": "DIZIER",
         "Clermont-Ferrand": "CLERMONT", "Mont-de-Marsan": "MONT DE MARSAN", "La Rochelle": "ROCHELLE", "La Hague": "HAGUE", "Le Mans": "MANS"}

def brut(num):
    d = num[:2]
    p = json.load(open(os.path.join(SORTIE, f"dep_{d}.json"), encoding="utf-8"))[num]
    return {"nom": p["nom"], "lat": p["lat"], "lon": p["lon"], "alt": p["alt"]}
MANUEL = {
    "Luz-la-Croix-Haute": ("26168001", None), "Angers": ("49020001", None), "Mont-Saint-Vincent": ("71320001", None),
    "Paris Le Bourget": ("95088001", None), "Bar-le-Duc": ("55029007", None), "Saint-Raphaël": ("83118006", None),
    "Tarare": ("69243000", {"nom": "TARARE", "lat": 45.9071, "lon": 4.4302, "alt": 421}),
}
for k, (num, info) in list(MANUEL.items()):
    if info is None: MANUEL[k] = (num, brut(num))
ecarts, lignes = [], []
for d, nom, he, hr in cat:
    cle = ALIAS.get(nom, norm(nom).split()[0])
    cands = [s for s in stations if (s["dep"] == d or (d == "2B" and s["dep"] in ("2A", "2B"))) and cle in norm(s["nom"]) and s["A"]]
    if nom in MANUEL:
        # Nom abrégé ou série trop courte chez Météo-France : rattachement à la main, la valeur officielle reste
        num, info = MANUEL[nom]
        s = next((x for x in stations if x["num"] == num), None)
        if s is None:
            s = {"num": num, "dep": d, "A": None, "B": None, **info}
            stations.append(s)
        s["cat"] = (he, hr)
        lignes.append(f"  {d} {nom:22s} catalogue {he:4d} {hr:4d}   rattachée à {s['nom']} ({num})" + (f", calculé {s['A'][1]:.1f} {s['A'][2]:.1f}" if s["A"] else ""))
        if s["A"]: ecarts.append((s["A"][1] - he, s["A"][2] - hr))
        continue
    if not cands:
        lignes.append(f"  {d} {nom:22s} catalogue {he:4d} {hr:4d}   pas de station Météo-France sur 1951-1997"); continue
    s = max(cands, key=lambda x: x["A"][0])
    s["cat"] = (he, hr)
    n, he2, hr2 = s["A"]
    ecarts.append((he2 - he, hr2 - hr))
    lignes.append(f"  {d} {nom:22s} catalogue {he:4d} {hr:4d}   calculé {he2:6.1f} {hr2:6.1f}  ({s['nom']}, {n} hivers)")
print("\n".join(lignes))
import statistics as st
dhe = [abs(a) for a, b in ecarts]; dhr = [abs(b) for a, b in ecarts]
print(f"\n{len(ecarts)} stations comparées. Écart absolu HE : médiane {st.median(dhe):.1f}, moyenne {st.mean(dhe):.1f}, max {max(dhe):.1f}."
      f" HRNE : médiane {st.median(dhr):.1f}, moyenne {st.mean(dhr):.1f}, max {max(dhr):.1f}.")
print("à 10 près :", sum(1 for a, b in ecarts if abs(a) <= 10 and abs(b) <= 10), "sur", len(ecarts))

# Tableau compact : [num, nom, dep, lat, lon, alt, nA, HEA, HRA, nB, HEB, HRB]
def v(x, k): return x[k] if x else None
compact = []
for s in sorted(stations, key=lambda x: (x["dep"].replace("2A", "20.1").replace("2B", "20.2").zfill(5), x["nom"])):
    a, b = s["A"], s["B"]
    compact.append([s["num"], joli(s["nom"]), s["dep"], round(s["lat"], 3), round(s["lon"], 3), int(round(s["alt"])),
                    a[0] if a else 0, round(a[1]) if a else None, round(a[2]) if a else None,
                    b[0] if b else 0, round(b[1]) if b else None, round(b[2]) if b else None] + (list(s["cat"]) if s.get("cat") else []))
txt = json.dumps(compact, ensure_ascii=False, separators=(",", ":"))
open(os.path.join(SCRATCH, "stations_mf.json"), "w", encoding="utf-8").write(txt)
print("taille du tableau :", len(txt.encode("utf-8")) // 1024, "ko")

if PAGE:
    page = open(PAGE, encoding="utf-8").read()
    debut, suite = "const STATIONS_MF = [" + chr(10), chr(10) + "];" + chr(10) + "const DEPARTEMENTS_FR"
    i = page.index(debut) + len(debut)
    j = page.index(suite, i)
    lignes = ("," + chr(10)).join("  " + json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in compact)
    open(PAGE, "w", encoding="utf-8", newline="").write(page[:i] + lignes + page[j:])
    print("tableau remplacé dans", PAGE)
