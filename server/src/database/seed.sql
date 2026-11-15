-- Create a temporary test user.
INSERT INTO users (name, email, password_hash)
VALUES (
    'Test User',
    'test@example.com',
    'temporary-hash'
)
ON CONFLICT DO NOTHING;

-- Create sample documents for the test user.
INSERT INTO documents (owner_id, title, content)
SELECT
    users.id,
    sample.title,
    sample.content::jsonb
FROM users
CROSS JOIN (
    VALUES
        (
            'My First Document',
            '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"This is my first document."}]}]}'
        ),
        (
            'Project Planning',
            '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Planning notes for the project."}]}]}'
        ),
        (
            'Meeting Notes',
            '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Notes from our latest meeting."}]}]}'
        )
) AS sample(title, content)
WHERE users.email = 'test@example.com'
AND NOT EXISTS (
    SELECT 1
    FROM documents
    WHERE documents.owner_id = users.id
      AND documents.title = sample.title
);