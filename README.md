# Ajaia Docs

A lightweight, web-based document editor inspired by Google Docs. Users can create, edit, format, rename, save, delete, and share documents through a simple browser-based interface.

## Technologies Used

### Frontend
- React
- Vite
- React Router
- TipTap rich-text editor
- CSS

### Backend
- Node.js
- Express.js
- PostgreSQL
- `pg` (node-postgres)
- bcrypt
- express-session
- connect-pg-simple

### Development Tools
- Docker
- Docker Compose
- npm
- Git

## Features

### Implemented

**Document Management**
- Create new documents.
- View a dashboard displaying user-specific documents.
- Edit document content using a rich-text editor.
- Format text using bold, italic, and underline.
- Create headings and bulleted or numbered lists.
- Save document content to PostgreSQL.
- Rename existing documents.
- Delete existing documents.

**User Authentication**
- Register new user accounts.
- Log in and log out of user accounts.
- Hash passwords using bcrypt.
- Store server-side authentication sessions in PostgreSQL.
- Retrieve information about the currently authenticated user.
- Protect document endpoints using authentication middleware.
- Associate documents with their authenticated owners.

**Document Sharing and Permissions**
- Share documents with other registered users using their email addresses.
- Assign Viewer or Editor permissions to shared users.
- View a list of users who have access to a document.
- Change an existing user's sharing permissions.
- Revoke another user's access to a document.
- Display documents shared with the authenticated user.
- Allow Editors to modify and save shared documents.
- Restrict Viewers to read-only access.
- Restrict document renaming, deletion, and sharing management to document owners.
- Enforce document permissions through backend authorization checks.

### Known Limitations
- File uploading and importing (`.txt`, `.md`, `.docx`) are not yet implemented.
- Real-time collaborative editing is not implemented.

## Project Structure

```text
ajaia-docs/
│
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── DocumentEditor.jsx
│   │   │   ├── Login.jsx
│   │   │   └── Register.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   └── package.json
│
├── server/
│   ├── src/
│   │   ├── database/
│   │   │   ├── db.js
│   │   │   ├── schema.sql
│   │   │   └── seed.sql
│   │   ├── app.js
│   │   └── server.js
│   └── package.json
│
├── docker-compose.yml
└── README.md
```

## Prerequisites

Install the following before running the application:

- [Node.js](https://nodejs.org/) (includes npm)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Git](https://git-scm.com/)

## Local Setup and Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd ajaia-docs
```

If you already have the project files, simply open the project directory in your terminal.

### 2. Install backend dependencies

Open a terminal in the project directory and run:

```bash
cd server
npm install
```

### 3. Install frontend dependencies

Open another terminal and run:

```bash
cd client
npm install
```

### 4. Configure environment variables

Create a `.env` file inside the `server` directory.

Add the following configuration:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ajaia_docs
DB_USER=ajaia_user
DB_PASSWORD=ajaia_dev_password

PORT=3000

SESSION_SECRET=replace_this_with_a_random_secret
```

These values correspond to the local development configuration in `docker-compose.yml`.

For production deployments, use a strong, randomly generated session secret and appropriate production database credentials.

**Important:** Never commit your `.env` file or expose production credentials.

### 5. Start PostgreSQL

From the project root directory, run:

```bash
docker compose up -d
```

This starts the PostgreSQL container using the configuration in `docker-compose.yml`.

The database is exposed on port `5432`.

### 6. Initialize the database

The project includes a SQL schema defining the application's database tables.

From the project root, execute the following PowerShell command:

```powershell
Get-Content .\server\src\database\schema.sql -Raw | docker exec -i ajaia-docs-db psql -v ON_ERROR_STOP=1 -U ajaia_user -d ajaia_docs
```

This creates the following application tables:

| Table | Purpose |
|---|---|
| `users` | Stores registered user accounts. |
| `documents` | Stores documents, ownership information, and content. |
| `document_shares` | Stores document-sharing permissions. |

The session store also requires a `user_sessions` table.

Connect to PostgreSQL:

```bash
docker exec -it ajaia-docs-db psql -U ajaia_user -d ajaia_docs
```

Execute the following SQL:

```sql
CREATE TABLE "user_sessions" (
    "sid" varchar NOT NULL COLLATE "default",
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL
);

ALTER TABLE "user_sessions"
ADD CONSTRAINT "user_sessions_pkey"
PRIMARY KEY ("sid");

CREATE INDEX "IDX_user_sessions_expire"
ON "user_sessions" ("expire");
```

Exit PostgreSQL:

```sql
\q
```

### 7. Start the backend

Open a terminal in the `server` directory:

```bash
npm run dev
```

The backend should start at:

```text
http://localhost:3000
```

You can verify that the backend is running by visiting:

```text
http://localhost:3000/api/health
```

You can also verify the PostgreSQL connection at:

```text
http://localhost:3000/api/db-health
```

### 8. Start the frontend

Open another terminal in the `client` directory:

```bash
npm run dev
```

Vite should start the frontend at:

```text
http://localhost:5173
```

Open that address in your browser to use the application.

## API Endpoints

All document endpoints require an authenticated user session.

### Health Checks

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Checks backend availability. |
| GET | `/api/db-health` | Checks PostgreSQL connectivity. |

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Registers a new user. |
| POST | `/api/auth/login` | Logs in an existing user. |
| POST | `/api/auth/logout` | Logs out the current user. |
| GET | `/api/auth/me` | Retrieves the currently authenticated user. |

### Documents

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/documents` | Retrieves documents owned by the authenticated user. |
| POST | `/api/documents` | Creates a new document. |
| GET | `/api/documents/shared` | Retrieves documents shared with the authenticated user. |
| GET | `/api/documents/:id` | Retrieves an accessible document by ID. |
| PUT | `/api/documents/:id` | Updates document content if the user has editing permission. |
| PATCH | `/api/documents/:id` | Renames a document (owner only). |
| DELETE | `/api/documents/:id` | Deletes a document (owner only). |

### Document Sharing

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/documents/:id/shares` | Shares a document or updates an existing user's permission (owner only). |
| GET | `/api/documents/:id/shares` | Retrieves users who have access to a document (owner only). |
| DELETE | `/api/documents/:id/shares/:userId` | Revokes a user's document access (owner only). |

## Database Design

The application uses PostgreSQL with four primary tables.

- **`users`:** Stores user IDs, names, email addresses, password hashes, and account creation timestamps.
- **`documents`:** Stores document IDs, owner IDs, titles, TipTap JSON content, and timestamps.
- **`document_shares`:** Associates documents with users and specifies their sharing permissions (`viewer` or `editor`).
- **`user_sessions`:** Stores server-side login session information.

Document content is stored as JSONB to preserve the structured content generated by TipTap.

## Development Notes

The frontend and backend run independently during development. The frontend communicates with the Express backend through HTTP requests.

PostgreSQL runs in a Docker container, allowing the database to persist independently of the application processes.

Authentication is handled using server-side sessions stored in PostgreSQL. Passwords are hashed using bcrypt.

Document ownership and sharing permissions are enforced by the backend using the authenticated user's session.

Document owners have full control over their documents, including editing, renaming, deleting, and managing sharing permissions.

Users with Editor permission can view, edit, and save shared documents but cannot rename or delete them. Users with Viewer permission can only view shared documents.

Users without permission to access a document cannot retrieve or modify it through the backend API.

File importing and real-time collaborative editing are planned but have not yet been implemented.