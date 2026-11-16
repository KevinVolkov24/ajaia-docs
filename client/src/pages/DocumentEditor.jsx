import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";


function DocumentEditor() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [document, setDocument] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

      // Document saving states.
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState("");

    // Document renaming states.
    const [newTitle, setNewTitle] = useState("");
    const [renaming, setRenaming] = useState(false);
    const [renameMessage, setRenameMessage] = useState("");

    // Document deletion states.
    const [deleting, setDeleting] = useState(false);
    const [deleteMessage, setDeleteMessage] = useState("");

    // Document sharing states.
    const [shares, setShares] = useState([]);
    const [shareEmail, setShareEmail] = useState("");
    const [sharePermission, setSharePermission] = useState("viewer");
    const [sharing, setSharing] = useState(false);
    const [shareMessage, setShareMessage] = useState("");

    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline
        ],
        content: "",
        editable: false,
        immediatelyRender: false
    });

    useEffect(() => {
        async function fetchDocument() {
            try {
                setLoading(true);
                setError("");

                const response = await fetch(
                   `http://localhost:3000/api/documents/${id}`,
                    {
                        credentials: "include"
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message || "Failed to retrieve document."
                    );
                }

                // Store the complete document retrieved from the backend.
                setDocument(data.document);
                setNewTitle(data.document.title);

            } catch (error) {
                console.error("Error retrieving document:", error);
                setError("Could not load this document.");

            } finally {
                setLoading(false);
            }
        }

        fetchDocument();
    }, [id]);

    // Load sharing information once the document has loaded.
    useEffect(() => {
        if (document?.id === id && document?.permission === "owner") {
            fetchShares();
        }
    }, [id, document?.id, document?.permission]);

    useEffect(() => {
        if (editor && document) {
            editor.commands.setContent(document.content);
        }
    }, [editor, document?.id]);

    // Enable or disable editing based on the user's permission.
    useEffect(() => {
        if (editor && document) {
            editor.setEditable(document.permission !== "viewer");
        }
    }, [editor, document?.permission]);

    const isOwner = document?.permission === "owner";
    const canEdit = document?.permission !== "viewer";

    if (loading) {
        return <p>Loading document...</p>;
    }

    if (error) {
        return (
            <div>
                <p>{error}</p>
                <Link to="/">Return to Dashboard</Link>
            </div>
        );
    }

    // Formatting toolbar button.
    function ToolbarButton({ label, onClick, active = false }) {
        return (
            <button
                type="button"
                onClick={onClick}
                style={{
                    fontWeight: active ? "bold" : "normal",
                    backgroundColor: active ? "#e0e7ff" : "#ffffff"
                }}
            >
                {label}
            </button>
        );
    }

    // Retrieve the users who have access to this document.
    async function fetchShares() {
        try {
            const response = await fetch(
                `http://localhost:3000/api/documents/${id}/shares`,
                {
                    credentials: "include"
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to retrieve document shares."
                );
            }

            setShares(data.shares);

        } catch (error) {
            console.error("Error retrieving document shares:", error);
            setShareMessage("Could not retrieve sharing information.");
        }
    }

    // Share this document with another user.
    async function shareDocument() {
        try {
            setSharing(true);
            setShareMessage("");

            const response = await fetch(
                `http://localhost:3000/api/documents/${id}/shares`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    credentials: "include",
                    body: JSON.stringify({
                        email: shareEmail,
                        permission: sharePermission
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to share document."
                );
            }

            setShareMessage("Document shared successfully!");
            setShareEmail("");

            // Refresh the list of people with access.
            await fetchShares();

        } catch (error) {
            console.error("Error sharing document:", error);
            setShareMessage(
                error.message || "Could not share document."
            );

        } finally {
            setSharing(false);
        }
    }

    // Change a user's document permission.
    async function updateSharePermission(userId, permission) {
        try {
            setShareMessage("");

            const share = shares.find(
                (item) => String(item.user_id) === String(userId)
            );

            const response = await fetch(
                `http://localhost:3000/api/documents/${id}/shares`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    credentials: "include",
                    body: JSON.stringify({
                        email: share.email,
                        permission
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to update permission."
                );
            }

            setShareMessage("Permission updated successfully!");
            await fetchShares();

        } catch (error) {
            console.error("Error updating permission:", error);
            setShareMessage(error.message || "Could not update permission.");
        }
    }

    // Remove a user's access to this document.
    async function revokeShare(userId) {
        const confirmed = window.confirm(
            "Are you sure you want to remove this user's access?"
        );

        if (!confirmed) {
            return;
        }

        try {
            setShareMessage("");

            const response = await fetch(
                `http://localhost:3000/api/documents/${id}/shares/${userId}`,
                {
                    method: "DELETE",
                    credentials: "include"
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to revoke document access."
                );
            }

            setShareMessage("Document access revoked successfully!");

            await fetchShares();

        } catch (error) {
            console.error("Error revoking access:", error);
            setShareMessage(
                error.message || "Could not revoke document access."
            );
        }
    }
    
    async function saveDocument() {
    if (!editor) {
        return;
    }

    try {
        setSaving(true);
        setSaveMessage("");

        const content = editor.getJSON();

        const response = await fetch(
            `http://localhost:3000/api/documents/${id}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify({ content })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || "Failed to save document."
            );
        }

        setSaveMessage("All changes saved!");

    } catch (error) {
        console.error("Error saving document:", error);
        setSaveMessage("Could not save document. Please try again.");

    } finally {
        setSaving(false);
    }
}


async function renameDocument() {
    try {
        setRenaming(true);
        setRenameMessage("");

        const response = await fetch(
            `http://localhost:3000/api/documents/${id}`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify({
                    title: newTitle
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || "Failed to rename document."
            );
        }

        // Update only the title, preserving the existing document content.
        setDocument((previousDocument) => ({
            ...previousDocument,
            title: data.document.title
        }));

setNewTitle(data.document.title);

        setRenameMessage("Document renamed successfully!");

    } catch (error) {
        console.error("Error renaming document:", error);

        setRenameMessage(
            error.message || "Could not rename document."
        );

    } finally {
        setRenaming(false);
    }
}


async function deleteDocument() {
    // Ask the user to confirm deletion.
    const confirmed = window.confirm(
        "Are you sure you want to permanently delete this document?"
    );

    if (!confirmed) {
        return;
    }

    try {
        setDeleting(true);
        setDeleteMessage("");

        const response = await fetch(
            `http://localhost:3000/api/documents/${id}`,
            {
                method: "DELETE",
                credentials: "include"
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || "Failed to delete document."
            );
        }

        // Return to the dashboard after successful deletion.
        navigate("/");

    } catch (error) {
        console.error("Error deleting document:", error);

        setDeleteMessage(
            error.message || "Could not delete document."
        );

    } finally {
        setDeleting(false);
    }
}

    return (
        <div className="document-editor">
            
<header>
    <Link to="/">← Back to Dashboard</Link>

    <h1>{document.title}</h1>

    {isOwner && (
    <>
        <div className="document-title-controls">
            <input
                type="text"
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="Document title"
                maxLength={255}
            />

            <button
                onClick={renameDocument}
                disabled={renaming}
            >
                {renaming ? "Renaming..." : "Rename"}
            </button>
        </div>

        {renameMessage && <p>{renameMessage}</p>}
    </>
)}

    {canEdit && (
    <button
        onClick={saveDocument}
        disabled={saving}
    >
        {saving ? "Saving..." : "Save"}
    </button>
)}

    {isOwner && (
    <>
        <button
            onClick={deleteDocument}
            disabled={deleting}
        >
            {deleting ? "Deleting..." : "Delete"}
        </button>

        {deleteMessage && <p>{deleteMessage}</p>}
    </>
)}

    {saveMessage && <p>{saveMessage}</p>}
</header>

            {canEdit && (
    <div className="editor-toolbar">
        <ToolbarButton
            label="B"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
        />

        <ToolbarButton
            label="I"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
        />

        <ToolbarButton
            label="U"
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
        />

        <span>|</span>

        <ToolbarButton
            label="Heading 1"
            active={editor.isActive("heading", { level: 1 })}
            onClick={() =>
                editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
        />

        <ToolbarButton
            label="Heading 2"
            active={editor.isActive("heading", { level: 2 })}
            onClick={() =>
                editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
        />

        <ToolbarButton
            label="Paragraph"
            active={editor.isActive("paragraph")}
            onClick={() =>
                editor.chain().focus().setParagraph().run()
            }
        />

        <span>|</span>

        <ToolbarButton
            label="• List"
            active={editor.isActive("bulletList")}
            onClick={() =>
                editor.chain().focus().toggleBulletList().run()
            }
        />

        <ToolbarButton
            label="1. List"
            active={editor.isActive("orderedList")}
            onClick={() =>
                editor.chain().focus().toggleOrderedList().run()
            }
        />
    </div>
)}
            {isOwner && (
                <section className="document-sharing">
                    <h2>Share Document</h2>

                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            shareDocument();
                        }}
                    >
                        <input
                            type="email"
                            value={shareEmail}
                            onChange={(event) => setShareEmail(event.target.value)}
                            placeholder="Enter email address"
                            required
                        />

                        <select
                            value={sharePermission}
                            onChange={(event) => setSharePermission(event.target.value)}
                        >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                        </select>

                        <button type="submit" disabled={sharing}>
                            {sharing ? "Sharing..." : "Share"}
                        </button>
                    </form>

                    {shareMessage && <p>{shareMessage}</p>}

                    <h3>People with access</h3>

                    {shares.length === 0 ? (
                        <p>This document hasn't been shared with anyone yet.</p>
                    ) : (
                        <ul>
                            {shares.map((share) => (
                                <li key={share.user_id}>
                                    <strong>{share.name}</strong>
                                    {" "}({share.email})

                                    <select
                                        value={share.permission}
                                        onChange={(event) =>
                                            updateSharePermission(
                                                share.user_id,
                                                event.target.value
                                            )
                                        }
                                    >
                                        <option value="viewer">Viewer</option>
                                        <option value="editor">Editor</option>
                                    </select>

                                    <button
                                        type="button"
                                        onClick={() => revokeShare(share.user_id)}
                                    >
                                        Remove
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}
            
            <main className="editor-content">
                <EditorContent editor={editor} />
            </main>
        </div>
    );
}

export default DocumentEditor;