CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX users_email_lower_unique
ON users (LOWER(email));

CREATE TABLE documents (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'Untitled Document',
    content JSONB NOT NULL DEFAULT
        '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX documents_owner_id_idx
ON documents(owner_id);

CREATE TABLE document_shares (
    document_id BIGINT NOT NULL
        REFERENCES documents(id) ON DELETE CASCADE,

    user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    permission VARCHAR(10) NOT NULL DEFAULT 'viewer'
        CHECK (permission IN ('viewer', 'editor')),

    shared_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (document_id, user_id)
);

CREATE INDEX document_shares_user_id_idx
ON document_shares(user_id);