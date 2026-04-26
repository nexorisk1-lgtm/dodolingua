# DodoLingua — Livraison complète

> **Confidentiel — Propriété intellectuelle de Raïssa.**
> Diffusion, reproduction ou exploitation interdites sans autorisation écrite.

DodoLingua : application d'apprentissage des langues complète. Anglais UK + 4 langues prévues. 12 jeux. Coach IA Gemini. Module GRC complet. 0 € de coût récurrent.

---

## Ce que contient le projet

**Apprentissage** :
- Onboarding 6 étapes (langue, niveau, objectifs multi, thèmes, mode+temps, voix)
- Test CECRL adaptatif (option choisie à l'onboarding)
- Moteur FSRS de répétition espacée
- Session entrelacée 4 phases (discovery → pratique → mix quiz → ancrage)
- Méthode mot 6 étapes intégrée

**Jeux (12)** :
- Flashcards, Quiz, Dictée, Reconnaissance audio, Association mot/image
- Sentence builder, Listening cloze, Speaking cloze (micro)
- Memory pairs, Story choice, Phonetic challenge, Speed round

**Gamification** :
- 4 quêtes journalières (Apprentissage / Révision / Pratique / Jeu)
- Système de points + streak intelligent
- 6 ligues hebdomadaires (Bronze → Obsidienne)
- Reset hebdo via cron + promotions automatiques
- Badges et accomplissements

**Coach IA** :
- Gemini Flash 2.0 (free tier 1500 req/jour)
- 7 modes dynamiques selon objectifs (Conversationnel, Hybride, Professeur, Business, Guide, Expert GRC, Culturel)
- Mix automatique multi-modes
- Voix synthèse Web Speech API (UK natif)
- Quota anti-abus 50 msg/user/jour

**Module GRC** :
- 4 niveaux : Junior, Confirmé, Senior, Expert
- Glossaires anglais/français + IPA (extensibles via admin)
- Scénarios métier (audit, comité, régulateur)

**Multi-langues & profil** :
- Architecture par concept (1 concept = N traductions)
- Profil avec gestion langues + ajout
- Préférences modifiables (objectifs, thèmes, mode, voix, IPA)

**Admin** :
- Espace `/admin` (`is_admin = true` requis)
- Gestion concepts, traductions, images
- Upload PNG/JPG/WebP (max 2 MB) ou URL externe
- Stats stockage et content

**Sécurité** :
- Auth Supabase (bcrypt + JWT)
- RLS activée sur toutes tables sensibles
- Headers sécurité (CSP, X-Frame, Permissions-Policy)
- Audit log admin
- 0 carte bancaire enregistrée

---

## Stack & coût

| Service | Usage | Coût |
|---|---|---|
| Vercel Hobby | Hébergement Next.js + Edge | 0 € |
| Supabase Free | Postgres + Auth + Storage 1 GB | 0 € |
| Gemini Flash 2.0 | Coach IA (1500 req/j) | 0 € |
| Web Speech API | TTS + STT navigateur | 0 € |
| **TOTAL** | **0 €/mois** | |

---

## Déploiement (≈ 30 minutes)

### 1. Comptes (gratuits, sans CB)
- https://vercel.com → plan Hobby
- https://supabase.com → plan Free
- https://ai.google.dev → clé API Gemini Flash

### 2. Cloner et installer
```bash
cd "Lot 1 - Foundation"
npm install
```

### 3. Lancer les migrations Supabase
Dans Supabase Studio → SQL Editor, exécute dans l'ordre :
- `supabase/migrations/20260426000001_initial_schema.sql`
- `supabase/migrations/20260426000002_rls_policies.sql`
- `supabase/migrations/20260426000003_seed_data.sql`
- `supabase/migrations/20260427000001_image_support_admin.sql`
- `supabase/migrations/20260427000002_helper_functions.sql`
- `supabase/migrations/20260428000001_grc_seed.sql`

### 4. Variables d'environnement
Crée `.env.local` à la racine :
```env
NEXT_PUBLIC_SUPABASE_URL=https://<ton-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
GEMINI_API_KEY=AIzaSy...
CRON_SECRET=<un-secret-aleatoire-pour-le-reset-hebdo>
```

### 5. Test local
```bash
npm run dev
```
Va sur http://localhost:3000.

### 6. Push GitHub + deploy Vercel
```bash
git init && git add . && git commit -m "Application langues v1.0" && git push
```
Importe le repo sur Vercel, ajoute les mêmes env vars, deploy.

### 7. Activer ton compte admin
Dans Supabase SQL Editor :
```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'nexorisk1@gmail.com');
```

### 8. Cron hebdomadaire ligues (optionnel)
Crée un cron sur https://cron-job.org (gratuit) :
- URL : `https://<ton-app>.vercel.app/api/cron/weekly-reset`
- Méthode : POST
- Header : `x-cron-secret: <ton-secret>`
- Schedule : chaque lundi 00:00

---

## Pages disponibles

| Route | Description |
|---|---|
| `/` | Landing publique |
| `/register`, `/login`, `/forgot-password` | Auth |
| `/onboarding` | Onboarding 6 étapes (premier lancement) |
| `/dashboard` | Accueil avec 4 quêtes du jour + ligue |
| `/session` | Session d'apprentissage entrelacée |
| `/jeux` | Hub des 12 jeux |
| `/jeux/[id]` | Run d'un jeu spécifique |
| `/coach` | Chat coach IA (modes dynamiques) |
| `/ligue` | Classement ligue hebdo |
| `/grc`, `/grc/[level]` | Module GRC + niveaux |
| `/profile` | Profil utilisateur + préférences |
| `/admin/*` | Espace admin (concepts, traductions, images) |

---

## Tests à valider après déploiement

| # | Test | Attendu |
|---|---|---|
| 1 | Inscription → onboarding → dashboard | Flow complet ≤ 90 s |
| 2 | Onboarding multi-objectifs + scolaire | Sous-étape niveau apparaît |
| 3 | Lancer une session apprentissage | Plan entrelacé exécuté |
| 4 | Jouer aux 12 jeux | Tous fonctionnels (ou exclus si manque image) |
| 5 | Coach IA — taper un message | Réponse Gemini en anglais |
| 6 | Coach — switch mode override | Tonalité change |
| 7 | Compléter 4 quêtes | Quadrifecta visible dashboard |
| 8 | Gain de points | League progression |
| 9 | PWA install (mobile) | Icône sur écran d'accueil |
| 10 | Admin upload image | Image visible côté user |
| 11 | Concept sans image | UX intacte (rien à la place) |
| 12 | Web Speech UK voice | Voix Daniel ou équivalent |
| 13 | RLS user A ne voit pas data user B | Isolation OK |
| 14 | Coût Vercel + Supabase | 0,00 € |

---

## Suite éventuelle (post-livraison)

- Génération automatique de scénarios via Gemini
- Tests CECRL approfondis (4 compétences)
- Export certificats PDF par palier
- Espace B2B GRC pour entreprises
- Extension Espagnol → Arabe → Coréen → Chinois (architecture déjà prête)

---

© Raïssa — Propriété intellectuelle. Document confidentiel. Diffusion interdite.
