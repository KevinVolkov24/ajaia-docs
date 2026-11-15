import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./Dashboard.css";

function Dashboard() {
    const navigate = useNavigate();

    // Documents retrieved from the backend.
    const [ownedDocuments, setOwnedDocuments] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);

    // Loading and error states.
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Document creation states.
    const [creatingDocument, setCreatingDocument] = useState(false);
    const [createError, setCreateError] = useState("");

    // Retrieve the authenticated user and their documents.
useEffect(() => {
    async function loadDashboard() {
        try {
            // First, identify the currently logged-in user.
            const userResponse = await fetch(
                "http://localhost:3000/api/auth/me",
                {
                    credentials: "include"
                }
            );

            // Redirect users who aren't logged in.
            if (userResponse.status === 401) {
                navigate("/login", { replace: true });
                return;
            }

            if (!userResponse.ok) {
                throw new Error("Failed to retrieve user information.");
            }

            const userData = await userResponse.json();

            setCurrentUser(userData.user);

            // Next, retrieve the user's documents.
            const documentsResponse = await fetch(
                "http://localhost:3000/api/documents",
                {
                    credentials: "include"
                }
            );

            if (!documentsResponse.ok) {
                throw new Error("Failed to retrieve documents.");
            }

            const documentsData = await documentsResponse.json();

            setOwnedDocuments(documentsData.documents);

        } catch (error) {
            console.error("Error loading dashboard:", error);
            setError("Could not load your documents. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    loadDashboard();
}, [navigate]);

    // Format PostgreSQL timestamps for display.
    function formatDate(date) {
        return new Date(date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    }

    async function createDocument() {
        try {
            setCreatingDocument(true);
            setCreateError("");

            const response = await fetch(
                "http://localhost:3000/api/documents",
                {
                    method: "POST",
                    credentials: "include"
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to create document."
                );
            }

            // Navigate to the newly created document.
            navigate(`/documents/${data.document.id}`);

        } catch (error) {
            console.error("Error creating document:", error);

            setCreateError(
                "Could not create document. Please try again."
            );

        } finally {
            setCreatingDocument(false);
        }
    }

    async function handleLogout() {
    try {
        const response = await fetch(
            "http://localhost:3000/api/auth/logout",
            {
                method: "POST",
                credentials: "include"
            }
        );

        if (!response.ok) {
            throw new Error("Unable to log out. Please try again.");
        }

        setCurrentUser(null);
        navigate("/login");
    } catch (error) {
        alert(error.message);
    }
}

    return (
        <div className="dashboard">

            {/* Navigation bar */}
            <header className="dashboard-navbar">
                <Link to="/" className="dashboard-logo">
                    Ajaia Docs
                </Link>

                <div className="navbar-right">
    <span className="user-placeholder">
        {currentUser ? currentUser.name : "Loading..."}
    </span>

    <button onClick={handleLogout}>
        Log Out
    </button>
</div>
            </header>

            {/* Main dashboard content */}
            <main className="dashboard-content">

                <div className="dashboard-heading">
                    <div>
                        <h1>My Documents</h1>
                        <p>Manage your documents in one place.</p>
                    </div>

                    <button
                        className="new-document-button"
                        onClick={createDocument}
                        disabled={creatingDocument}
>
                        {creatingDocument ? "Creating..." : "+ New Document"}
                    </button>
                </div>

                {createError && <p>{createError}</p>}

                {/* Owned documents */}
                <section className="document-section">
                    <h2>Owned by me</h2>

                    {loading && <p>Loading documents...</p>}

                    {error && <p>{error}</p>}

                    {!loading && !error && ownedDocuments.length === 0 && (
                        <p>You don't have any documents yet.</p>
                    )}

                    {!loading && !error && ownedDocuments.length > 0 && (
                        <div className="document-grid">
                            {ownedDocuments.map((document) => (
                                <Link
                                    to={`/documents/${document.id}`}
                                    className="document-card"
                                    key={document.id}
                                >
                                    <div className="document-icon">📄</div>

                                    <h3>{document.title}</h3>

                                    <p>
                                        Last modified:{" "}
                                        {formatDate(document.updated_at)}
                                    </p>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>

                {/* Shared documents */}
<section className="document-section">
    <h2>Shared with me</h2>

    <p>No documents have been shared with you yet.</p>
</section>

            </main>
        </div>
    );
}

export default Dashboard;