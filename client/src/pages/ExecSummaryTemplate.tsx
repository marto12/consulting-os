import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "../lib/query-client";
import { Save, RotateCcw, Loader2, FileText, Eye, Code } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardContent } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { cn } from "../lib/utils";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

export default function ExecSummaryTemplate() {
  const [viewMode, setViewMode] = useState<"visual" | "html">("visual");
  const [htmlSource, setHtmlSource] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  const { data, isLoading, error } = useQuery<{ id?: number; template: string }>({
    queryKey: ["/api/exec-summary-template"],
  });

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    onUpdate: () => {
      setHasChanges(true);
    },
  });

  useEffect(() => {
    if (data?.template && editor) {
      editor.commands.setContent(data.template);
      setHtmlSource(data.template);
      setHasChanges(false);
    }
  }, [data, editor]);

  const saveMutation = useMutation({
    mutationFn: async (template: string) => {
      await apiRequest("PUT", "/api/exec-summary-template", { template });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exec-summary-template"] });
      setHasChanges(false);
    },
  });

  const handleSave = useCallback(() => {
    if (!editor) return;
    const html = viewMode === "html" ? htmlSource : editor.getHTML();
    saveMutation.mutate(html);
  }, [editor, viewMode, htmlSource, saveMutation]);

  const handleReset = useCallback(() => {
    if (data?.template && editor) {
      editor.commands.setContent(data.template);
      setHtmlSource(data.template);
      setHasChanges(false);
    }
  }, [data, editor]);

  const handleViewToggle = useCallback((mode: "visual" | "html") => {
    if (!editor) return;
    if (mode === "html" && viewMode === "visual") {
      setHtmlSource(editor.getHTML());
    } else if (mode === "visual" && viewMode === "html") {
      editor.commands.setContent(htmlSource);
    }
    setViewMode(mode);
  }, [editor, viewMode, htmlSource]);

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-3 w-full" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-4 w-40" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-10/12" />
              <Skeleton className="h-4 w-9/12" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-destructive">Failed to load template.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Executive Summary Template
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            This template controls the format of the final executive summary output. Edit the headings and structure — the AI will fill in the bracketed placeholders with real analysis.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-md overflow-hidden">
            <button
              onClick={() => handleViewToggle("visual")}
              className={cn(
                "px-3 py-1.5 text-xs flex items-center gap-1 transition-colors",
                viewMode === "visual" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              <Eye className="w-3.5 h-3.5" /> Visual
            </button>
            <button
              onClick={() => handleViewToggle("html")}
              className={cn(
                "px-3 py-1.5 text-xs flex items-center gap-1 transition-colors",
                viewMode === "html" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              <Code className="w-3.5 h-3.5" /> HTML
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!hasChanges}
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5 mr-1" />
            )}
            Save
          </Button>
        </div>
      </div>

      {saveMutation.isSuccess && !hasChanges && (
        <div className="text-xs text-green-600 bg-green-50 dark:bg-green-950/30 px-3 py-1.5 rounded">
          Template saved successfully.
        </div>
      )}

      <Card>
        <CardHeader className="py-3 px-4">
          <p className="text-xs text-muted-foreground">
            Each <code className="text-xs bg-muted px-1 rounded">[bracketed text]</code> is a placeholder the AI will replace. Edit headings and structure as needed.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {viewMode === "visual" ? (
            <div className="prose prose-sm dark:prose-invert max-w-none p-4 min-h-[400px] border-t">
              <EditorContent editor={editor} />
            </div>
          ) : (
            <textarea
              value={htmlSource}
              onChange={(e) => {
                setHtmlSource(e.target.value);
                setHasChanges(true);
              }}
              className="w-full min-h-[400px] p-4 font-mono text-xs border-t bg-muted/30 resize-y focus:outline-none"
              spellCheck={false}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
