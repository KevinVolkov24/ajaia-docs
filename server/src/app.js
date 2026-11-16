const express = require("express");
const cors = require("cors");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcrypt");

const pool = require("./database/db");

const app = express();

// Middleware
app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
}));

app.use(express.json());

// Configure session storage in PostgreSQL.
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: "user_sessions",
        createTableIfMissing: true
    }),

    secret: process.env.SESSION_SECRET,

    resave: false,
    saveUninitialized: false,

    cookie: {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24
    }
}));

// Backend health-check endpoint
app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "success",
        message: "Backend is running!"
    });
});


// Register a new user.
app.post("/api/auth/register", async (req, res) => {
    const { name, email, password } = req.body;

    // Validate the user's name.
    if (
        typeof name !== "string" ||
        name.trim().length === 0 ||
        name.trim().length > 100
    ) {
        return res.status(400).json({
            status: "error",
            message: "Name must contain between 1 and 100 characters."
        });
    }

    // Validate the email address.
    if (
        typeof email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
        return res.status(400).json({
            status: "error",
            message: "Please provide a valid email address."
        });
    }

    // Validate the password.
    if (
        typeof password !== "string" ||
        password.length < 8 ||
        Buffer.byteLength(password, "utf8") > 72
    ) {
        return res.status(400).json({
            status: "error",
            message: "Password must be at least 8 characters and no more than 72 bytes."
        });
    }

    try {
        // Hash the password before storing it.
        const passwordHash = await bcrypt.hash(password, 12);

        // Insert the new user into PostgreSQL.
        const result = await pool.query(
            `INSERT INTO users (name, email, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id, name, email, created_at`,
            [
                name.trim(),
                email.trim().toLowerCase(),
                passwordHash
            ]
        );

        const user = result.rows[0];

        // Automatically create a login session.
        req.session.userId = user.id;

        // Save the session before responding.
        req.session.save((error) => {
            if (error) {
                console.error("Failed to save session:", error);

                return res.status(500).json({
                    status: "error",
                    message: "Account created, but login failed."
                });
            }

            res.status(201).json({
                status: "success",
                message: "Account created successfully!",
                user
            });
        });

    } catch (error) {
        // PostgreSQL error code 23505 means a unique constraint was violated.
        if (error.code === "23505") {
            return res.status(409).json({
                status: "error",
                message: "An account with this email address already exists."
            });
        }

        console.error("Failed to register user:", error);

        res.status(500).json({
            status: "error",
            message: "Could not register user."
        });
    }
});


// Database health-check endpoint
app.get("/api/db-health", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW() AS current_time");

        res.status(200).json({
            status: "success",
            message: "Successfully connected to PostgreSQL!",
            databaseTime: result.rows[0].current_time
        });
    } catch (error) {
        console.error("Database connection failed:", error);

        res.status(500).json({
            status: "error",
            message: "Could not connect to PostgreSQL."
        });
    }
});


// Log in an existing user.
app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;

    // Validate the submitted credentials.
    if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        email.trim().length === 0 ||
        password.length === 0
    ) {
        return res.status(400).json({
            status: "error",
            message: "Email and password are required."
        });
    }

    try {
        // Find the user by email address.
        const result = await pool.query(
            `SELECT id, name, email, password_hash
             FROM users
             WHERE LOWER(email) = LOWER($1)`,
            [email.trim()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                status: "error",
                message: "Invalid email or password."
            });
        }

        const user = result.rows[0];

        // Compare the submitted password with its stored hash.
        const passwordMatches = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                status: "error",
                message: "Invalid email or password."
            });
        }

        // Regenerate the session to protect against session fixation.
        req.session.regenerate((error) => {
            if (error) {
                console.error("Failed to regenerate session:", error);

                return res.status(500).json({
                    status: "error",
                    message: "Could not log in."
                });
            }

            // Store the logged-in user's ID in the session.
            req.session.userId = user.id;

            // Save the session before responding.
            req.session.save((error) => {
                if (error) {
                    console.error("Failed to save session:", error);

                    return res.status(500).json({
                        status: "error",
                        message: "Could not log in."
                    });
                }

                res.status(200).json({
                    status: "success",
                    message: "Logged in successfully!",
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email
                    }
                });
            });
        });

    } catch (error) {
        console.error("Failed to log in:", error);

        res.status(500).json({
            status: "error",
            message: "Could not log in."
        });
    }
});


