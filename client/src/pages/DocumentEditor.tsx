import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import {
  ArrowLeft,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  List,
  ListOrdered,
  MessageSquare,
  Sparkles,
  Loader2,
  Trash2,
  Check,
  X,
  Bot,
  Cloud,
  CloudOff,
  BriefcaseBusiness,
  Search,
  ShieldCheck,
  Lightbulb,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Separator } from "../components/ui/separator";
import { ScrollArea } from "../components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import { cn } from "../lib/utils";

interface Document {
  id: number;
  projectId: number | null;
  title: string;
  content: string;
  contentJson: any;
  createdAt: string;
  updatedAt: string;
}

interface DocumentComment {
  id: number;
  documentId: number;
  from: number;
  to: number;
  content: string;
  type: string;
  status: string;
  proposedText: string | null;
  aiReply: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

type SaveStatus = "saved" | "saving" | "unsaved" | "error";

export default function DocumentEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [doc, setDoc] = useState<Document | null>(null);
  const [comments, setComments] = useState<DocumentComment[]>([]);
  const [title, setTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [loading, setLoading] = useState(true);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [execReviewLoading, setExecReviewLoading] = useState(false);
  const [factCandidateLoading, setFactCandidateLoading] = useState(false);
  const [factCheckLoading, setFactCheckLoading] = useState(false);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [selectionRange, setSelectionRange] = useState<{ from: number; to: number } | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const docIdRef = useRef<number | null>(id ? Number(id) : null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Start writing..." }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "outline-none min-h-[500px] px-8 py-6",
      },
    },
    onUpdate: ({ editor }) => {
      setSaveStatus("unsaved");
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveDocument(editor.getHTML(), editor.getJSON());
      }, 1500);
    },
  });

  const saveDocument = useCallback(
    async (content: string, contentJson: any) => {
      const currentId = docIdRef.current;
      if (!currentId) return;
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/documents/${currentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, content, contentJson }),
        });
        if (res.ok) {
          setSaveStatus("saved");
        } else {
          setSaveStatus("error");
        }
      } catch {
        setSaveStatus("error");
      }
    },
    [title]
  );

  const fetchComments = useCallback(async (docId: number) => {
    try {
      const res = await fetch(`/api/documents/${docId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    async function init() {
      if (id) {
        try {
          const [docRes, commentsRes] = await Promise.all([
            fetch(`/api/documents/${id}`),
            fetch(`/api/documents/${id}/comments`),
          ]);
          if (docRes.ok) {
            const docData: Document = await docRes.json();
            setDoc(docData);
            setTitle(docData.title);
            docIdRef.current = docData.id;
            if (editor) {
              editor.commands.setContent(docData.content || "");
            }
          }
          if (commentsRes.ok) {
            const commentsData: DocumentComment[] = await commentsRes.json();
            setComments(commentsData);
          }
        } catch {}
      } else {
        try {
          const res = await fetch("/api/documents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "Untitled Document", content: "" }),
          });
          if (res.ok) {
            const newDoc: Document = await res.json();
            docIdRef.current = newDoc.id;
            setDoc(newDoc);
            setTitle(newDoc.title);
            navigate(`/editor/${newDoc.id}`, { replace: true });
          }
        } catch {}
      }
      setLoading(false);
    }
    init();
  }, [id, navigate]);

  useEffect(() => {
    if (editor && doc && !editor.getHTML().trim()) {
      editor.commands.setContent(doc.content || "");
    }
  }, [editor, doc]);

  const handleTitleBlur = useCallback(async () => {
    setEditingTitle(false);
    if (!docIdRef.current || !editor) return;
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/documents/${docIdRef.current}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content: editor.getHTML(),
          contentJson: editor.getJSON(),
        }),
      });
      setSaveStatus(res.ok ? "saved" : "error");
    } catch {
      setSaveStatus("error");
    }
  }, [title, editor]);

  const handleAIReview = useCallback(async () => {
    if (!docIdRef.current) return;
    setReviewLoading(true);
    try {
      const res = await fetch(`/api/documents/${docIdRef.current}/review`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchComments(docIdRef.current);
      }
    } catch {}
    setReviewLoading(false);
  }, [fetchComments]);

  const handleExecutiveReview = useCallback(async () => {
    if (!docIdRef.current) return;
    setExecReviewLoading(true);
    try {
      const res = await fetch(`/api/documents/${docIdRef.current}/executive-review`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchComments(docIdRef.current);
      }
    } catch {}
    setExecReviewLoading(false);
  }, [fetchComments]);

  const handleFactCheckCandidates = useCallback(async () => {
    if (!docIdRef.current) return;
    setFactCandidateLoading(true);
    try {
      const res = await fetch(`/api/documents/${docIdRef.current}/factcheck-candidates`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchComments(docIdRef.current);
      }
    } catch {}
    setFactCandidateLoading(false);
  }, [fetchComments]);

  const handleRunFactCheck = useCallback(async () => {
    if (!docIdRef.current) return;
    setFactCheckLoading(true);
    try {
      const res = await fetch(`/api/documents/${docIdRef.current}/factcheck`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchComments(docIdRef.current);
      }
    } catch {}
    setFactCheckLoading(false);
  }, [fetchComments]);

  const handleNarrativeReview = useCallback(async () => {
    if (!docIdRef.current) return;
    setNarrativeLoading(true);
    try {
      const res = await fetch(`/api/documents/${docIdRef.current}/narrative-review`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchComments(docIdRef.current);
      }
    } catch {}
    setNarrativeLoading(false);
  }, [fetchComments]);

  const handleAddComment = useCallback(async () => {
    if (!docIdRef.current || !selectionRange || !commentText.trim()) return;
    try {
      const res = await fetch(`/api/documents/${docIdRef.current}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: selectionRange.from,
          to: selectionRange.to,
          content: commentText.trim(),
          type: "user",
        }),
      });
      if (res.ok) {
        await fetchComments(docIdRef.current);
      }
    } catch {}
    setCommentText("");
    setCommentDialogOpen(false);
    setSelectionRange(null);
  }, [selectionRange, commentText, fetchComments]);

  const handleDeleteComment = useCallback(
    async (commentId: number) => {
      try {
        await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
        if (docIdRef.current) await fetchComments(docIdRef.current);
      } catch {}
    },
    [fetchComments]
  );

  const handleAcceptComment = useCallback(
    async (comment: DocumentComment) => {
      if (!editor) return;
      setActionLoadingId(comment.id);
      try {
        await fetch(`/api/comments/${comment.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "accepted" }),
        });
        if (comment.type !== "factcheck" && comment.proposedText) {
          const docLength = editor.state.doc.content.size;
          const from = Math.min(comment.from, docLength);
          const to = Math.min(comment.to, docLength);
          editor
            .chain()
            .focus()
            .setTextSelection({ from, to })
            .deleteSelection()
            .insertContent(comment.proposedText)
            .run();
        }
        if (docIdRef.current) await fetchComments(docIdRef.current);
      } catch {}
      setActionLoadingId(null);
    },
    [editor, fetchComments]
  );

  const handleRejectComment = useCallback(
    async (commentId: number) => {
      setActionLoadingId(commentId);
      try {
        await fetch(`/api/comments/${commentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "rejected" }),
        });
        if (docIdRef.current) await fetchComments(docIdRef.current);
      } catch {}
      setActionLoadingId(null);
    },
    [fetchComments]
  );

  const handleGetAIResponse = useCallback(
    async (commentId: number) => {
      if (!docIdRef.current) return;
      setActionLoadingId(commentId);
      try {
        await fetch(
          `/api/documents/${docIdRef.current}/comments/${commentId}/action`,
          { method: "POST" }
        );
        await fetchComments(docIdRef.current);
      } catch {}
      setActionLoadingId(null);
    },
    [fetchComments]
  );

  const handleCommentClick = useCallback(
    (comment: DocumentComment) => {
      if (!editor) return;
      const docLength = editor.state.doc.content.size;
      const from = Math.min(comment.from, docLength);
      const to = Math.min(comment.to, docLength);
      editor.chain().focus().setTextSelection({ from, to }).run();
    },
    [editor]
  );

  const openCommentDialog = useCallback(() => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) return;
    setSelectionRange({ from, to });
    setCommentDialogOpen(true);
  }, [editor]);

  const getHighlightedText = useCallback(
    (comment: DocumentComment) => {
      if (!editor) return "";
      try {
        const docLength = editor.state.doc.content.size;
        const from = Math.min(comment.from, docLength);
        const to = Math.min(comment.to, docLength);
        return editor.state.doc.textBetween(from, to, " ");
      } catch {
        return "";
      }
    },
    [editor]
  );

  const hasSelection = editor ? editor.state.selection.from !== editor.state.selection.to : false;
  const hasAcceptedFactCandidates = comments.some(c => c.type === "factcheck" && c.status === "accepted");
  const hasPendingFactCandidates = comments.some(c => c.type === "factcheck" && c.status === "pending");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col h-screen bg-background text-foreground">
        <div className="sticky top-0 z-20 flex items-center h-14 px-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/projects")}
            className="mr-3"
          >
            <ArrowLeft size={16} />
          </Button>

          {editingTitle ? (
            <Input
              ref={titleInputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTitleBlur();
              }}
              className="max-w-xs h-8 text-sm font-semibold"
              autoFocus
            />
          ) : (
            <button
              className="text-sm font-semibold hover:text-primary transition-colors truncate max-w-xs"
              onClick={() => {
                setEditingTitle(true);
                setTimeout(() => titleInputRef.current?.focus(), 50);
              }}
            >
              {title || "Untitled Document"}
            </button>
          )}

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {saveStatus === "saved" && (
                <>
                  <Cloud size={14} className="text-green-500" />
                  <span>Saved</span>
                </>
              )}
              {saveStatus === "saving" && (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving...</span>
                </>
              )}
              {saveStatus === "unsaved" && (
                <>
                  <CloudOff size={14} className="text-amber-500" />
                  <span>Unsaved</span>
                </>
              )}
              {saveStatus === "error" && (
                <>
                  <CloudOff size={14} className="text-red-500" />
                  <span>Error</span>
                </>
              )}
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={handleFactCheckCandidates}
              disabled={factCandidateLoading}
              className="border-orange-700 text-orange-300 hover:bg-orange-950/50"
            >
              {factCandidateLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Search size={14} />
              )}
              Spot Claims
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleRunFactCheck}
              disabled={factCheckLoading || !hasAcceptedFactCandidates}
              className={cn(
                "border-emerald-700 text-emerald-300 hover:bg-emerald-950/50",
                !hasAcceptedFactCandidates && "opacity-50"
              )}
              title={!hasAcceptedFactCandidates ? "Accept some fact-check candidates first" : "Run fact check on accepted candidates"}
            >
              {factCheckLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ShieldCheck size={14} />
              )}
              Fact Check
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleNarrativeReview}
              disabled={narrativeLoading}
              className="border-teal-700 text-teal-300 hover:bg-teal-950/50"
            >
              {narrativeLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Lightbulb size={14} />
              )}
              Key Narrative
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleExecutiveReview}
              disabled={execReviewLoading}
              className="border-purple-700 text-purple-300 hover:bg-purple-950/50"
            >
              {execReviewLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <BriefcaseBusiness size={14} />
              )}
              Executive Review
            </Button>

            <Button
              size="sm"
              onClick={handleAIReview}
              disabled={reviewLoading}
            >
              {reviewLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              AI Review
            </Button>
          </div>
        </div>

        <div className="sticky top-14 z-10 flex items-center gap-0.5 px-4 py-1.5 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 overflow-x-auto">
          <ToolbarButton
            icon={<Bold size={16} />}
            tooltip="Bold"
            active={editor?.isActive("bold")}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            icon={<Italic size={16} />}
            tooltip="Italic"
            active={editor?.isActive("italic")}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          />
          <ToolbarButton
            icon={<UnderlineIcon size={16} />}
            tooltip="Underline"
            active={editor?.isActive("underline")}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
          />
          <ToolbarButton
            icon={<Strikethrough size={16} />}
            tooltip="Strikethrough"
            active={editor?.isActive("strike")}
            onClick={() => editor?.chain().focus().toggleStrike().run()}
          />

          <Separator orientation="vertical" className="mx-1.5 h-6" />

          <ToolbarButton
            icon={<Heading1 size={16} />}
            tooltip="Heading 1"
            active={editor?.isActive("heading", { level: 1 })}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 1 }).run()
            }
          />
          <ToolbarButton
            icon={<Heading2 size={16} />}
            tooltip="Heading 2"
            active={editor?.isActive("heading", { level: 2 })}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 2 }).run()
            }
          />
          <ToolbarButton
            icon={<Heading3 size={16} />}
            tooltip="Heading 3"
            active={editor?.isActive("heading", { level: 3 })}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 3 }).run()
            }
          />

          <Separator orientation="vertical" className="mx-1.5 h-6" />

          <ToolbarButton
            icon={<AlignLeft size={16} />}
            tooltip="Align Left"
            active={editor?.isActive({ textAlign: "left" })}
            onClick={() =>
              editor?.chain().focus().setTextAlign("left").run()
            }
          />
          <ToolbarButton
            icon={<AlignCenter size={16} />}
            tooltip="Align Center"
            active={editor?.isActive({ textAlign: "center" })}
            onClick={() =>
              editor?.chain().focus().setTextAlign("center").run()
            }
          />
          <ToolbarButton
            icon={<AlignRight size={16} />}
            tooltip="Align Right"
            active={editor?.isActive({ textAlign: "right" })}
            onClick={() =>
              editor?.chain().focus().setTextAlign("right").run()
            }
          />

          <Separator orientation="vertical" className="mx-1.5 h-6" />

          <ToolbarButton
            icon={<Highlighter size={16} />}
            tooltip="Highlight"
            active={editor?.isActive("highlight")}
            onClick={() =>
              editor?.chain().focus().toggleHighlight().run()
            }
          />

          <Separator orientation="vertical" className="mx-1.5 h-6" />

          <ToolbarButton
            icon={<List size={16} />}
            tooltip="Bullet List"
            active={editor?.isActive("bulletList")}
            onClick={() =>
              editor?.chain().focus().toggleBulletList().run()
            }
          />
          <ToolbarButton
            icon={<ListOrdered size={16} />}
            tooltip="Ordered List"
            active={editor?.isActive("orderedList")}
            onClick={() =>
              editor?.chain().focus().toggleOrderedList().run()
            }
          />

          <Separator orientation="vertical" className="mx-1.5 h-6" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", !hasSelection && "opacity-40")}
                disabled={!hasSelection}
                onClick={openCommentDialog}
              >
                <MessageSquare size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add Comment</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl py-8">
              <style>{`
                .ProseMirror {
                  color: hsl(var(--foreground));
                  font-size: 16px;
                  line-height: 1.75;
                }
                .ProseMirror h1 {
                  font-size: 2em;
                  font-weight: 700;
                  margin-top: 1.5em;
                  margin-bottom: 0.5em;
                  line-height: 1.2;
                }
                .ProseMirror h2 {
                  font-size: 1.5em;
                  font-weight: 600;
                  margin-top: 1.25em;
                  margin-bottom: 0.5em;
                  line-height: 1.3;
                }
                .ProseMirror h3 {
                  font-size: 1.25em;
                  font-weight: 600;
                  margin-top: 1em;
                  margin-bottom: 0.5em;
                  line-height: 1.4;
                }
                .ProseMirror p {
                  margin-bottom: 0.75em;
                }
                .ProseMirror ul,
                .ProseMirror ol {
                  padding-left: 1.5em;
                  margin-bottom: 0.75em;
                }
                .ProseMirror li {
                  margin-bottom: 0.25em;
                }
                .ProseMirror blockquote {
                  border-left: 3px solid hsl(var(--border));
                  padding-left: 1em;
                  margin-left: 0;
                  color: hsl(var(--muted-foreground));
                  font-style: italic;
                }
                .ProseMirror code {
                  background: hsl(var(--muted));
                  padding: 0.15em 0.3em;
                  border-radius: 4px;
                  font-size: 0.9em;
                }
                .ProseMirror pre {
                  background: hsl(var(--muted));
                  padding: 1em;
                  border-radius: 8px;
                  overflow-x: auto;
                  margin-bottom: 0.75em;
                }
                .ProseMirror pre code {
                  background: none;
                  padding: 0;
                }
                .ProseMirror mark {
                  background-color: hsl(50, 100%, 50%);
                  color: black;
                  border-radius: 2px;
                  padding: 0 2px;
                }
                .ProseMirror p.is-editor-empty:first-child::before {
                  content: attr(data-placeholder);
                  float: left;
                  color: hsl(var(--muted-foreground));
                  pointer-events: none;
                  height: 0;
                }
                .ProseMirror:focus {
                  outline: none;
                }
                .ProseMirror strong {
                  font-weight: 700;
                }
                .ProseMirror em {
                  font-style: italic;
                }
                .ProseMirror s {
                  text-decoration: line-through;
                }
                .ProseMirror u {
                  text-decoration: underline;
                }
                .ProseMirror hr {
                  border: none;
                  border-top: 1px solid hsl(var(--border));
                  margin: 1.5em 0;
                }
              `}</style>
              <EditorContent editor={editor} />
            </div>
          </div>

          <div className="w-80 border-l flex flex-col bg-background/50">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="text-sm font-semibold">Comments</h3>
              <Badge variant="secondary">{comments.length}</Badge>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-3">
                {comments.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare
                      size={32}
                      strokeWidth={1.5}
                      className="mx-auto mb-2 opacity-50"
                    />
                    <p className="text-xs">No comments yet</p>
                    <p className="text-xs mt-1">
                      Select text and click the comment button, or run AI Review
                    </p>
                  </div>
                )}
                {comments.map((comment) => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    highlightedText={getHighlightedText(comment)}
                    onCommentClick={handleCommentClick}
                    onDelete={handleDeleteComment}
                    onAccept={handleAcceptComment}
                    onReject={handleRejectComment}
                    onGetAIResponse={handleGetAIResponse}
                    actionLoadingId={actionLoadingId}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <Dialog open={commentDialogOpen} onOpenChange={setCommentDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Comment</DialogTitle>
            </DialogHeader>
            <Textarea
              placeholder="Write your comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="min-h-[100px]"
              autoFocus
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCommentDialogOpen(false);
                  setCommentText("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddComment}
                disabled={!commentText.trim()}
              >
                Add Comment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

function ToolbarButton({
  icon,
  tooltip,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  tooltip: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8",
            active && "bg-accent text-accent-foreground"
          )}
          onClick={onClick}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function CommentCard({
  comment,
  highlightedText,
  onCommentClick,
  onDelete,
  onAccept,
  onReject,
  onGetAIResponse,
  actionLoadingId,
}: {
  comment: DocumentComment;
  highlightedText: string;
  onCommentClick: (c: DocumentComment) => void;
  onDelete: (id: number) => void;
  onAccept: (c: DocumentComment) => void;
  onReject: (id: number) => void;
  onGetAIResponse: (id: number) => void;
  actionLoadingId: number | null;
}) {
  const isAI = comment.type === "ai" || comment.type === "review";
  const isExecutive = comment.type === "executive";
  const isFactCheck = comment.type === "factcheck";
  const isNarrative = comment.type === "narrative";
  const isLoading = actionLoadingId === comment.id;

  const statusVariant =
    comment.status === "accepted"
      ? "success"
      : comment.status === "rejected"
        ? "destructive"
        : "secondary";

  const borderColor = isNarrative
    ? "border-l-teal-500"
    : isFactCheck
      ? "border-l-orange-500"
      : isExecutive
        ? "border-l-purple-500"
        : isAI
          ? "border-l-amber-500"
          : "border-l-blue-500";

  const iconColor = isNarrative
    ? "text-teal-500"
    : isFactCheck
      ? "text-orange-500"
      : isExecutive
        ? "text-purple-500"
        : isAI
          ? "text-amber-500"
          : "text-blue-500";

  const label = isNarrative ? "Narrative" : isFactCheck ? "Fact Check" : isExecutive ? "Executive" : isAI ? "AI" : "You";

  return (
    <Card
      className={cn(
        "p-3 cursor-pointer hover:bg-accent/30 transition-colors border-l-[3px]",
        borderColor
      )}
      onClick={() => onCommentClick(comment)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          {isNarrative ? (
            <Lightbulb size={14} className={cn(iconColor, "shrink-0")} />
          ) : isFactCheck ? (
            <Search size={14} className={cn(iconColor, "shrink-0")} />
          ) : isExecutive ? (
            <BriefcaseBusiness size={14} className={cn(iconColor, "shrink-0")} />
          ) : isAI ? (
            <Bot size={14} className={cn(iconColor, "shrink-0")} />
          ) : (
            <MessageSquare size={14} className={cn(iconColor, "shrink-0")} />
          )}
          <span className="text-xs font-medium text-muted-foreground">
            {label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Badge variant={statusVariant} className="text-[10px] px-1.5 py-0">
            {comment.status}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(comment.id);
            }}
          >
            <Trash2 size={12} />
          </Button>
        </div>
      </div>

      {highlightedText && (
        <div className="text-xs bg-muted/50 rounded px-2 py-1.5 mb-2 italic text-muted-foreground line-clamp-2 border-l-2 border-muted-foreground/30">
          "{highlightedText}"
        </div>
      )}

      <p className="text-sm mb-2">{comment.content}</p>

      {isFactCheck && comment.status === "pending" && !comment.aiReply && (
        <div className="space-y-2">
          <div className="text-xs bg-orange-950/30 border border-orange-800/30 rounded px-2 py-1.5">
            <span className="text-orange-400 font-medium text-[10px] uppercase tracking-wider">
              Approve this claim for fact-checking?
            </span>
          </div>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs flex-1 text-orange-400 border-orange-800 hover:bg-orange-950/50"
              onClick={(e) => {
                e.stopPropagation();
                onAccept(comment);
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Check size={12} />
              )}
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs flex-1 text-red-400 border-red-800 hover:bg-red-950/50"
              onClick={(e) => {
                e.stopPropagation();
                onReject(comment.id);
              }}
              disabled={isLoading}
            >
              <X size={12} />
              Decline
            </Button>
          </div>
        </div>
      )}

      {isFactCheck && comment.status === "accepted" && !comment.aiReply && (
        <div className="text-xs bg-orange-950/20 border border-orange-800/20 rounded px-2 py-1.5 mt-1">
          <span className="text-orange-300 font-medium text-[10px] uppercase tracking-wider">
            Queued for fact check
          </span>
        </div>
      )}

      {!isFactCheck && comment.proposedText && comment.status === "pending" && (
        <div className="space-y-2">
          <div className={cn(
            "text-xs rounded px-2 py-1.5",
            isNarrative
              ? "bg-teal-950/30 border border-teal-800/30"
              : isExecutive
                ? "bg-purple-950/30 border border-purple-800/30"
                : "bg-green-950/30 border border-green-800/30"
          )}>
            <span className={cn(
              "font-medium text-[10px] uppercase tracking-wider",
              isNarrative ? "text-teal-400" : isExecutive ? "text-purple-400" : "text-green-400"
            )}>
              {isNarrative ? "Executive Key Point:" : "Proposed:"}
            </span>
            <p className={cn("mt-0.5", isNarrative ? "text-teal-300" : isExecutive ? "text-purple-300" : "text-green-300")}>{comment.proposedText}</p>
          </div>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs flex-1 text-green-400 border-green-800 hover:bg-green-950/50"
              onClick={(e) => {
                e.stopPropagation();
                onAccept(comment);
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Check size={12} />
              )}
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs flex-1 text-red-400 border-red-800 hover:bg-red-950/50"
              onClick={(e) => {
                e.stopPropagation();
                onReject(comment.id);
              }}
              disabled={isLoading}
            >
              <X size={12} />
              Reject
            </Button>
          </div>
        </div>
      )}

      {comment.aiReply && (
        <div className={cn(
          "text-xs rounded px-2 py-1.5 mt-1",
          isFactCheck
            ? "bg-emerald-950/30 border border-emerald-800/30"
            : "bg-amber-950/30 border border-amber-800/30"
        )}>
          <span className={cn(
            "font-medium text-[10px] uppercase tracking-wider",
            isFactCheck ? "text-emerald-400" : "text-amber-400"
          )}>
            {isFactCheck ? "Fact Check Result:" : "AI Response:"}
          </span>
          <p className={cn("mt-0.5", isFactCheck ? "text-emerald-200" : "text-amber-200")}>{comment.aiReply}</p>
        </div>
      )}

      {!isAI && !isExecutive && !isFactCheck && !isNarrative && !comment.aiReply && comment.status === "pending" && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs w-full mt-1"
          onClick={(e) => {
            e.stopPropagation();
            onGetAIResponse(comment.id);
          }}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Sparkles size={12} />
          )}
          Get AI Response
        </Button>
      )}
    </Card>
  );
}
