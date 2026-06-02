# ChatApp

Application de chat en temps réel avec salons privés, partage par code d'invitation et authentification par email.

## Stack technique

- **Backend** : Django 4.2 + Django REST Framework + Django Channels (WebSocket)
- **Frontend** : React 18 + Vite
- **Base de données** : SQLite
- **Serveur ASGI** : Daphne

## Fonctionnalités

### Authentification

- Inscription avec email, nom d'utilisateur (unique, insensible à la casse) et mot de passe
- Connexion par email + mot de passe
- Session utilisateur persistante (côté Django)
- Administration : compte admin par défaut (`admin` / `admin123`)

### Salons de discussion

- Création de salons avec nom et description optionnelle
- Code unique généré automatiquement (8 caractères hexadécimaux) pour le partage
- Rejoindre un salon via un code (bouton "Rejoindre" ou URL `/chat/<code>`)
- Quitter un salon
- Liste des salons accessibles affichée dans la sidebar
- Affichage du code du salon actif + bouton "Copier le lien" pour inviter d'autres utilisateurs

### Messagerie temps réel

- Messages persistés en base de données (historique conservé)
- Envoi et réception instantanés via WebSocket
- Horodatage de chaque message (date + heure)
- Messages de l'utilisateur mis en évidence (fond vert, aligné à droite)
- Sélecteur d'émojis intégré

### Administration

- Page d'admin accessible aux utilisateurs avec le statut `is_admin`
- Gestion des utilisateurs : liste complète avec email, date d'inscription, suppression
- Gestion des salons : liste complète avec nombre de membres, créateur, date de création, suppression

## Installation et démarrage

### Prérequis

- Python 3.10+
- Node.js 18+

### Backend

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate      # Windows
source venv/bin/activate     # Linux / macOS
pip install -r requirements.txt
python manage.py migrate
python manage.py setup       # Crée le compte admin (admin / admin123)
python manage.py runserver 8001
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Le frontend est accessible sur `http://localhost:3000` et le backend sur `http://localhost:8001`.

## API

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/login/` | Connexion |
| POST | `/api/logout/` | Déconnexion |
| POST | `/api/register/` | Inscription |
| GET | `/api/me/` | Utilisateur connecté |
| GET/POST | `/api/users/` | Liste/création d'utilisateurs (admin) |
| GET/POST | `/api/groups/` | Liste/création de salons |
| POST | `/api/groups/<id>/join/` | Rejoindre un salon |
| POST | `/api/groups/<id>/leave/` | Quitter un salon |
| GET | `/api/groups/<id>/members/` | Membres d'un salon |
| POST | `/api/groups/join-by-code/` | Rejoindre par code |
| GET/POST | `/api/messages/` | Messages (filtrés par `?group=<id>`) |
| WS | `/ws/chat/<group_id>/` | WebSocket pour les messages temps réel |

## Structure du projet

```
ChatApp/
├── backend/
│   ├── chat/
│   │   ├── management/commands/setup.py   # Création du compte admin
│   │   ├── migrations/
│   │   ├── consumers.py                   # WebSocket : réception et persistance des messages
│   │   ├── models.py                      # User, ChatGroup, Message
│   │   ├── serializers.py                 # DRF serializers
│   │   ├── urls.py                        # Routes API
│   │   └── views.py                       # Vues API REST
│   ├── chatapp_backend/
│   │   └── settings.py
│   ├── db.sqlite3
│   └── manage.py
└── frontend/
    ├── src/
    │   ├── context/AuthContext.jsx         # Contexte d'authentification
    │   ├── pages/
    │   │   ├── LoginPage.jsx               # Connexion et inscription
    │   │   ├── ChatPage.jsx                # Interface principale du chat
    │   │   └── AdminPage.jsx               # Page d'administration
    │   ├── App.jsx                         # Routes de l'application
    │   └── main.jsx                        # Point d'entrée React
    ├── index.html
    ├── package.json
    └── vite.config.js
```
