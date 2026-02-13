# 📘 Documentation Technique - Sika (Consultant IA Gouvernemental)

## 1. 🌟 Vue d'ensemble du Projet

**Sika** est un chatbot WhatsApp intelligent conçu pour faciliter l'accès aux informations et documents officiels du gouvernement du Bénin. Il agit comme un intermédiaire entre les citoyens et les ressources administratives complexes, en utilisant l'IA pour synthétiser, expliquer et retrouver des documents.

Le système utilise **Google Gemini 2.0** avec **Grounding (Google Search)** pour garantir la fiabilité des informations, en se basant prioritairement sur le site officiel `sgg.gouv.bj`.

### ✨ Fonctionnalités Principales
*   **Dialogue Naturel** : Compréhension du contexte et de l'historique de conversation.
*   **Recherche Officielle (Grounding)** : Interrogation en temps réel des bases de données gouvernementales.
*   **Analyse de Documents** : Capacité à lire et extraire des informations depuis des images ou PDF envoyés par l'utilisateur.
*   **Support Multimodal** : Traitement de texte, audio (transcription) et documents.
*   **Réponses Structurées** : Formatage automatique pour WhatsApp (listes, gras, liens).

---

## 2. 🛠️ Architecture Technique

### Stack Technologique

| Composant | Technologie | Description |
| :--- | :--- | :--- |
| **Framework** | **Next.js 16** (App Router) | Structure principale de l'application (API Routes & Server Actions). |
| **Langage** | **TypeScript** | Typage statique pour la robustesse du code. |
| **IA & LLM** | **Google Gemini 2.0 Flash** | Moteur d'intelligence générative. |
| **Grounding** | **Google Search** | Ancrage des réponses dans verité via Recherche Google. |
| **Messaging** | **Evolution API** | Gateway pour l'intégration WhatsApp (basé sur Baileys). |
| **Base de Données** | *Aucune (Stateless)* | L'historique est géré en mémoire ou via Evolution API (selon config). |
| **PDF Parser** | `pdf-parse` | Extraction de texte depuis les fichiers PDF. |

### Structure du Projet

```bash
sika/
├── app/
│   ├── api/
│   │   └── whatsapp/
│   │       └── route.ts       # 🚀 Point d'entrée Webhook (Réception messages)
│   ├── lib/
│   │   ├── evolution.ts       # 📞 Client Evolution API (Envoi messages, médias)
│   │   ├── gemini.ts          # 🧠 Logique IA (Prompts, Grounding, Classification)
│   │   ├── history.ts         # 🗂️ Gestion de l'historique de conversation
│   │   └── scraper.ts         # 🕷️ (Obsolète/Fallback) Scraper manuel
│   ├── globals.css            # Styles globaux (Tailwind)
│   └── layout.tsx             # Layout racine Next.js
├── scripts/                   # 🧪 Scripts de test (Grounding, TTS, etc.)
├── public/                    # Assets statiques
├── .env.local                 # 🔒 Variables d'environnement
├── next.config.ts             # Config Next.js
└── package.json               # Dépendances
```

---

## 3. 🧠 Logique Méthodologique (Flux de Données)

### 1️⃣ Réception du Message (`app/api/whatsapp/route.ts`)
*   Le webhook reçoit une requête `POST` de l'instance Evolution API.
*   **Deduplication** : Vérification de l'ID du message pour éviter les traitements en double.
*   **Extraction** : Récupération du contenu (Texte, Audio transcrit, ou Image/PDF avec légende).

### 2️⃣ Classification de l'Intention (`app/lib/gemini.ts`)
Le message est analysé par un modèle léger pour déterminer l'action :
*   `SEARCH` : Demande d'information officielle ou administrative.
*   `CHAT` : Conversation sociale (bonjour, merci).
*   `ANALYZE` : Si un fichier est joint (Image/PDF).

### 3️⃣ Traitement & Génération
Selon l'intention, différentes branches sont activées :

#### Branche A : `SEARCH` (Grounding)
1.  **Optimisation** : La requête utilisateur est réécrite pour être "Google-searchable" (ex: "Et pour le passeport ?" -> "Pièces à fournir passeport Bénin").
2.  **Generation** : Gemini génère une réponse en utilisant l'outil `googleSearch` configuré sur `sgg.gouv.bj`.
3.  **Validation** : Vérification automatique de l'accessibilité des liens (HEAD request).

#### Branche B : `ANALYZE` (Document)
1.  Le fichier est converti en Base64.
2.  Gemini Vision analyse le document avec un prompt spécifique "Expert Administratif".
3.  Il extrait les dates, noms, et valide la conformité si demandé.

#### Branche C : `CHAT`
*   Réponse conversationnelle simple et polie.

### 4️⃣ Envoi de la Réponse (`app/lib/evolution.ts`)
*   Le texte généré est formaté (Markdown WhatsApp : `*gras*`, `_italique_`).
*   Si le message est long (> 4096 chars), il est découpé en "chunks".
*   Envoi via l'endpoint `/message/sendText` de Evolution API.

---

## 4. ⚙️ Configuration & Installation

### Pré-requis
*   Node.js 18+
*   Instance Evolution API fonctionnelle (connectée à WhatsApp).
*   Clé API Google Gemini (avec accès Search Grounding).

### Variables d'Environnement (`.env.local`)

```env
# --- Evolution API (WhatsApp) ---
EVOLUTION_API_URL=https://api.votre-domaine.com
EVOLUTION_API_TOKEN=votre_api_key_globale
EVOLUTION_INSTANCE_NAME=SikaBot

# --- Google Gemini AI ---
GEMINI_API_KEY=votre_cle_gemini_ai
```

### Commandes Utiles

```bash
# Installation
npm install

# Lancement serveur dev
npm run dev

# Build production
npm run build
npm start

# Tests unitaires (Scripts)
npx tsx scripts/test-grounding.ts  # Tester la recherche IA
```

---

## 5. 🚨 Points d'Attention & Maintenance

1.  **Webhook Timeout** : WhatsApp/Evolution API peut renvoyer une erreur si le webhook met plus de 10s à répondre.
    *   *Solution actuelle* : Le code `await` tout le traitement. Sur Vercel (Serverless), c'est nécessaire. Si déploiement sur VPS, envisager de répondre `200 OK` immédiatement et traiter en arrière-plan.
2.  **Audio/TTS** : La fonctionnalité de réponse audio (Text-to-Speech en Fon) est présente dans le code mais désactivée (`// commented out`) pour l'instant.
3.  **Validation des Liens** : Le système vérifie les liens générés. Si un lien gouvernemental est HS (404), il sera marqué `(⚠ Lien inaccessible)`.

## 6. 📝 Guide de Contribution

*   **Ajouter une fonctionnalité** : Créer un nouveau fichier dans `app/lib/` si la logiue est complexe.
*   **Modifier les Prompts** : Tout se trouve dans `app/lib/gemini.ts`. Attention à ne pas casser le formatage JSON ou Markdown attendu par WhatsApp.
