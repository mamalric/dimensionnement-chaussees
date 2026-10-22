// Vérification du moteur de calcul, sans navigateur : node verifier-moteur.js
// Les scripts "moteur" et "donnees" et le script de calcul sont extraits de index.html et exécutés tels quels,
// si bien que c'est bien le code publié qui est contrôlé.
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const scripts = [...html.matchAll(/<script(?: id="([^"]*)")?>([\s\S]*?)<\/script>/g)];
const bloc = id => scripts.find(s => s[1] === id)[2];
const calcul = bloc("calcul");
const ctx = { console, Math, JSON, Object, Array, Number, String, Set, Map, Infinity, NaN, isFinite, parseFloat, Float64Array, Error };
vm.createContext(ctx);
vm.runInContext([bloc("moteur"), bloc("donnees"), calcul].join("\n").replace(/"use strict";/g, "")
  + "\nthis.api = { burmister, calculer, optimiser, admissible, fractile, MAT, trafic };", ctx);
const { burmister, calculer, optimiser, fractile } = ctx.api;

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

// 6. Fractile de la loi normale
{
  console.log("\n6. Fractile u du risque");
  verifier("u(5 %)", fractile(0.05), -1.644854, 1e-6);
  verifier("u(25 %)", fractile(0.25), -0.674490, 1e-6);
  verifier("u(1 %)", fractile(0.01), -2.326348, 1e-6);
}

console.log(`\n${controles - echecs}/${controles} contrôles conformes${echecs ? `, ${echecs} en échec` : ""}.`);
process.exitCode = echecs ? 1 : 0;
