
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

    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline
        ],
        content: "",
        immediatelyRender: false
    });

    useEffect(() => {
        async function fetchDocument() {
            try {
                setLoading(true);
                setError("");

                const response = await fetch(
                    `http://localhost:3000/api/documents/${id}`
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message || "Failed to retrieve document."
                    );
                }

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

    useEffect(() => {
        if (editor && document) {
            editor.commands.setContent(document.content);
        }
    }, [editor, document]);

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

        // Update the document displayed in the editor.
        setDocument(data.document);
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
                method: "DELETE"
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

    <button
        onClick={saveDocument}
        disabled={saving}
    >
        {saving ? "Saving..." : "Save"}
    </button>

    <button
    onClick={deleteDocument}
    disabled={deleting}
>
    {deleting ? "Deleting..." : "Delete"}
</button>

{deleteMessage && <p>{deleteMessage}</p>}

    {saveMessage && <p>{saveMessage}</p>}
</header>

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

            <main className="editor-content">
                <EditorContent editor={editor} />
            </main>
        </div>
    );
}

export default DocumentEditor;