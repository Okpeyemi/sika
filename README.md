# Sika - Assistante Gouvernementale Béninoise 🇧🇯

**Sika** est un chatbot WhatsApp intelligent conçu pour faciliter l'accès aux documents officiels du gouvernement du Bénin (décrets, lois, comptes rendus du Conseil des Ministres).

Il utilise l'intelligence artificielle **Google Gemini** combinée à la **Recherche Google (Grounding)** pour trouver, synthétiser et fournir des sources officielles en temps réel depuis le site `sgg.gouv.bj`.

## 🚀 Fonctionnalités Clés

*   **🔍 Recherche Officielle Intelligente (Grounding)** : Interroge directement le Secrétariat Général du Gouvernement pour des réponses fiables et à jour.
*   **🧠 Conscience du Contexte** : Sika se souvient de la conversation. Vous pouvez poser des questions de suivi comme *"Et celui de 2023 ?"* sans répéter le contexte.
*   **💬 Conversation Naturelle** : Distingue automatiquement le bavardage social (*"Bonjour"*) des requêtes officielles.
*   **📱 Optimisé pour WhatsApp** :
    *   Formatage automatique (Gras, Liens, Listes).
    *   Gestion des longs messages (découpage automatique pour respecter les limites de l'API WhatsApp).
*   **🎤 Support Audio/Notes Vocales** : Transcrit et répond automatiquement aux notes vocales envoyées par l'utilisateur.
*   **📄 Support PDF** : Capacité native d'extraire le texte des documents PDF si nécessaire.

## 🛠️ Stack Technique

*   **Framework** : [Next.js](https://nextjs.org/) (App Router)
*   **Langage** : TypeScript
*   **AI & Search** : [Google Gemini 2.0 Flash](https://ai.google.dev/) (avec Google Search Grounding)
*   **Messaging** : [Evolution API](https://github.com/EvolutionAPI/evolution-api) (WhatsApp)
*   **PDF Parsing** : `pdf-parse`

## ⚙️ Installation

1.  **Cloner le projet** :
    ```bash
    git clone https://github.com/votre-username/sika.git
    cd sika
    ```

2.  **Installer les dépendances** :
    ```bash
    npm install
    ```

3.  **Configurer les variables d'environnement** :
    Créez un fichier `.env.local` à la racine :
    ```env
    # Evolution API
    EVOLUTION_API_URL=https://votre-evolution-api.com
    EVOLUTION_API_TOKEN=votre_global_api_key
    EVOLUTION_INSTANCE_NAME=SikaBot

    # Gemini
    GEMINI_API_KEY=votre_api_key
    ```
    *Note : `GEMINI_API_KEY` doit avoir l'accès à "Google Search Grounding" activé.*

4.  **Lancer le serveur de développement** :
    ```bash
    npm run dev
    ```

## 🧪 Tests et Vérification

Le projet inclut plusieurs scripts pour tester les composants individuellement :

*   **Tester le Grounding et l'IA** :
    ```bash
    npx tsx scripts/test-grounding.ts
    ```
*   **Tester le formatage WhatsApp** :
    ```bash
    npx tsx scripts/test-format.ts
    ```

## 🌍 Déploiement

1.  Déployez l'application sur **Vercel** (recommandé pour Next.js).
2.  Configurez le Webhook dans votre instance **Evolution API** :
    *   URL: `https://votre-projet.vercel.app/api/whatsapp`
    *   Events: Activez `MESSAGES_UPSERT` (ou équivalent global).

---
*Développé avec ❤️ pour rendre l'information publique plus accessible.*
