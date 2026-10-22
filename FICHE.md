---
id: 2026-10-22-dimensionnement-chaussees   # AAAA-MM-JJ-slug, écrit une fois, jamais modifié (même si le dossier bouge)
nom: Dimensionnement des chaussées          # nom affiché
type: outil                                 # application | outil | documentation | travail | affaire
statut: actif                               # idee | actif | pause | termine | abandonne
pitch: Structures de chaussée neuves selon la méthode rationnelle française : calcul de Burmister et vérification à la fatigue.  # une phrase sur une seule ligne, 120 caractères maximum
cree: 2026-10-22                            # AAAA-MM-JJ
maj: 2026-10-22                             # AAAA-MM-JJ, mis à jour par Claude Code en fin de session
tags: [vrd, voirie, chaussee, calcul]       # exemple : [cvc, calcul]
entree: index.html                          # fichier à ouvrir, exemple : index.html
usage: ouvrir index.html dans un navigateur, ou le site en ligne
site: https://mamalric.github.io/dimensionnement-chaussees/
depot: https://github.com/mamalric/dimensionnement-chaussees
perime_si: révision de la NF P98-086 ou du guide technique de dimensionnement des chaussées
---

# Dimensionnement des chaussées

## Objectif
Refaire en interne, pour le pôle VRD de B27, le dimensionnement des chaussées neuves que fait le logiciel Alizé-LCPC : méthode rationnelle française (guide technique LCPC-SETRA 1994, NF P98-086), massif multicouche élastique de Burmister sous le jumelage de 65 kN, vérification à la fatigue des matériaux bitumineux (εt) et hydrauliques (σt) et à l'orniérage du sol et des GNT (εz). Une page HTML autonome publiée sur GitHub Pages et référencée sur le portail Outils B27, groupe VRD.

## État actuel
Version 1 en ligne, en bêta sur le portail. Moteur de Burmister exact en transformée de Hankel (interfaces collées, glissantes, semi-collées) qui retrouve au dixième près les sollicitations publiées d'Alizé-LCPC 1.5 et d'Alizé2, contrôlé par `verifier-moteur.js` (86 contrôles). Bibliothèque de matériaux de la NF P98-086, CAM et risques de l'annexe C selon la classe de trafic, le type de voie (dont urbain) et le type de structure, règle des GNT du guide de 1994, ks, kr, kc, kd et A de la norme. Valeurs admissibles détaillées facteur par facteur, recherche de l'épaisseur minimale d'une couche, profil des sollicitations en profondeur, note de calcul imprimable, enregistrement du calcul en .json. Charte des outils B27, favicon et image d'aperçu du lien. Non traités : gel-dégel, sols traités, giratoires, renforcement.

## Prochaine étape
Faire valider par le collègue VRD sur deux ou trois structures déjà calculées sous Alizé, sollicitations et valeurs admissibles comprises, puis ajuster la bibliothèque de matériaux, les CAM et les risques usuels à ses habitudes.

## Utilisation
En ligne : https://mamalric.github.io/dimensionnement-chaussees/ (GitHub Pages, publié depuis `main`). Hors ligne : ouvrir index.html dans un navigateur, rien d'autre n'est nécessaire. Saisir le trafic (MJA, durée, croissance), les hypothèses (risque, température équivalente, charge), puis la structure couche par couche et la plate-forme ; le verdict et le détail des critères se mettent à jour à chaque saisie. Contrôle du moteur : `node verifier-moteur.js`.
