# Orthophoto hors-ligne Pâtur'GPS

La carte satellite de Pâtur'GPS utilise maintenant en priorité un paquet local d'orthophoto IGN autour d'Ilhet.

## Paramètres

- Centre : Ilhet (65), environ `42.9637, 0.3829`
- Rayon : 10 km
- Zoom hors-ligne : 8 à 16
- Fond : BD ORTHO® IGN
- Emplacement : `public/offline-maps/ign-ortho/{z}/{x}/{y}.jpg`

Le zoom maximal à 16 apporte nettement plus de détail sur les chemins, clôtures et bâtiments, tout en limitant la zone hors-ligne à 10 km autour d’Ilhet. Au-delà du zoom 16, Leaflet agrandit la dernière résolution disponible au lieu de télécharger des niveaux supplémentaires.

## Constituer le paquet IGN

Sur une machine connectée à Internet, avec Node.js 18+ :

```bash
node scripts/download-offline-ortho.mjs
```

Le script télécharge les tuiles depuis le service WMTS de la Géoplateforme IGN et les place directement dans `public/offline-maps/ign-ortho`.

**Important :** le ZIP fourni ici contient l'architecture et le script de génération, mais pas les centaines/milliers de tuiles IGN. Le paquet cartographique doit être généré séparément afin d'éviter un dépôt GitHub inutilement énorme.

Une fois les tuiles ajoutées, elles sont servies par la PWA depuis son propre domaine et peuvent être utilisées sans connexion.
