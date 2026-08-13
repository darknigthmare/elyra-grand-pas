export type UniverseId =
  | "vallee-elyra"
  | "royaumes-couronne"
  | "neo-arcadia"
  | "noctis-hollow"
  | "helios-9"
  | "xibalba-verte"
  | "aetheria";

export type Encounter = {
  id: string;
  universeId: UniverseId;
  at: number;
  icon: string;
  title: string;
  text: string;
  choices: [string, string];
  rewardLeaves: number;
  rewardSparks: number;
};

export type Universe = {
  id: UniverseId;
  order: number;
  name: string;
  genre: string;
  kicker: string;
  chapter: string;
  description: string;
  routeName: string;
  routeGoal: number;
  unlockAt: number;
  image: string;
  weather: string;
  temperature: string;
  accent: string;
  accentSoft: string;
  ink: string;
  overlay: string;
  landmark: string;
  ambient: "leaves" | "runes" | "rain" | "fog" | "stars" | "spores" | "aether";
  milestones: [string, string, string, string];
  questTitle: string;
  questText: string;
  questGoal: number;
  encounters: Encounter[];
};

export const UNIVERSES: Universe[] = [
  {
    id: "vallee-elyra",
    order: 1,
    name: "Vallée d’Élyra",
    genre: "Nature enchantée",
    kicker: "Le monde source",
    chapter: "I · La vallée qui s’éveille",
    description: "Un refuge lumineux où les sentiers réapprennent à respirer au rythme de vos pas.",
    routeName: "Sentier des Lucioles",
    routeGoal: 2400,
    unlockAt: 0,
    image: "/worlds/vallee-elyra.webp",
    weather: "Doux",
    temperature: "18°",
    accent: "#f2b84b",
    accentSoft: "#fff0bd",
    ink: "#153d34",
    overlay: "linear-gradient(180deg, rgba(7,31,26,.02), rgba(8,34,27,.28))",
    landmark: "Le Grand Arbre",
    ambient: "leaves",
    milestones: ["Départ", "Clairière", "Lanterne", "Grand Arbre"],
    questTitle: "Réveiller les lanternes",
    questText: "Rallumez le chemin des voyageurs avant la tombée du soir.",
    questGoal: 2000,
    encounters: [
      { id: "lume", universeId: "vallee-elyra", at: 2000, icon: "✦", title: "Une lueur vous suit…", text: "Un esprit-lanterne s’est posé au bord du sentier et attend un nom.", choices: ["L’appeler Lume", "Lui offrir une feuille"], rewardLeaves: 4, rewardSparks: 1 },
      { id: "milo", universeId: "vallee-elyra", at: 2350, icon: "♫", title: "Le musicien des mousses", text: "Milo cherche une note perdue dans le bruissement des vieux arbres.", choices: ["Suivre la mélodie", "Écouter son histoire"], rewardLeaves: 6, rewardSparks: 1 },
    ],
  },
  {
    id: "royaumes-couronne",
    order: 2,
    name: "Royaumes de la Couronne",
    genre: "Médiéval fantastique",
    kicker: "Les terres du dragon-nuage",
    chapter: "II · Le serment des sept tours",
    description: "Forteresses, moulins et runes anciennes bordent une route vers la citadelle solaire.",
    routeName: "Chaussée des Sept Tours",
    routeGoal: 3600,
    unlockAt: 2400,
    image: "/worlds/royaumes-couronne.webp",
    weather: "Aube dorée",
    temperature: "14°",
    accent: "#efb33d",
    accentSoft: "#fff0ba",
    ink: "#263d58",
    overlay: "linear-gradient(180deg, rgba(25,37,62,.02), rgba(18,36,40,.24))",
    landmark: "Citadelle d’Auréal",
    ambient: "runes",
    milestones: ["Porte basse", "Moulins", "Pont royal", "Citadelle"],
    questTitle: "Le serment du veilleur",
    questText: "Portez le message du village jusqu’aux remparts d’Auréal.",
    questGoal: 2800,
    encounters: [
      { id: "brann", universeId: "royaumes-couronne", at: 800, icon: "⚔", title: "Le chevalier sans bannière", text: "Brann garde seul un pont que personne n’ose plus traverser.", choices: ["Marcher à ses côtés", "Réparer sa bannière"], rewardLeaves: 8, rewardSparks: 1 },
      { id: "wylla", universeId: "royaumes-couronne", at: 2300, icon: "♜", title: "L’œuf sous la tour", text: "Une coquille chaude pulse au pied d’une rune oubliée.", choices: ["Veiller sur l’œuf", "Chercher sa gardienne"], rewardLeaves: 8, rewardSparks: 2 },
    ],
  },
  {
    id: "neo-arcadia",
    order: 3,
    name: "Néo-Arcadia",
    genre: "Cyberpunk",
    kicker: "District des pluies électriques",
    chapter: "III · Les battements de la mégalopole",
    description: "Une ville verticale noyée de néons où chaque foulée réactive un fragment de réseau libre.",
    routeName: "Passerelle K-47",
    routeGoal: 4200,
    unlockAt: 6000,
    image: "/worlds/neo-arcadia.webp",
    weather: "Pluie ionique",
    temperature: "21°",
    accent: "#37e5f3",
    accentSoft: "#c2fbff",
    ink: "#082d3e",
    overlay: "linear-gradient(180deg, rgba(4,12,37,.06), rgba(7,4,31,.38))",
    landmark: "Cœur de Néon",
    ambient: "rain",
    milestones: ["Bloc 12", "Marché haut", "Nœud libre", "Cœur de Néon"],
    questTitle: "Réamorcer le quartier",
    questText: "Transportez une charge propre entre les relais abandonnés.",
    questGoal: 3200,
    encounters: [
      { id: "pixel", universeId: "neo-arcadia", at: 900, icon: "⌁", title: "Le drone qui rêvait", text: "Un drone de maintenance diffuse une mélodie interdite entre deux averses.", choices: ["Libérer sa mémoire", "Le guider au relais"], rewardLeaves: 10, rewardSparks: 2 },
      { id: "nyx", universeId: "neo-arcadia", at: 2700, icon: "⌾", title: "Nyx sur la fréquence morte", text: "Une voix pirate connaît un raccourci, mais le réseau l’écoute aussi.", choices: ["Suivre son signal", "Brouiller vos traces"], rewardLeaves: 9, rewardSparks: 3 },
    ],
  },
  {
    id: "noctis-hollow",
    order: 4,
    name: "Noctis Hollow",
    genre: "Horreur gothique",
    kicker: "La ville qui retient son souffle",
    chapter: "IV · Les cloches sous la brume",
    description: "Un bourg gothique hanté par ses souvenirs, traversé sans combat mais jamais sans courage.",
    routeName: "Rue des Veilleurs",
    routeGoal: 4600,
    unlockAt: 10200,
    image: "/worlds/noctis-hollow.webp",
    weather: "Orage spectral",
    temperature: "7°",
    accent: "#9de7ef",
    accentSoft: "#d9f7f8",
    ink: "#102c3a",
    overlay: "linear-gradient(180deg, rgba(3,12,22,.04), rgba(2,8,16,.52))",
    landmark: "Cathédrale Muette",
    ambient: "fog",
    milestones: ["Grille noire", "Maison penchée", "Cimetière", "Cathédrale"],
    questTitle: "Le dernier carillon",
    questText: "Rassemblez assez de courage pour faire sonner la cloche une dernière fois.",
    questGoal: 3500,
    encounters: [
      { id: "agathe", universeId: "noctis-hollow", at: 1000, icon: "☾", title: "La veilleuse à la fenêtre", text: "Agathe allume chaque soir une lampe pour quelqu’un qui ne revient plus.", choices: ["Porter sa lumière", "Laisser un souvenir"], rewardLeaves: 11, rewardSparks: 2 },
      { id: "corvus", universeId: "noctis-hollow", at: 3000, icon: "♠", title: "Le corbeau aux clefs", text: "Un grand corbeau dépose une clef froide devant vos pas.", choices: ["Ouvrir la crypte", "Suivre le corbeau"], rewardLeaves: 12, rewardSparks: 3 },
    ],
  },
  {
    id: "helios-9",
    order: 5,
    name: "Hélios-9",
    genre: "Science-fiction",
    kicker: "La frontière du ciel violet",
    chapter: "V · Une marche parmi les étoiles",
    description: "Une lune-colonie au bord d’un monde annelé, entre observatoires et secrets cosmiques.",
    routeName: "Promenade Kepler",
    routeGoal: 5200,
    unlockAt: 14800,
    image: "/worlds/helios-9.webp",
    weather: "Aurore orbitale",
    temperature: "-32°",
    accent: "#9d8cff",
    accentSoft: "#e0dbff",
    ink: "#171847",
    overlay: "linear-gradient(180deg, rgba(12,5,48,.02), rgba(8,5,42,.34))",
    landmark: "Observatoire Kepler",
    ambient: "stars",
    milestones: ["Sas Aurore", "Dôme 4", "Ascenseur", "Observatoire"],
    questTitle: "La balise impossible",
    questText: "Recalibrez une balise qui reçoit un signal venu d’avant la colonie.",
    questGoal: 4000,
    encounters: [
      { id: "io", universeId: "helios-9", at: 1200, icon: "◎", title: "I.O. se souvient du soleil", text: "L’ancienne intelligence du dôme vous demande de lui décrire une forêt.", choices: ["Partager un souvenir", "Lui montrer Élyra"], rewardLeaves: 12, rewardSparks: 4 },
      { id: "sagan", universeId: "helios-9", at: 3400, icon: "✧", title: "Le cartographe des anneaux", text: "Sagan affirme qu’une route apparaît seulement lorsqu’on la parcourt.", choices: ["Tracer avec lui", "Observer le signal"], rewardLeaves: 14, rewardSparks: 4 },
    ],
  },
  {
    id: "xibalba-verte",
    order: 6,
    name: "Xibalba Verte",
    genre: "Jungle perdue",
    kicker: "Les temples que la forêt protège",
    chapter: "VI · Le cœur sous les lianes",
    description: "Une cité fictive engloutie par la jungle, dont les mécanismes répondent au rythme humain.",
    routeName: "Voie des Cénotes",
    routeGoal: 5600,
    unlockAt: 20000,
    image: "/worlds/xibalba-verte.webp",
    weather: "Pluie chaude",
    temperature: "29°",
    accent: "#68e7a0",
    accentSoft: "#d0ffe2",
    ink: "#113d30",
    overlay: "linear-gradient(180deg, rgba(4,29,20,.02), rgba(4,24,16,.34))",
    landmark: "Temple du Premier Souffle",
    ambient: "spores",
    milestones: ["Canopée", "Cénote", "Gardiens", "Premier Souffle"],
    questTitle: "Le pouls de pierre",
    questText: "Réveillez sans violence les mécanismes enfouis sous les racines.",
    questGoal: 4300,
    encounters: [
      { id: "tala", universeId: "xibalba-verte", at: 1300, icon: "❈", title: "Tala et la graine de jade", text: "Une exploratrice veille sur une graine qui ne germe qu’au passage des voyageurs.", choices: ["La porter ensemble", "Chercher de l’eau"], rewardLeaves: 16, rewardSparks: 3 },
      { id: "olm", universeId: "xibalba-verte", at: 3700, icon: "◉", title: "Le gardien couvert de mousse", text: "La statue ouvre lentement les yeux, puis imite votre cadence.", choices: ["Marcher à son rythme", "Écouter la pierre"], rewardLeaves: 17, rewardSparks: 4 },
    ],
  },
  {
    id: "aetheria",
    order: 7,
    name: "Ætheria",
    genre: "Onirique céleste",
    kicker: "Au-dessus de tous les horizons",
    chapter: "VII · Là où vont les grands pas",
    description: "Îles suspendues, baleines d’étoiles et ponts de lumière composent l’ultime voyage.",
    routeName: "Ruban de l’Aube",
    routeGoal: 6400,
    unlockAt: 25600,
    image: "/worlds/aetheria.webp",
    weather: "Mer de nuages",
    temperature: "19°",
    accent: "#ffd68f",
    accentSoft: "#fff2d9",
    ink: "#33306f",
    overlay: "linear-gradient(180deg, rgba(39,29,107,.02), rgba(33,25,91,.2))",
    landmark: "Porte de l’Aube",
    ambient: "aether",
    milestones: ["Nuage bas", "Île miroir", "Baleines", "Porte de l’Aube"],
    questTitle: "Le Grand Pas",
    questText: "Reliez les mondes parcourus et ouvrez la Porte de l’Aube.",
    questGoal: 5000,
    encounters: [
      { id: "ael", universeId: "aetheria", at: 1500, icon: "◇", title: "L’enfant des constellations", text: "Aël connaît votre nom, mais affirme ne vous avoir rencontré que demain.", choices: ["Écouter le futur", "Offrir un souvenir"], rewardLeaves: 20, rewardSparks: 5 },
      { id: "orion", universeId: "aetheria", at: 4300, icon: "∞", title: "La baleine au chant d’aube", text: "Son chant relie les traces laissées dans chacun des six autres mondes.", choices: ["Marcher dans son sillage", "Répondre au chant"], rewardLeaves: 24, rewardSparks: 6 },
    ],
  },
];

export const UNIVERSE_BY_ID = Object.fromEntries(
  UNIVERSES.map((universe) => [universe.id, universe]),
) as Record<UniverseId, Universe>;

export const ALL_ENCOUNTERS = UNIVERSES.flatMap((universe) => universe.encounters);