// Retrieve the currently logged-in user.
app.get("/api/auth/me", async (req, res) => {
    // Check whether a user ID exists in the session.
    if (!req.session.userId) {
        return res.status(401).json({
            status: "error",
            message: "You are not logged in."
        });
    }

    try {
        const result = await pool.query(
            `SELECT id, name, email, created_at
             FROM users
             WHERE id = $1`,
            [req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                status: "error",
                message: "User account not found."
            });
        }

        res.status(200).json({
            status: "success",
            user: result.rows[0]
        });

    } catch (error) {
        console.error("Failed to retrieve current user:", error);

        res.status(500).json({
            status: "error",
            message: "Could not retrieve user information."
        });
    }
});


// Log out the currently logged-in user.
app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            console.error("Failed to log out:", error);

            return res.status(500).json({
                status: "error",
                message: "Could not log out."
            });
        }

        res.clearCookie("connect.sid");

        res.status(200).json({
            status: "success",
            message: "Logged out successfully!"
        });
    });
});


 // Middleware to protect routes that require authentication.
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({
            status: "error",
            message: "Authentication required. Please log in."
        });
    }

    next();
}

// Retrieve documents belonging to the test user.
app.get("/api/documents", requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, owner_id, title, content, created_at, updated_at
             FROM documents
             WHERE owner_id = $1
             ORDER BY updated_at DESC`,
            [req.session.userId]
        );

        res.status(200).json({
            status: "success",
            documents: result.rows
        });
    } catch (error) {
        console.error("Failed to retrieve documents:", error);

        res.status(500).json({
            status: "error",
            message: "Could not retrieve documents."
        });
    }
});

// Create a new document.
app.post("/api/documents", requireAuth, async (req, res) => {
    try {
        const defaultContent = {
            type: "doc",
            content: [
                {
                    type: "paragraph"
                }
            ]
        };

        const result = await pool.query(
            `INSERT INTO documents (owner_id, title, content)
             VALUES ($1, $2, $3::jsonb)
             RETURNING id, owner_id, title, content, created_at, updated_at`,
            [
                req.session.userId,
                "Untitled Document",
                JSON.stringify(defaultContent)
            ]
        );

        res.status(201).json({
            status: "success",
            message: "Document created successfully!",
            document: result.rows[0]
        });
    } catch (error) {
        console.error("Failed to create document:", error);

        res.status(500).json({
            status: "error",
            message: "Could not create document."
        });
    }
});

// Get documents shared with the logged-in user.
app.get("/api/documents/shared", requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                documents.id,
                documents.owner_id,
                documents.title,
                documents.created_at,
                documents.updated_at,
                document_shares.permission,
                users.name AS owner_name,
                users.email AS owner_email
             FROM document_shares
             JOIN documents
                ON document_shares.document_id = documents.id
             JOIN users
                ON documents.owner_id = users.id
             WHERE document_shares.user_id = $1
             ORDER BY documents.updated_at DESC`,
            [req.session.userId]
        );

        res.status(200).json({
            status: "success",
            documents: result.rows
        });

    } catch (error) {
        console.error("Failed to retrieve shared documents:", error);

        res.status(500).json({
            status: "error",
            message: "Could not retrieve shared documents."
        });
    }
});

// Retrieve a single document by its ID.
app.get("/api/documents/:id", requireAuth, async (req, res) => {
    const documentId = req.params.id;

    // Make sure the document ID contains only digits.
    if (!/^\d+$/.test(documentId)) {
        return res.status(400).json({
            status: "error",
            message: "Invalid document ID."
        });
    }

    try {
        const result = await pool.query(
            `SELECT
                documents.id,
                documents.owner_id,
                documents.title,
                documents.content,
                documents.created_at,
                documents.updated_at,
                CASE
                    WHEN documents.owner_id = $2 THEN 'owner'
                    ELSE document_shares.permission
                END AS permission
            FROM documents
            LEFT JOIN document_shares
                ON documents.id = document_shares.document_id
                AND document_shares.user_id = $2
            WHERE documents.id = $1
                AND (
                    documents.owner_id = $2
                    OR document_shares.user_id = $2
                )`,
            [documentId, req.session.userId]
        );

        // Check whether the requested document exists.
        if (result.rows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Document not found."
            });
        }

        res.status(200).json({
            status: "success",
            document: result.rows[0]
        });

    } catch (error) {
        console.error("Failed to retrieve document:", error);

        res.status(500).json({
            status: "error",
            message: "Could not retrieve document."
        });
    }
});


 // Update the content of an existing document.
