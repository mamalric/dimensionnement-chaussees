# Consignes pour Claude Code

Modèle : outil. Ce projet suit la convention commune de `_modele/` : une fiche `FICHE.md`, un journal `JOURNAL.md`, et c'est toi qui les tiens à jour.

## Au début de chaque session
1. Lire `FICHE.md` (fiche d'identité) puis `JOURNAL.md` (historique, dernière entrée en haut).
2. Si des champs de `FICHE.md` sont vides ou valent `AAAA-MM-JJ`, les renseigner : déduire ce qui peut l'être, demander le reste. Pour `id`, proposer une valeur au format `AAAA-MM-JJ-slug` et attendre validation avant de l'écrire.

## En fin de session
1. Ajouter une entrée datée en haut de `JOURNAL.md` : ce qui a été fait, les décisions prises, ce qui reste à faire.
2. Mettre `maj` à jour dans `FICHE.md` avec la date du jour.
3. Si l'état ou la prochaine étape a changé, mettre à jour les sections `État actuel` et `Prochaine étape`. Si le statut a changé, mettre à jour `statut`.

## Règles
- `id` ne se modifie jamais, même si le dossier est renommé, déplacé ou archivé.
- L'en-tête YAML de `FICHE.md` reste simple : une valeur par ligne, listes entre crochets, pas de bloc multi-lignes. Les noms de champs et les valeurs d'énumération restent en ASCII sans accent.
- Pas d'autre fichier de métadonnées (pas de NOTES.md, pas de README parallèle) : tout passe par `FICHE.md` et `JOURNAL.md`.
- Dans les fichiers Markdown, écrire en français accentué. Une phrase ou un paragraphe tient sur une seule ligne, sans retour à la ligne intermédiaire.
- L'outil vit à la racine du dossier, en un ou deux fichiers. Pas de sous-dossier tant que ce n'est pas nécessaire. S'il grossit au point d'en avoir besoin, c'est peut-être devenu une application : le signaler.
