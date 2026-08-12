# Élyra — Le Grand Pas

Une aventure mobile pixel-art bienveillante où chaque pas réel fait avancer un avatar à travers un monde vivant, débloque des rencontres et développe un refuge.

- Jeu public : [elyra-grand-pas.vercel.app](https://elyra-grand-pas.vercel.app)
- Version ChatGPT Sites : [elyra-grand-pas.darknigthmare.chatgpt.site](https://elyra-grand-pas.darknigthmare.chatgpt.site)
- Interface pensée pour téléphone, installable via le manifeste PWA
- Voyage animé, carte, journal, quêtes, rencontres et refuge
- Sauvegarde locale et mode démonstration clairement identifié

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
npm test
npm audit --omit=dev
```

Le build principal utilise Next.js pour Vercel. La compatibilité ChatGPT Sites est conservée avec `npm run dev:sites` et `npm run build:sites`.

## Podomètre

La version web propose une simulation honnête et une détection de mouvement limitée au premier plan. Un vrai comptage fiable, y compris écran verrouillé, demande l'application native prévue avec HealthKit/Core Motion sur iOS et Health Connect/Recording API sur Android.

Les totaux de pas et la progression restent locaux dans cette version. Aucune donnée de santé brute n'est envoyée à un serveur.
