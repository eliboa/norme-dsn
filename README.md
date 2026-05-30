# Norme DSN

Application web 100% frontend permettant d'explorer la norme DSN (NEODeS).

J’ai créé ce projet pour rendre le cahier technique de la DSN plus accessible, la version officielle au format PDF n’étant pas des plus lisibles.

L'ensemble des données consultables sont celles qui sont publiées par le GIP Net-Entreprises.

## Utilisation

https://eliboa.github.io/norme-dsn/

## Avertissement

Ce projet est purement éducatif et n'est, en aucune manière, lié aux travaux du GIP MDS (Net-Entreprises) ou de la MIDS (Mission interministérielle chargée du pilotage du système de collecte et d’utilisation des données sociales).

## Principe

- S'appuie sur les librairies client : Bootstrap, jQuery, jQuery UI, Bootstrap-treeview, Bootstrap-icons, SheetsJS.
- Les données sont directement lues depuis les fichiers Excels fournis par le GIP MDS (Net-Entreprises).
- Permet une représentation du contenu de la DSN sous forme d'arbre de noeuds (Blocs parents et enfants).
- Les usages des blocs et rubriques (obligatoire, conditionnel, facultatif, etc.) par type de DSN (mensuelle, FCTU, etc.) sont directement affichés dans la vue de chaque bloc ou rubrique.
- La navigation entre les blocs et rubriques est facile et rapide.
- Facilement utilisable en local (serverless).

### Limitations

- Ne se substitue pas au cahier technique officiel de la DSN qui contient d'amples informations sur la façon de renseigner la DSN. Il s'agit ici uniquement de la structure de la DSN.
- Le design du site n'est pas adapté pour une utilisation sur mobile. Il est conçu pour une utilisation professionnelle depuis un Desktop.