app.put("/api/documents/:id", requireAuth, async (req, res) => {
    const documentId = req.params.id;
    const { content } = req.body;

    // Validate the document ID.
    if (!/^\d+$/.test(documentId)) {
        return res.status(400).json({
            status: "error",
            message: "Invalid document ID."
        });
    }

    // Validate the document content.
    if (
        !content ||
        typeof content !== "object" ||
        content.type !== "doc"
    ) {
        return res.status(400).json({
            status: "error",
            message: "Invalid document content."
        });
    }

    try {
        const result = await pool.query(
            `UPDATE documents
            SET content = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
                AND (
                    owner_id = $3
                    OR EXISTS (
                        SELECT 1
                        FROM document_shares
                        WHERE document_shares.document_id = documents.id
                            AND document_shares.user_id = $3
                            AND document_shares.permission = 'editor'
                )
            )
            RETURNING id, owner_id, title, content, updated_at`,
            [
                JSON.stringify(content),
                documentId,
                req.session.userId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Document not found."
            });
        }

        res.status(200).json({
            status: "success",
            message: "Document saved successfully!",
            document: result.rows[0]
        });

    } catch (error) {
        console.error("Failed to save document:", error);

        res.status(500).json({
            status: "error",
            message: "Could not save document."
        });
    }
});


// Rename an existing document.
app.patch("/api/documents/:id", requireAuth, async (req, res) => {
    const documentId = req.params.id;
    const { title } = req.body;

    // Validate the document ID.
    if (!/^\d+$/.test(documentId)) {
        return res.status(400).json({
            status: "error",
            message: "Invalid document ID."
        });
    }

    // Validate the document title.
    if (
        typeof title !== "string" ||
        title.trim().length === 0 ||
        title.trim().length > 255
    ) {
        return res.status(400).json({
            status: "error",
            message: "Title must contain between 1 and 255 characters."
        });
    }

    try {
        const result = await pool.query(
            `UPDATE documents
             SET title = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 AND owner_id = $3
             RETURNING id, owner_id, title, updated_at`,
            [
                title.trim(),
                documentId,
                req.session.userId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Document not found."
            });
        }

        res.status(200).json({
            status: "success",
            message: "Document renamed successfully!",
            document: result.rows[0]
        });

    } catch (error) {
        console.error("Failed to rename document:", error);

        res.status(500).json({
            status: "error",
            message: "Could not rename document."
        });
    }
});


// Get the users who have access to a document.
app.get("/api/documents/:id/shares", requireAuth, async (req, res) => {
    const documentId = req.params.id;

    if (!/^\d+$/.test(documentId)) {
        return res.status(400).json({
            status: "error",
            message: "Invalid document ID."
        });
    }

    try {
        // Verify that the logged-in user owns the document.
        const documentResult = await pool.query(
            `SELECT id
             FROM documents
             WHERE id = $1 AND owner_id = $2`,
            [documentId, req.session.userId]
        );

        if (documentResult.rows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Document not found."
            });
        }

        // Retrieve everyone the document is shared with.
        const result = await pool.query(
            `SELECT
                document_shares.user_id,
                document_shares.permission,
                document_shares.shared_at,
                users.name,
                users.email
             FROM document_shares
             JOIN users
                ON document_shares.user_id = users.id
             WHERE document_shares.document_id = $1
             ORDER BY document_shares.shared_at DESC`,
            [documentId]
        );

        res.status(200).json({
            status: "success",
            shares: result.rows
        });

    } catch (error) {
        console.error("Failed to retrieve document shares:", error);

        res.status(500).json({
            status: "error",
            message: "Could not retrieve document shares."
        });
    }
});


 // Revoke a user's access to a shared document.
