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


// Retrieve documents belonging to the test user.
app.get("/api/documents", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, owner_id, title, content, created_at, updated_at
             FROM documents
             WHERE owner_id = $1
             ORDER BY updated_at DESC`,
            [1]
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
app.post("/api/documents", async (req, res) => {
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
                1,
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

// Retrieve a single document by its ID.
app.get("/api/documents/:id", async (req, res) => {
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
            `SELECT id, owner_id, title, content, created_at, updated_at
             FROM documents
             WHERE id = $1 AND owner_id = $2`,
            [documentId, 1]
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
app.put("/api/documents/:id", async (req, res) => {
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
             SET content = $1::jsonb,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 AND owner_id = $3
             RETURNING id, owner_id, title, content, updated_at`,
            [
                JSON.stringify(content),
                documentId,
                1
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
app.patch("/api/documents/:id", async (req, res) => {
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
                1
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


// Delete an existing document.
app.delete("/api/documents/:id", async (req, res) => {
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
            [documentId, 1]
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