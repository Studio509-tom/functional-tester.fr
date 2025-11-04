# Functional Tester (SaaS)

Application SaaS de tests fonctionnels end-to-end.

- Backend: Symfony 7 (API + vues Twig)
- Worker: Node.js + Puppeteer (exécute les scénarios: fill, click, expectText)
- Frontend: Bootstrap 5 + jQuery
- Base de données: MySQL (User, TestScenario, TestExecution)

## Installation (Windows PowerShell)

Prérequis: PHP 8.2+, Composer, Node 18+, MySQL, Chrome/Chromium (Puppeteer peut télécharger un binaire si absent).

1. Générer automatiquement le projet (recommandé)

```powershell
# À la racine du dépôt
node .\scaffold.js
```

Le script va:

- Créer le squelette Symfony dans `backend/`, installer les dépendances nécessaires
- Déposer le code (entités, contrôleurs, vues Twig, services)
- Créer le worker Node.js dans `worker/` (Express + Puppeteer)

2. Configuration de la base de données

Éditez `backend/.env` et remplacez la connexion MySQL:

```
DATABASE_URL="mysql://USER:PASSWORD@127.0.0.1:3306/functional_tester?serverVersion=8.0&charset=utf8mb4"
WORKER_URL="http://127.0.0.1:4000"
APP_ENV=dev
APP_SECRET=change_me
```

3. Installer les dépendances

```powershell
# Backend
cd .\backend; composer install; cd ..

# Worker
cd .\worker; npm install; cd ..
```

4. Démarrer les services

```powershell
# Lancer le worker (port 4000)
cd .\worker; npm start
```

Dans un autre terminal:

```powershell
# Lancer le serveur Symfony (port 8000)
cd .\backend; php -S 127.0.0.1:8000 -t public
```

5. Initialiser la base

```powershell
cd .\backend; php .\vendor\bin\doctrine-migrations migrations:diff; php .\vendor\bin\doctrine-migrations migrations:migrate -n
```

Ensuite ouvrez http://127.0.0.1:8000.

## Déploiement local avec DDEV (Docker)

Prérequis: Docker Desktop, DDEV.

1. Générer le code du projet (si pas déjà fait)

```powershell
node .\scaffold.js
```

2. Démarrer l'environnement DDEV

```powershell
ddev start
```

3. Installer les dépendances backend dans le conteneur

```powershell
ddev composer install
```

4. Préparer la base MySQL (DDEV fournit MySQL 8)

```powershell
ddev exec php vendor/bin/doctrine-migrations migrations:diff
ddev exec php vendor/bin/doctrine-migrations migrations:migrate -n
```

5. Accéder aux services

- Symfony (web): `https://functional-tester.ddev.site`
- Worker Node (interne réseau): `http://worker:4000` (le backend y accède via `backend/.env.local`)

Notes:

- La config DDEV est dans `.ddev/` avec docroot `backend/public`.
- Un service `worker` (Node + Puppeteer) tourne en parallèle via `docker-compose.worker.yaml`.
- Si vous modifiez les dépendances du worker, exécutez: `ddev exec -s worker npm ci || npm install`.

## Utilisation

- Dashboard: liste des scénarios et exécutions récentes
- CRUD Scénarios: créer/éditer un JSON d'étapes
- Lancer un test: bouton "Lancer" sur la page d'un scénario; résultat affiché (succès/erreurs, capture d'écran)

## Format des étapes (JSON)

Exemple minimal:

```json
[
  { "action": "goto", "url": "https://example.org" },
  { "action": "fill", "selector": "#search", "value": "hello" },
  { "action": "click", "selector": "#submit" },
  { "action": "expectText", "selector": "h1", "text": "Example Domain" }
]
```

Actions supportées: `goto`, `fill`, `click`, `expectText`.

## Sécurité/Notes

- Exemple simple sans authentification utilisateur complète; ajoutez les rôles/guards selon vos besoins.
- Renseignez `WORKER_URL` côté Symfony pour pointer vers le worker.
- En DDEV, `backend/.env.local` force `WORKER_URL=http://worker:4000` pour utiliser le service docker.
- Puppeteer peut nécessiter des dépendances système selon l’OS.
