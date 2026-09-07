# Orthophoto hors-ligne Pâtur'GPS

La carte satellite de Pâtur'GPS utilise maintenant en priorité un paquet local d'orthophoto IGN autour d'Ilhet.

## Paramètres

- Centre : Ilhet (65), environ `42.9200, 0.3900`
- Rayon : 30 km
- Zoom hors-ligne : 8 à 13
- Fond : BD ORTHO® IGN
- Emplacement : `public/offline-maps/ign-ortho/{z}/{x}/{y}.jpg`

Le choix du zoom maximal à 13 est volontaire : il limite fortement la taille du paquet tout en conservant un fond utile pour le suivi pastoral. Au-delà, Leaflet agrandit la dernière résolution disponible au lieu de télécharger des niveaux supplémentaires.

## Constituer le paquet IGN

Sur une machine connectée à Internet, avec Node.js 18+ :

```bash
node scripts/download-offline-ortho.mjs
```

Le script télécharge les tuiles depuis le service WMTS de la Géoplateforme IGN et les place directement dans `public/offline-maps/ign-ortho`.

**Important :** le ZIP fourni ici contient l'architecture et le script de génération, mais pas les centaines/milliers de tuiles IGN. Le paquet cartographique doit être généré séparément afin d'éviter un dépôt GitHub inutilement énorme.

Une fois les tuiles ajoutées, elles sont servies par la PWA depuis son propre domaine et peuvent être utilisées sans connexion.
