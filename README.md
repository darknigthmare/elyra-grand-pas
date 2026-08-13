# Élyra — Chroniques du Grand Pas

Élyra est un jeu d’aventure mobile en pixel art où la marche réelle fait avancer un explorateur à travers sept univers vivants. Les pas déplacent le décor, ouvrent des routes, déclenchent des rencontres à choix et développent un refuge interdimensionnel commun à toute la campagne.

- Jeu public : [elyra-grand-pas.vercel.app](https://elyra-grand-pas.vercel.app)
- Version ChatGPT Sites : [elyra-grand-pas.darknigthmare.chatgpt.site](https://elyra-grand-pas.darknigthmare.chatgpt.site)
- Interface responsive pensée pour téléphone et installable comme PWA
- Décors panoramiques animés, parallaxe, particules, cycle de marche et effets de vitesse
- Sept campagnes avec progression indépendante, paliers, quêtes et rencontres narratives
- Atlas des mondes, journal de souvenirs, ressources et refuge interdimensionnel
- Sauvegarde V2 locale avec migration automatique de la première aventure
- Mode découverte clairement identifié pour jouer sans capteur compatible

## Les sept univers

| Univers | Genre | Identité |
| --- | --- | --- |
| Vallée d’Élyra | Nature merveilleuse | Forêts lumineuses et sentiers de lucioles |
| Royaumes de la Couronne | Médiéval fantastique | Cités fortifiées, magie et anciennes routes royales |
| Néo-Arcadia | Cyberpunk | Néons, pluie, mégalopole verticale et réseaux clandestins |
| Noctis Hollow | Horreur gothique | Marais, manoirs, brume et présences inquiétantes |
| Hélios-9 | Science-fiction | Dômes orbitaux, désert extraterrestre et intelligence ancienne |
| Xibalba Verte | Aventure archéologique | Jungle profonde, temples perdus et mécanismes oubliés |
| Ætheria | Rêve céleste | Îles flottantes, mers de nuages et porte de l’aube |

Chaque univers possède son illustration originale, sa palette, sa route, ses paliers, une quête quotidienne et deux rencontres. Les seuils d’ouverture reposent sur le total de pas, tandis que la progression de chaque route reste propre au monde choisi.

## Lancer le projet

Prérequis : Node.js 24.

```bash
npm install
npm run dev
```

Puis ouvrir `http://localhost:3000`.

## Validation

```bash
npm run lint
npm run test:engine
npm test
npm audit --omit=dev
```

`npm test` valide le moteur de progression, produit le build Next.js puis démarre ce build pour contrôler le HTML, le manifeste, la carte sociale et les sept décors WebP. Le build principal cible Vercel. La compatibilité ChatGPT Sites est conservée avec `npm run dev:sites` et `npm run build:sites`.

## Architecture du jeu

- `app/gameData.ts` décrit les univers, quêtes, paliers et rencontres.
- `app/gameEngine.ts` gère la sauvegarde, les pas, les déblocages et les récompenses.
- `app/GrandPasGameV2.tsx` porte les écrans Voyage, Mondes, Journal et Refuge.
- `public/worlds/` contient les sept panoramas optimisés en WebP.
- `tests/game-engine.test.ts` protège les règles de progression et de migration.

## Podomètre et confidentialité

La version web propose une détection de mouvement limitée au premier plan et un mode découverte simulé. Un comptage fiable en arrière-plan ou écran verrouillé demande l’application native prévue avec HealthKit/Core Motion sur iOS et Health Connect/Recording API sur Android.

Les totaux de pas et la progression restent locaux dans cette version. Aucune donnée de santé brute n’est envoyée à un serveur.