app.delete("/api/documents/:id/shares/:userId", requireAuth, async (req, res) => {
    const { id: documentId, userId } = req.params;

    if (!/^\d+$/.test(documentId) || !/^\d+$/.test(userId)) {
        return res.status(400).json({
            status: "error",
            message: "Invalid document ID or user ID."
        });
    }

    try {
        // Verify that the logged-in user owns the document.
        const documentResult = await pool.query(
            `SELECT id
             FROM documents
             WHERE id = $1 AND owner_id = $2`,
            [documentId, req.session.userId]
        );

        if (documentResult.rows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Document not found."
            });
        }

        // Remove the user's sharing permission.
        const result = await pool.query(
            `DELETE FROM document_shares
             WHERE document_id = $1 AND user_id = $2
             RETURNING document_id, user_id`,
            [documentId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "This user does not have access to the document."
            });
        }

        res.status(200).json({
            status: "success",
            message: "Document access revoked successfully!"
        });

    } catch (error) {
        console.error("Failed to revoke document access:", error);

        res.status(500).json({
            status: "error",
            message: "Could not revoke document access."
        });
    }
});

// Share an existing document with another user.
app.post("/api/documents/:id/shares", requireAuth, async (req, res) => {
    const documentId = req.params.id;
    const { email, permission } = req.body;

    // Validate the document ID.
    if (!/^\d+$/.test(documentId)) {
        return res.status(400).json({
            status: "error",
            message: "Invalid document ID."
        });
    }

    // Validate the recipient's email.
    if (
        typeof email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
        return res.status(400).json({
            status: "error",
            message: "Please provide a valid email address."
        });
    }

    // Validate the sharing permission.
    if (!["viewer", "editor"].includes(permission)) {
        return res.status(400).json({
            status: "error",
            message: "Permission must be either viewer or editor."
        });
    }

    try {
        // Verify that the logged-in user owns the document.
        const documentResult = await pool.query(
            `SELECT id
             FROM documents
             WHERE id = $1 AND owner_id = $2`,
            [documentId, req.session.userId]
        );

        if (documentResult.rows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Document not found."
            });
        }

        // Find the recipient by email address.
        const userResult = await pool.query(
            `SELECT id, name, email
             FROM users
             WHERE LOWER(email) = LOWER($1)`,
            [email.trim()]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "No account exists with that email address."
            });
        }

        const recipient = userResult.rows[0];

        // Prevent owners from sharing documents with themselves.
        if (String(recipient.id) === String(req.session.userId)) {
            return res.status(400).json({
                status: "error",
                message: "You cannot share a document with yourself."
            });
        }

        // Create or update the sharing record.
        const shareResult = await pool.query(
            `INSERT INTO document_shares
                (document_id, user_id, permission)
             VALUES ($1, $2, $3)
             ON CONFLICT (document_id, user_id)
             DO UPDATE SET permission = EXCLUDED.permission
             RETURNING document_id, user_id, permission, shared_at`,
            [documentId, recipient.id, permission]
        );

        res.status(200).json({
            status: "success",
            message: "Document shared successfully!",
            share: {
                ...shareResult.rows[0],
                user: recipient
            }
        });

    } catch (error) {
        console.error("Failed to share document:", error);

        res.status(500).json({
            status: "error",
            message: "Could not share document."
        });
    }
});

// Delete an existing document.
app.delete("/api/documents/:id", requireAuth, async (req, res) => {
    const documentId = req.params.id;

    // Validate the document ID.
    if (!/^\d+$/.test(documentId)) {
        return res.status(400).json({
            status: "error",
            message: "Invalid document ID."
        });
    }

    try {
        const result = await pool.query(
            `DELETE FROM documents
             WHERE id = $1 AND owner_id = $2
             RETURNING id, title`,
            [documentId, req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Document not found."
            });
        }

        res.status(200).json({
            status: "success",
            message: "Document deleted successfully!",
            document: result.rows[0]
        });

    } catch (error) {
        console.error("Failed to delete document:", error);

        res.status(500).json({
            status: "error",
            message: "Could not delete document."
        });
    }
});

module.exports = app;