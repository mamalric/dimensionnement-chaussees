// Vérification du moteur de calcul, sans navigateur : node verifier-moteur.js
// Les scripts de calcul ("moteur", "donnees", "calcul", "gel", "alize") sont extraits de index.html et exécutés tels quels,
// si bien que c'est bien le code publié qui est contrôlé.
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const scripts = [...html.matchAll(/<script(?: id="([^"]*)")?>([\s\S]*?)<\/script>/g)];
const bloc = id => scripts.find(s => s[1] === id)[2];
const calcul = bloc("calcul");
const ctx = { console, Math, JSON, Object, Array, Number, String, Set, Map, Infinity, NaN, isFinite, parseFloat, Float64Array, Error, TextDecoder, DataView, Uint8Array, ArrayBuffer };
vm.createContext(ctx);
vm.runInContext([bloc("moteur"), bloc("donnees"), calcul, bloc("gel"), bloc("alize")].join("\n").replace(/"use strict";/g, "")
  + "\nthis.api = { burmister, calculer, fractile, preparer, quantitesGel, apportMecanique, propagationGel, THERMIQUE, STATIONS_MF, lireAlize, etatDepuisAlize };", ctx);
const { burmister, calculer, fractile, preparer, quantitesGel, apportMecanique, propagationGel, THERMIQUE, STATIONS_MF, lireAlize, etatDepuisAlize } = ctx.api;

let echecs = 0, controles = 0;
function verifier(nom, obtenu, attendu, tolRel, tolAbs = 0) {
  controles++;
  const ecart = Math.abs(obtenu - attendu), ok = ecart <= Math.max(tolRel * Math.abs(attendu), tolAbs);
  if (!ok) echecs++;
  console.log(`${ok ? "ok    " : "ÉCHEC "} ${nom} : ${+obtenu.toPrecision(6)} (attendu ${+attendu.toPrecision(6)})`);
}

// 1. Demi-espace de Boussinesq sous une charge circulaire uniforme, sur l'axe
{
  console.log("\n1. Boussinesq, demi-espace homogène");
  const q = 0.662, a = 0.125, E = 100, nu = 0.35;
  const zs = [0.05, 0.2, 0.6];
  const res = burmister([{ E, nu, h: 0 }], [], { q, a }, zs.map(z => ({ z, couche: 0 })), [0]);
  zs.forEach((z, i) => {
    const R = Math.hypot(a, z), r = res[i][0];
    const sz = -q * (1 - z ** 3 / R ** 3);
    const sr = -(q / 2) * ((1 + 2 * nu) - 2 * (1 + nu) * z / R + z ** 3 / R ** 3);
    const w = (1 + nu) * q * a / E * (a / R + (1 - 2 * nu) / a * (R - z));
    verifier(`σz à ${z} m`, r.sz, sz, 1e-5);
    verifier(`σr à ${z} m`, r.sr, sr, 1e-5, 1e-7);
    verifier(`εz à ${z} m`, r.ez, (sz - 2 * nu * sr) / E, 1e-5);
    verifier(`w à ${z} m`, r.w, w, 1e-4);
  });
  const w0 = burmister([{ E, nu, h: 0 }], [], { q, a }, [{ z: 0, couche: 0 }], [0])[0][0].w;
  verifier("déflexion en surface 2qa(1-ν²)/E", w0, 2 * q * a * (1 - nu ** 2) / E, 2e-3);
}

// 2. Le même massif découpé en couches collées identiques redonne Boussinesq, hors axe compris
{
  console.log("\n2. Massif découpé en quatre couches identiques collées");
  const E = 100, nu = 0.35, ch = { q: 0.662, a: 0.125 };
  const plein = burmister([{ E, nu, h: 0 }], [], ch, [{ z: 0.2, couche: 0 }], [0, 0.3]);
  const coupe = burmister([{ E, nu, h: 0.04 }, { E, nu, h: 0.1 }, { E, nu, h: 0.3 }, { E, nu, h: 0 }], ["collee", "collee", "collee"], ch, [{ z: 0.2, couche: 2 }], [0, 0.3]);
  for (const k of ["sz", "sr", "st", "ez", "er", "et"]) for (const ir of [0, 1])
    verifier(`${k} à r = ${[0, 0.3][ir]} m`, coupe[0][ir][k], plein[0][ir][k], 1e-6, 1e-12);
}

// 3. Conditions d'interface entre couches contrastées
{
  console.log("\n3. Continuités aux interfaces collées et glissantes");
  const c = [{ E: 5400, nu: 0.35, h: 0.06 }, { E: 9300, nu: 0.35, h: 0.12 }, { E: 23000, nu: 0.25, h: 0.2 }, { E: 50, nu: 0.35, h: 0 }];
  const prof = [[0.06, 0], [0.06, 1], [0.18, 1], [0.18, 2], [0.38, 2], [0.38, 3]].map(([z, couche]) => ({ z, couche }));
  const col = burmister(c, ["collee", "collee", "collee"], { q: 0.662, a: 0.125 }, prof, [0, 0.1875]);
  for (let k = 0; k < 6; k += 2) for (const ir of [0, 1]) {
    verifier(`collée, z = ${prof[k].z} m, r = ${[0, 0.1875][ir]} : εr continue`, col[k][ir].er, col[k + 1][ir].er, 1e-6, 1e-12);
    verifier(`collée, z = ${prof[k].z} m, r = ${[0, 0.1875][ir]} : w continue`, col[k][ir].w, col[k + 1][ir].w, 1e-6);
  }
  const gl = burmister(c, ["collee", "glissante", "collee"], { q: 0.662, a: 0.125 }, prof, [0]);
  verifier("glissante : w continue", gl[2][0].w, gl[3][0].w, 1e-6);
  verifier("glissante : σz continue", gl[2][0].sz, gl[3][0].sz, 1e-6);
  controles++;
  const saut = Math.abs(gl[2][0].er - gl[3][0].er) > 1e-6;
  if (!saut) echecs++;
  console.log(`${saut ? "ok    " : "ÉCHEC "} glissante : εr discontinue (${(gl[2][0].er * 1e6).toFixed(1)} et ${(gl[3][0].er * 1e6).toFixed(1)} µdef)`);
}

// 4. Sorties publiées d'Alizé-LCPC (manuel 1.5, documentation Alizé2, tutoriel de l'Université de Nantes)
//    et du guide technique de 1994, sous le jumelage de référence. Alizé affiche l'extension en négatif ;
//    ici elle est positive. Dans Alizé2, X est le sens de circulation (εL ici), Y le transversal (εT).
{
  console.log("\n4. Sorties publiées d'Alizé et du guide de 1994");
  const ch = { q: 0.662, a: 0.125 }, d = 0.375, C = (E, nu, h) => ({ E, nu, h });
  // R : sous une roue (r = 0 et r = d), J : au milieu du jumelage (deux fois r = d/2)
  const jum = (couches, itf, prof) => burmister(couches, itf, ch, prof.map(([z, couche]) => ({ z, couche })), [0, d / 2, d])
    .map(x => { const R = {}, J = {}; for (const k in x[0]) { R[k] = x[0][k] + x[2][k]; J[k] = 2 * x[1][k]; } return { R, J }; });
  const cas = [
    ["V-A Alizé2, BBSG 8 / GB3 13 / GB3 13 / PF2", [C(7000, .35, .08), C(9000, .35, .13), C(9000, .35, .13), C(50, .35, 0)], ["collee", "collee", "collee"],
      [[.34, 2, "J", "et", 58.5e-6], [.34, 3, "J", "ez", -202.5e-6], [.21, 1, "R", "et", 17.3e-6]]],
    ["V-B Alizé2, BBTM 2,5 / EME2 25 / PF2qs", [C(3000, .35, .025), C(14000, .35, .25), C(80, .35, 0)], ["collee", "collee"],
      [[.275, 1, "J", "et", 54.8e-6], [.275, 2, "J", "ez", -192.1e-6]]],
    ["V-C Alizé2, BBTM 2,5 / EME 20 / 80 MPa", [C(3000, .35, .025), C(15000, .35, .20), C(80, .35, 0)], ["collee", "collee"],
      [[.225, 1, "J", "et", 71.5e-6], [.225, 2, "R", "ez", -258.8e-6]]],
    ["V-D Alizé2, BBSG 8 glissant / GB3 24 / PF3", [C(7000, .35, .08), C(9000, .35, .24), C(120, .35, 0)], ["glissante", "collee"],
      [[.08, 0, "R", "et", 77.3e-6], [.32, 1, "J", "et", 77.0e-6], [.32, 2, "J", "ez", -239.6e-6]]],
    ["V-E Alizé2, BBSG 6 / GNT 22 à 400 / PF2", [C(7000, .35, .06), C(400, .35, .22), C(50, .35, 0)], ["collee", "collee"],
      [[.06, 0, "R", "et", 234.5e-6], [.06, 1, "R", "ez", -775.3e-6], [.28, 1, "J", "et", 549.3e-6], [.28, 2, "J", "ez", -1232.5e-6]]],
    ["V-F Alizé2, BBSG 6 / GNT 25 à 200 / PF2", [C(7000, .35, .06), C(200, .35, .25), C(50, .35, 0)], ["collee", "collee"],
      [[.06, 0, "R", "et", 348.4e-6], [.06, 1, "R", "ez", -1211.3e-6], [.31, 2, "J", "ez", -1434.9e-6]]],
    ["V-H Alizé 1.5, béton glissant sur béton maigre", [C(5400, .35, .04), C(35000, .25, .19), C(20000, .25, .18), C(150, .35, .35), C(50, .35, 0)], ["collee", "glissante", "collee", "collee"],
      [[.23, 1, "J", "st", 1.342], [.41, 2, "J", "st", 0.646], [.76, 4, "J", "ez", -148.4e-6], [0, 0, "J", "w", 36.2e-5]]],
    ["V-I Alizé 1.5, 6 / 15 / 25 à 240 / 80 MPa", [C(7000, .35, .06), C(9000, .35, .15), C(240, .35, .25), C(80, .35, 0)], ["collee", "collee", "collee"],
      [[.21, 1, "J", "et", 95.6e-6], [.21, 2, "R", "ez", -218.0e-6], [.46, 3, "J", "ez", -304.8e-6], [0, 0, "J", "w", 40.7e-5]]],
    ["V-K guide 1994, BB 8 / GC 20 glissant / GC 20 / PF2", [C(5400, .35, .08), C(23000, .25, .20), C(23000, .25, .20), C(50, .35, 0)], ["collee", "glissante", "collee"],
      [[.28, 1, "J", "st", 0.90], [.48, 2, "J", "st", 0.74], [.48, 3, "J", "ez", -136e-6]]]
  ];
  for (const [nom, couches, itf, attendus] of cas) {
    const r = jum(couches, itf, attendus.map(([z, c]) => [z, c]));
    attendus.forEach(([z, c, pos, k, att], i) => {
      const cle = { et: "et", eT: "er", ez: "ez", st: "st", w: "w" }[k] || k;
      // Les valeurs du guide de 1994 sont arrondies à deux chiffres : tolérance de 1 %
      verifier(`${nom}, z = ${z} m, ${k} en ${pos}`, r[i][pos][cle], att, nom.includes("1994") ? 0.01 : 0.001);
    });
  }
  // Guide de 1994, grave-bitume sur PF3 : εt à la base de la GB et εz du sol, arrondis à l'unité
  for (const [h, et, ez] of [[.17, 89, 284], [.18, 84, 265], [.19, 79, 248]]) {
    const r = jum([C(5400, .35, .06), C(9300, .35, h), C(120, .35, 0)], ["collee", "collee"], [[.06 + h, 1], [.06 + h, 2]]);
    verifier(`guide 1994, BB 6 / GB ${h * 100} / PF3 : εt`, r[0].J.et * 1e6, et, 0.01);
    verifier(`guide 1994, BB 6 / GB ${h * 100} / PF3 : εz`, -r[1].J.ez * 1e6, ez, 0.015);
  }
}

// 5. Valeurs admissibles et règles de la méthode, par le calcul complet de la page
{
  console.log("\n5. Valeurs admissibles et règles de la méthode");
  const etat = (couches, pf, ne, risqueMB, risqueMTLH) => ({
    trafic: { direct: true, voie: "rase", mja: null, p: 20, tau: 0, loi: "geo", ne, cam: { bitumineux: null, hydraulique: null, sol: null } },
    hyp: { risqueMB, risqueMTLH, theta: 15, charge: "jumelage", q: 0.662, a: 0.125, d: 0.375, coefA: "auto" },
    couches: couches.map(([mat, h, itf, E]) => ({ mat, h, E: E ?? null, nu: null, itf: itf || "collee", p: {} })),
    pf: { classe: "perso", E: pf, nu: 0.35 }
  });
  const crit = (R, nomCouche) => R.criteres.find(c => (c.u ? c.u.m.id : "sol") === nomCouche && (c.u ? true : true));
  // Alizé2 : GB3 en couche 2, NE = 4 774 200, risque 30 %, Sh sur 26 cm d'assise, ks = 1/1,1 : 81,355 µdef
  let R = calculer(etat([["BBSG2", 8], ["GB3", 13], ["GB3", 13]], 50, 4774200, 30, null));
  verifier("Alizé2 V-A, εt,adm de la GB3", R.criteres[1].adm.valeur, 81.355, 0.001);
  verifier("Alizé2 V-A, εt calculé à la base de la GB3 inférieure", R.criteres[2].calc, 58.5, 0.002);
  // Alizé2 : EME2 de 25 cm sur PF2qs, NE = 14 215 055, risque 2 %, ks = 1/1,065 : 56,5 µdef
  R = calculer(etat([["BBTM", 2.5], ["EME2", 25]], 80, 14215055, 2, null));
  verifier("Alizé2 V-B, εt,adm de l'EME2", crit(R, "EME2").adm.valeur, 56.5, 0.001);
  verifier("Alizé2 V-B, εz de la plate-forme", crit(R, "sol").calc, 192.1, 0.001);
  // Alizé2 : plate-forme sous BBSG / GNT, NE = 99 371, A = 16 000 µdef : 1243,736 µdef
  R = calculer(etat([["BBSG2", 6], ["GNT2", 22, "collee", 400]], 50, 99371, null, null));
  verifier("Alizé2 V-E, εz,adm de la plate-forme", crit(R, "sol").adm.valeur, 1243.736, 0.0002);
  verifier("Alizé2 V-E, εz de la plate-forme", crit(R, "sol").calc, 1232.5, 0.001);
  // Manuel Alizé 1.5 : GC T4 sur PF2, NE = 1,5609e7, risque 2,5 %, kd 1/1,25, kc 1,4, ks 1/1,1 : 0,679 MPa
  R = calculer(etat([["GCT4", 25]], 50, 1.5609e7, null, 2.5));
  verifier("Alizé 1.5, σt,adm de la GC T4", crit(R, "GCT4").adm.valeur, 0.679, 0.001);
  // Guide de 1994 : GNT de base 15 cm (600) sur fondation de GNT cat. 2 sur PF1, tranches de 25 cm
  // depuis la plate-forme (50, 125, puis 312,5) : εz du sol 1270 µdef pour 52 cm, 1190 pour 54 cm
  for (const [hf, att] of [[52, 1270], [54, 1190]]) {
    R = calculer(etat([["GNT1", 15], ["GNT2", hf]], 20, 50000, null, null));
    verifier(`guide 1994, fondation GNT de ${hf} cm : εz du sol`, crit(R, "sol").calc, att, 0.005);
  }
}

// 6. Gel-dégel : quantités de gel, apport mécanique, calcul thermique (NF P98-086 annexe H)
//    Références : guide de 1994 (exemple VI.5.3), manuel Alizé-LCPC 1.5 (figures 9.7 et 10.8),
//    note de l'Université Gustave Eiffel sur la vérification au gel par Alizé-LCPC (2023), Alizé 2.
{
  console.log("\n6. Gel-dégel");
  let q = quantitesGel({ sol: "SGpSGt", pSGp: 0.38, pSGt: 0.95, hp: 15, hn: 28, an: "BC" });
  verifier("Alizé 1.5 (fig. 10.8), Qg sur SGp de 15 cm et SGt", q.qg, 2.24, 0.003);
  verifier("Alizé 1.5 (fig. 10.8), Qng de 28 cm de sols B ou C", q.qng, 2.68, 0.003);
  q = quantitesGel({ sol: "SGt", pSGt: 0.4, hn: 30, an: "CVSCSL" });
  verifier("Alizé 1.5 (fig. 9.7), Qg pour p = 0,4", q.qg, 2.5, 1e-9);
  verifier("Alizé 1.5 (fig. 9.7), Qng de 30 cm de cendres volantes", q.qng, 3.83, 0.002);
  q = quantitesGel({ sol: "SGp", pSGp: 0.3, hn: 50, an: "D" });
  verifier("guide 1994, Qg pour p = 0,3", q.qg, 3.33, 0.002);
  verifier("guide 1994, Qng de 50 cm de D21", q.qng, 5.0, 1e-9);
  const gel = { sol: "SGp", pSGp: 0.3, hn: 50, an: "D", qm: true };
  const etatGel = (couches, pf) => ({
    trafic: { direct: true, voie: "rase", mja: null, p: 20, tau: 0, loi: "geo", ne: 1e6, cam: { bitumineux: null, hydraulique: null, sol: null } },
    hyp: { risqueMB: null, risqueMTLH: null, theta: 15, charge: "jumelage", q: 0.662, a: 0.125, d: 0.375, coefA: "auto" },
    couches: couches.map(([mat, h]) => ({ mat, h, E: null, nu: null, itf: "collee", p: {} })), pf: { classe: "perso", E: pf, nu: 0.35 }, gel
  });
  // Alizé 2, cas 1 (fiche 26 du catalogue) : couche dégelée de 2,1 cm sous BBSG 8 / GB3 13 / GNT 20 sur PF3
  const E1 = etatGel([["BBSG2", 8], ["GB3", 13], ["GNT1", 20]], 120);
  const m = apportMecanique(E1, preparer(E1));
  verifier("Alizé 2 cas 1, QM (couche dégelée e / 10)", m.qm, 0.21, 0.03);
  // Calcul thermique : séries publiées d'Alizé 2 (front de gel, température et quantité de gel à la plate-forme)
  const TH = THERMIQUE, c = (k, h) => ({ h, ...TH[k] });
  const indice = (r) => r.IsAdmissible / 0.7 + 10;
  let r = propagationGel([c("bb", 0.08), c("gb", 0.13), c("gnt", 0.20)], TH.solA, { qpf: 8.54, dz: 0.01 });
  verifier("Alizé 2 cas 1, IA pour QPF = 8,54", indice(r), 356.0, 0.003);
  for (const [j, front, tpf, qq] of [[20, 0.561, -1.398, 3.532], [40, 0.706, -2.180, 7.016], [60, 0.823, -2.598, 9.866]]) {
    const p = r.serie.reduce((x, y) => Math.abs(y.j - j) < Math.abs(x.j - j) ? y : x);
    verifier(`Alizé 2 cas 1, jour ${j} : front de gel`, p.front, front, 0, 0.01);
    verifier(`Alizé 2 cas 1, jour ${j} : température de la plate-forme`, p.Tpf, tpf, 0, 0.03);
    verifier(`Alizé 2 cas 1, jour ${j} : quantité de gel à la plate-forme`, p.Qpf, qq, 0, 0.03);
  }
  r = propagationGel([c("bb", 0.04), c("gb", 0.08)], TH.solA, { qpf: 2.5, dz: 0.01 });
  verifier("Alizé 2 cas 2, IA pour QPF = 2,5", indice(r), 37.8, 0.006);
  r = propagationGel([c("bb", 0.07), c("gb", 0.11), c("gc", 0.18), c("gnt", 0.35)], TH.solA, { qpf: 5.37, dz: 0.01 });
  verifier("Alizé 1.5 (fig. 10.8), IA pour QPF = 5,37 (Alizé 2 donne environ 1 % de plus)", indice(r), 377.2, 0.03);
  r = propagationGel([c("bb", 0.06), c("gb", 0.26)], { rho: 1330, w: 32, lng: 1.1, lg: 1.8 }, { qpf: 8.7, dz: 0.01 });
  verifier("guide 1994 (GEL1D, lu sur la figure VI.5.8), IA pour QPF = 8,7", indice(r), 298, 0.02);
}

// 7. Indices de gel des stations Météo-France embarqués : calcul sur 1951-1997 comparé au catalogue de 1998
{
  console.log("\n7. Indices de gel des stations (calcul 1951-1997 contre catalogue de 1998)");
  const avecCat = STATIONS_MF.filter(r => r[12] != null && r[6]);
  const ecarts = avecCat.map(r => [Math.abs(r[7] - r[12]), Math.abs(r[8] - r[13])]);
  const mediane = v => { const t = [...v].sort((a, b) => a - b); return t[Math.floor(t.length / 2)]; };
  verifier("stations du catalogue retrouvées dans les données Météo-France", avecCat.length, 83, 0, 10);
  verifier("écart médian sur l'hiver exceptionnel (°C·jour)", mediane(ecarts.map(e => e[0])), 0, 0, 10);
  verifier("écart médian sur l'hiver rigoureux non exceptionnel (°C·jour)", mediane(ecarts.map(e => e[1])), 0, 0, 10);
  const dijon = STATIONS_MF.find(r => r[0] === "21473001");
  verifier("Dijon-Longvic, hiver exceptionnel calculé (catalogue 200)", dijon[7], 200, 0, 5);
  verifier("Dijon-Longvic, hiver rigoureux non exceptionnel calculé (catalogue 130)", dijon[8], 130, 0, 5);
}

// 8. Fractile de la loi normale
{
  console.log("\n8. Fractile u du risque");
  verifier("u(5 %)", fractile(0.05), -1.644854, 1e-6);
  verifier("u(25 %)", fractile(0.25), -0.674490, 1e-6);
  verifier("u(1 %)", fractile(0.01), -2.326348, 1e-6);
}

// 9. Projet Alizé2 (.zmsp) : lecture, reprise des données et recalcul. Le projet de test a la forme d'un fichier
//    enregistré par Alizé2 2.1.3 (BBME3 6 / GB3 8 / GLp T2 35 glissante / PF2, MJA 20, 1 % arithmétique, Ambérieu).
{
  console.log("\n9. Projet Alizé2 (.zmsp)");
  // Flux Qt : chaque chaîne précédée de sa longueur en octets, en UTF-16 gros-boutiste ; clés suivies d'un saut de ligne
  const chaines = ["Alize2\n", "Version 2.1.3\n"];
  const cle = (k, v) => { chaines.push(k + "\n"); if (v !== undefined) chaines.push(v); };
  const champs = o => Object.entries(o).forEach(([k, v]) => cle(k, v));
  const couche = (h, E, nu, mat, type, itf, assise) => {
    champs({ EpaisseurStructure: h, ModuleStructure: E, NuStructure: nu, BibNameStructure: "NFP98-086 2019", MateriauStructure: mat, MatTypeStructure: type,
      TempStructure: "15", FreqStructure: "10", InterfStructure: itf, AssiseLayer: assise });
    cle("EndStructure");
  };
  const va = (crit, o) => { champs({ VACritere: crit, VACAM: "0", VAR: "0", VANE: "0", ...o, VACalcAutoNE: "1" }); cle("EndVA"); };
  champs({ NameProject: "Projet de test", NameAuthor: "", DescriptiveProject: "Chaussée de test" });
  cle("Mech"); champs({ TitreStructure: "", NbCoucheStructure: "4" });
  couche("0.06", "11000", "0.35", "eb-bbme3", "bitum", "1", "0");
  couche("0.08", "9000", "0.35", "eb-gb3", "bitum", "1", "1");
  couche("0.35", "15000", "0.25", "glp-t2", "trait", "0", "2");
  couche("40", "50", "0.35", "pf2", "gntSo", "3", "0");
  champs({ AssiseStructure: "1\t2\t0.43", OptionCharge: "0", TraficMJA: "20", TraficAccGeom: "0.00944287", TraficAccArit: "0.01", TraficService: "20",
    TraficPl: "159870", TraficConfigAccGeom: "0", TraficConfigAccArit: "1", TraficConfigPl: "0", ShAutomatique: "1", VABegin: "4" });
  va("1", { VAEpsi6: "100", VAMUnB: "5", VAEDD: "14630", VAETF: "11000", VAHS: "0.43", VASh: "0.025", VASn: "0.25", VAKr: "0.676541", VAKc: "1.1" });
  va("1", { VAEpsi6: "90", VAMUnB: "5", VAEDD: "11880", VAETF: "9000", VAHS: "0.43", VASh: "0.025", VASn: "0.3", VAKr: "0.649462", VAKc: "1.3" });
  va("2", { VASigma6: "0.6", VAMUnB: "12", VASh: "0.03", VASn: "1", VAKr: "0.566961", VAKc: "1.5", VAKd: "1.0000000000000000e+00" });
  va("3", { VAMUnB: "4.5045", VAA: "16000" });
  cle("Frost"); champs({ TitreStructure: "", IndexLayerZpfStructure: "2", HnQpf: "-1", AnQpf: "14", pSGtQpf: "-1", pSGpQpf: "-1",
    MeteoIRVal: "270", MeteoIRType: "0", MeteoStationName: "Ambérieu" });
  const brut = Buffer.concat(chaines.map(t => { const b = Buffer.from(t, "utf16le").swap16(), n = Buffer.alloc(4); n.writeUInt32BE(b.length); return Buffer.concat([n, b]); }));
  const doc = lireAlize(brut.buffer.slice(brut.byteOffset, brut.byteOffset + brut.length));
  verifier("couches mécaniques lues, plate-forme comprise", doc.meca.couches.length, 4, 0);
  verifier("blocs de valeurs admissibles lus", doc.meca.va.length, 4, 0);
  const { etat } = etatDepuisAlize(doc);
  const ids = etat.couches.map(c => c.mat).join(" / ");
  verifier(`matériaux reconnus (${ids})`, ids === "BBME2 / GB3 / GLT2" ? 1 : 0, 1, 0);
  verifier("interface sous la GLp glissante", etat.couches[2].itf === "glissante" ? 1 : 0, 1, 0);
  verifier("plate-forme PF2 à 50 MPa", etat.pf.classe === "PF2" && etat.pf.E === 50 ? 1 : 0, 1, 0);
  verifier("paramètres de matériau à surcharger (aucun)", etat.couches.reduce((s, c) => s + Object.keys(c.p).length + (c.E != null) + (c.nu != null), 0), 0, 0);
  verifier("station du gel : Ambérieu en hiver exceptionnel (270 °C·jour)", etat.gel.station === "mf|01089001" && etat.gel.hiver === "HE" && etat.gel.ir == null ? 1 : 0, 1, 0);
  const E = { ...etat, hyp: { q: 0.662, a: 0.125, d: 0.375, ...etat.hyp } };
  let R = calculer(E);
  verifier("trafic cumulé sur 20 ans à 1 % arithmétique (Alizé : 159 870 PL)", R.TR.N, 159870, 1e-9);
  // Capture d'Alizé2 2.1.3 de la même structure, sous la roue, compression positive
  const roue = (zz, ci) => R.S.find(s => Math.abs(s.z - zz) < 1e-9 && s.couche === ci).roue;
  verifier("Alizé2 2.1.3, σX à la base du BBME (z = 0,06 m)", -roue(0.06, 0).sL, 0.384, 0.003);
  verifier("Alizé2 2.1.3, σX à la base de la GLp (z = 0,49 m)", -roue(0.49, 2).sL, -0.414, 0.003);
  verifier("Alizé2 2.1.3, σY à la base de la GLp", -roue(0.49, 2).sT, -0.368, 0.003);
  // kr enregistrés par Alizé (risque vide, u = -2,40) : même Sh (2,5 cm pour 43 cm d'assise) et même -1/b de la GLp
  E.hyp.risqueMB = E.hyp.risqueMTLH = 0.8197529;
  R = calculer(E);
  const kr = c => +c.adm.facteurs.find(f => f[0] === "kr")[1].replace(",", ".");
  verifier("kr du BBME3 (Alizé : 0,676541)", kr(R.criteres[0]), 0.676541, 0, 6e-5);
  verifier("kr de la GB3 (Alizé : 0,649462)", kr(R.criteres[1]), 0.649462, 0, 6e-5);
  verifier("kr de la GLp T2 (Alizé : 0,566961)", kr(R.criteres[2]), 0.566961, 0, 6e-5);
}

// 10. Surface exacte et cisaillements. En surface, sous la charge, σz vaut exactement -q quelle que soit la
//     structure ; demi-espace : σr = σθ = -(1 + 2ν) q / 2 sous la charge, σr = -σθ = (1 - 2ν) q a² / (2 r²) hors charge.
{
  console.log("\n10. Surface exacte et cisaillements");
  const q = 0.662, a = 0.125, nu = 0.35;
  let r = burmister([{ E: 100, nu, h: 0 }], [], { q, a }, [{ z: 0, couche: 0 }], [0, 0.2]);
  verifier("demi-espace, σz en surface sous la charge", r[0][0].sz, -q, 1e-9);
  verifier("demi-espace, σr en surface sous la charge", r[0][0].sr, -(1 + 2 * nu) * q / 2, 1e-9);
  verifier("demi-espace, σr en surface à 0,2 m", r[0][1].sr, (1 - 2 * nu) * q * a * a / (2 * 0.04), 1e-6);
  verifier("demi-espace, σθ en surface à 0,2 m", r[0][1].st, -(1 - 2 * nu) * q * a * a / (2 * 0.04), 1e-6);
  // Structure A412 (capture d'Alizé2 2.1.3, centre de la roue) : σYZ dû à l'autre roue du jumelage
  const C = [{ E: 11000, nu: .35, h: .06 }, { E: 9000, nu: .35, h: .08 }, { E: 15000, nu: .25, h: .35 }, { E: 50, nu: .35, h: 0 }];
  const P = [[0, 0], [0.06, 0], [0.14, 1], [0.49, 2]].map(([z, couche]) => ({ z, couche }));
  r = burmister(C, ["collee", "collee", "glissante"], { q, a }, P, [0, 0.375]);
  verifier("structure A412, σz en surface sous la roue (pression du pneu)", -(r[0][0].sz + r[0][1].sz), 0.662, 1e-6);
  verifier("Alizé2 2.1.3, σYZ à 0,06 m (base du BBME)", Math.abs(r[1][1].trz), 0.013, 0.03);
  verifier("Alizé2 2.1.3, σYZ à 0,14 m (base de la GB3)", Math.abs(r[2][1].trz), 0.029, 0.03);
  verifier("Alizé2 2.1.3, σYZ à 0,49 m (interface glissante)", Math.abs(r[3][1].trz), 0, 0, 5e-4);
}

console.log(`\n${controles - echecs}/${controles} contrôles conformes${echecs ? `, ${echecs} en échec` : ""}.`);
process.exitCode = echecs ? 1 : 0;
