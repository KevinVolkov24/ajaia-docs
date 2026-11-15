
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./Dashboard.css";

function Dashboard() {
    const navigate = useNavigate();

    // Documents retrieved from the backend.
    const [ownedDocuments, setOwnedDocuments] = useState([]);

    // Loading and error states.
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Document creation states.
    const [creatingDocument, setCreatingDocument] = useState(false);
    const [createError, setCreateError] = useState("");

    // Retrieve documents when the dashboard loads.
    useEffect(() => {
        async function fetchDocuments() {
            try {
                const response = await fetch(
                    "http://localhost:3000/api/documents"
                );

                if (!response.ok) {
                    throw new Error("Failed to retrieve documents.");
                }

                const data = await response.json();

                setOwnedDocuments(data.documents);
            } catch (error) {
                console.error("Error fetching documents:", error);
                setError("Could not load your documents. Please try again.");
            } finally {
                setLoading(false);
            }
        }

        fetchDocuments();
    }, []);

    // Format PostgreSQL timestamps for display.
    function formatDate(date) {
        return new Date(date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    }

    // Temporary shared documents until sharing is implemented.
    const sharedDocuments = [
        {
            id: "4",
            title: "Team Project",
            owner: "Alex",
            lastModified: "November 11, 2026"
        },
        {
            id: "5",
            title: "Research Notes",
            owner: "Jordan",
            lastModified: "November 9, 2026"
        }
    ];

    async function createDocument() {
        try {
            setCreatingDocument(true);
            setCreateError("");

            const response = await fetch(
                "http://localhost:3000/api/documents",
                {
                    method: "POST"
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

    return (
        <div className="dashboard">

            {/* Navigation bar */}
            <header className="dashboard-navbar">
                <Link to="/" className="dashboard-logo">
                    Ajaia Docs
                </Link>

                <div className="navbar-right">
                    <span className="user-placeholder">Guest User</span>
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

                    <div className="document-grid">
                        {sharedDocuments.map((document) => (
                            <Link
                                to={`/documents/${document.id}`}
                                className="document-card"
                                key={document.id}
                            >
                                <div className="document-icon">📄</div>

                                <h3>{document.title}</h3>

                                <p>
                                    Shared by: {document.owner}
                                </p>

                                <p>
                                    Last modified: {document.lastModified}
                                </p>
                            </Link>
                        ))}
                    </div>
                </section>

            </main>
        </div>
    );
}

export default Dashboard;