import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Plus, Trash2, ChevronLeft, Type, Image, Square, Layout,
  Bold, Italic, AlignLeft, AlignCenter, AlignRight,
  Palette, Save, Loader2, GripVertical, FileText,
  Maximize2, Minimize2, ChevronUp, ChevronDown,
  Sparkles,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";

interface SlideElement {
  id: string;
  type: "text" | "image" | "shape";
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: string;
  color?: string;
  bgColor?: string;
  borderRadius?: number;
}

interface Slide {
  id: number;
  presentationId: number | null;
  slideIndex: number;
  layout: string;
  title: string;
  subtitle: string | null;
  bodyJson: any;
  elements: SlideElement[];
  notesText: string | null;
}

interface Presentation {
  id: number;
  title: string;
  theme: {
    bgColor: string;
    textColor: string;
    accentColor: string;
    fontFamily: string;
  };
  slides: Slide[];
}

const LAYOUTS = [
  { key: "title_only", label: "Title Slide", icon: "T" },
  { key: "title_body", label: "Title + Body", icon: "TB" },
  { key: "two_column", label: "Two Columns", icon: "2C" },
  { key: "blank", label: "Blank", icon: "--" },
];

const SLIDE_W = 960;
const SLIDE_H = 540;

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function defaultElementsForLayout(layout: string, theme: Presentation["theme"]): SlideElement[] {
  switch (layout) {
    case "title_only":
      return [
        { id: generateId(), type: "text", x: 80, y: 180, width: 800, height: 80, content: "Presentation Title", fontSize: 44, fontWeight: "bold", textAlign: "center", color: theme.textColor },
        { id: generateId(), type: "text", x: 200, y: 280, width: 560, height: 40, content: "Subtitle goes here", fontSize: 22, fontWeight: "normal", textAlign: "center", color: theme.textColor + "99" },
      ];
    case "title_body":
      return [
        { id: generateId(), type: "text", x: 60, y: 40, width: 840, height: 60, content: "Slide Title", fontSize: 36, fontWeight: "bold", textAlign: "left", color: theme.textColor },
        { id: generateId(), type: "text", x: 60, y: 120, width: 840, height: 360, content: "Click to add content...", fontSize: 20, fontWeight: "normal", textAlign: "left", color: theme.textColor },
      ];
    case "two_column":
      return [
        { id: generateId(), type: "text", x: 60, y: 40, width: 840, height: 60, content: "Slide Title", fontSize: 36, fontWeight: "bold", textAlign: "left", color: theme.textColor },
        { id: generateId(), type: "text", x: 60, y: 120, width: 400, height: 360, content: "Left column content", fontSize: 18, fontWeight: "normal", textAlign: "left", color: theme.textColor },
        { id: generateId(), type: "text", x: 500, y: 120, width: 400, height: 360, content: "Right column content", fontSize: 18, fontWeight: "normal", textAlign: "left", color: theme.textColor },
      ];
    case "blank":
      return [];
    default:
      return [];
  }
}

export default function SlideEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pres, setPres] = useState<Presentation | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [editingElement, setEditingElement] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [titleEditing, setTitleEditing] = useState(false);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState("");
  const [documents, setDocuments] = useState<any[]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ elId: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ elId: string; startX: number; startY: number; origW: number; origH: number } | null>(null);

  useEffect(() => {
    fetch(`/api/presentations/${id}`)
      .then(r => r.json())
      .then(data => {
        const slidesWithElements = (data.slides || []).map((s: any) => ({
          ...s,
          elements: s.elements || [],
        }));
        setPres({ ...data, slides: slidesWithElements });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const activeSlide = pres?.slides[activeSlideIndex] || null;

  const saveSlide = useCallback(async (slide: Slide) => {
    setSaving(true);
    try {
      await fetch(`/api/slides/${slide.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: slide.title,
          subtitle: slide.subtitle,
          layout: slide.layout,
          bodyJson: slide.bodyJson,
          elements: slide.elements,
          notesText: slide.notesText,
        }),
      });
    } catch {}
    setSaving(false);
  }, []);

  const saveTitle = useCallback(async (title: string) => {
    if (!pres) return;
    await fetch(`/api/presentations/${pres.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
  }, [pres]);

  const updateSlideLocal = useCallback((slideIndex: number, updates: Partial<Slide>) => {
    setPres(prev => {
      if (!prev) return prev;
      const newSlides = [...prev.slides];
      newSlides[slideIndex] = { ...newSlides[slideIndex], ...updates };
      return { ...prev, slides: newSlides };
    });
  }, []);

  const updateElement = useCallback((elId: string, updates: Partial<SlideElement>) => {
    setPres(prev => {
      if (!prev) return prev;
      const newSlides = [...prev.slides];
      const slide = { ...newSlides[activeSlideIndex] };
      slide.elements = slide.elements.map(el =>
        el.id === elId ? { ...el, ...updates } : el
      );
      newSlides[activeSlideIndex] = slide;
      return { ...prev, slides: newSlides };
    });
  }, [activeSlideIndex]);

  const addSlide = useCallback(async (layout: string = "title_body") => {
    if (!pres) return;
    const theme = pres.theme || { bgColor: "#fff", textColor: "#1a1a2e", accentColor: "#3b82f6", fontFamily: "Inter" };
    const elements = defaultElementsForLayout(layout, theme);
    const res = await fetch(`/api/presentations/${pres.id}/slides`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        layout,
        title: layout === "title_only" ? "Title Slide" : "New Slide",
        bodyJson: {},
        elements,
      }),
    });
    const newSlide = await res.json();
    newSlide.elements = newSlide.elements || elements;
    setPres(prev => prev ? { ...prev, slides: [...prev.slides, newSlide] } : prev);
    setActiveSlideIndex(pres.slides.length);
  }, [pres]);

  const deleteSlide = useCallback(async (slideId: number, idx: number) => {
    if (!pres || pres.slides.length <= 1) return;
    await fetch(`/api/slides/${slideId}`, { method: "DELETE" });
    setPres(prev => {
      if (!prev) return prev;
      const newSlides = prev.slides.filter((_, i) => i !== idx);
      return { ...prev, slides: newSlides };
    });
    if (activeSlideIndex >= idx && activeSlideIndex > 0) {
      setActiveSlideIndex(activeSlideIndex - 1);
    }
  }, [pres, activeSlideIndex]);

  const addElement = useCallback((type: "text" | "shape") => {
    if (!pres || !activeSlide) return;
    const theme = pres.theme;
    const el: SlideElement = {
      id: generateId(),
      type,
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 100,
      width: type === "text" ? 400 : 200,
      height: type === "text" ? 60 : 120,
      content: type === "text" ? "New text" : "",
      fontSize: type === "text" ? 20 : undefined,
      fontWeight: "normal",
      textAlign: "left",
      color: theme.textColor,
      bgColor: type === "shape" ? theme.accentColor + "22" : undefined,
      borderRadius: type === "shape" ? 8 : 0,
    };
    updateSlideLocal(activeSlideIndex, {
      elements: [...(activeSlide.elements || []), el],
    });
    setSelectedElement(el.id);
  }, [pres, activeSlide, activeSlideIndex, updateSlideLocal]);

  const deleteElement = useCallback((elId: string) => {
    if (!activeSlide) return;
    updateSlideLocal(activeSlideIndex, {
      elements: activeSlide.elements.filter(e => e.id !== elId),
    });
    setSelectedElement(null);
    setEditingElement(null);
  }, [activeSlide, activeSlideIndex, updateSlideLocal]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-element-id]")) return;
    setSelectedElement(null);
    setEditingElement(null);
  }, []);

  const handleElementMouseDown = useCallback((e: React.MouseEvent, elId: string) => {
    e.stopPropagation();
    if (editingElement === elId) return;
    setSelectedElement(elId);
    const el = activeSlide?.elements.find(e => e.id === elId);
    if (!el) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scaleX = SLIDE_W / rect.width;
    const scaleY = SLIDE_H / rect.height;
    dragRef.current = {
      elId,
      startX: e.clientX,
      startY: e.clientY,
      origX: el.x,
      origY: el.y,
    };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = (ev.clientX - dragRef.current.startX) * scaleX;
      const dy = (ev.clientY - dragRef.current.startY) * scaleY;
      updateElement(elId, {
        x: Math.max(0, Math.min(SLIDE_W - 50, dragRef.current.origX + dx)),
        y: Math.max(0, Math.min(SLIDE_H - 20, dragRef.current.origY + dy)),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [activeSlide, editingElement, updateElement]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, elId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const el = activeSlide?.elements.find(e => e.id === elId);
    if (!el) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scaleX = SLIDE_W / rect.width;
    const scaleY = SLIDE_H / rect.height;
    resizeRef.current = {
      elId,
      startX: e.clientX,
      startY: e.clientY,
      origW: el.width,
      origH: el.height,
    };

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const dw = (ev.clientX - resizeRef.current.startX) * scaleX;
      const dh = (ev.clientY - resizeRef.current.startY) * scaleY;
      updateElement(elId, {
        width: Math.max(40, resizeRef.current.origW + dw),
        height: Math.max(20, resizeRef.current.origH + dh),
      });
    };
    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [activeSlide, updateElement]);

  const handleSave = useCallback(() => {
    if (!activeSlide) return;
    saveSlide(activeSlide);
  }, [activeSlide, saveSlide]);

  useEffect(() => {
    if (!activeSlide) return;
    const timer = setTimeout(() => saveSlide(activeSlide), 1500);
    return () => clearTimeout(timer);
  }, [activeSlide?.elements, activeSlide?.title, activeSlide?.subtitle]);

  const loadDocs = useCallback(async () => {
    const res = await fetch("/api/documents");
    const docs = await res.json();
    setDocuments(docs);
    setShowDocPicker(true);
  }, []);

  const generateFromDocument = useCallback(async (docId: number) => {
    if (!pres) return;
    setShowDocPicker(false);
    setGenerating(true);
    setGenStatus("Starting...");

    try {
      const response = await fetch(`/api/presentations/${pres.id}/generate-from-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: docId }),
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        for (const line of text.split("\n")) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.status) setGenStatus(data.message || data.status);
              if (data.done) {
                const refreshRes = await fetch(`/api/presentations/${pres.id}`);
                const refreshData = await refreshRes.json();
                const slidesWithElements = (refreshData.slides || []).map((s: any) => ({
                  ...s,
                  elements: s.elements || [],
                }));
                setPres({ ...refreshData, slides: slidesWithElements });
                setActiveSlideIndex(0);
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
    setGenerating(false);
    setGenStatus("");
  }, [pres]);

  const moveSlide = useCallback(async (idx: number, direction: -1 | 1) => {
    if (!pres) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= pres.slides.length) return;
    const newSlides = [...pres.slides];
    [newSlides[idx], newSlides[newIdx]] = [newSlides[newIdx], newSlides[idx]];
    const slideIds = newSlides.map(s => s.id);
    setPres({ ...pres, slides: newSlides });
    if (activeSlideIndex === idx) setActiveSlideIndex(newIdx);
    else if (activeSlideIndex === newIdx) setActiveSlideIndex(idx);
    await fetch(`/api/presentations/${pres.id}/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slideIds }),
    });
  }, [pres, activeSlideIndex]);

  const selectedEl = activeSlide?.elements.find(e => e.id === selectedElement) || null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (!pres) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        Presentation not found
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top Toolbar */}
      <div className="h-12 border-b flex items-center px-3 gap-2 shrink-0 bg-background z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate("/presentations")}>
          <ChevronLeft size={18} />
        </Button>
        {titleEditing ? (
          <input
            className="text-sm font-semibold bg-transparent border-b border-primary outline-none px-1"
            defaultValue={pres.title}
            autoFocus
            onBlur={(e) => {
              setTitleEditing(false);
              const val = e.target.value.trim() || "Untitled";
              setPres(prev => prev ? { ...prev, title: val } : prev);
              saveTitle(val);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        ) : (
          <button className="text-sm font-semibold hover:text-primary transition-colors" onClick={() => setTitleEditing(true)}>
            {pres.title}
          </button>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-1 border-l pl-2 ml-2">
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => addElement("text")}>
            <Type size={14} />
            Text
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => addElement("shape")}>
            <Square size={14} />
            Shape
          </Button>
        </div>

        {selectedEl && (
          <div className="flex items-center gap-1 border-l pl-2 ml-1">
            {selectedEl.type === "text" && (
              <>
                <Button
                  variant={selectedEl.fontWeight === "bold" ? "secondary" : "ghost"}
                  size="icon" className="h-8 w-8"
                  onClick={() => updateElement(selectedEl.id, { fontWeight: selectedEl.fontWeight === "bold" ? "normal" : "bold" })}
                >
                  <Bold size={14} />
                </Button>
                <Button
                  variant={selectedEl.fontStyle === "italic" ? "secondary" : "ghost"}
                  size="icon" className="h-8 w-8"
                  onClick={() => updateElement(selectedEl.id, { fontStyle: selectedEl.fontStyle === "italic" ? "normal" : "italic" })}
                >
                  <Italic size={14} />
                </Button>
                <div className="w-px h-5 bg-border mx-1" />
                <Button variant={selectedEl.textAlign === "left" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => updateElement(selectedEl.id, { textAlign: "left" })}>
                  <AlignLeft size={14} />
                </Button>
                <Button variant={selectedEl.textAlign === "center" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => updateElement(selectedEl.id, { textAlign: "center" })}>
                  <AlignCenter size={14} />
                </Button>
                <Button variant={selectedEl.textAlign === "right" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => updateElement(selectedEl.id, { textAlign: "right" })}>
                  <AlignRight size={14} />
                </Button>
                <div className="w-px h-5 bg-border mx-1" />
                <select
                  className="h-8 text-xs bg-muted rounded px-2 border-none outline-none"
                  value={selectedEl.fontSize || 20}
                  onChange={(e) => updateElement(selectedEl.id, { fontSize: Number(e.target.value) })}
                >
                  {[12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 72].map(s => (
                    <option key={s} value={s}>{s}px</option>
                  ))}
                </select>
                <input
                  type="color"
                  className="w-7 h-7 rounded cursor-pointer border-none"
                  value={selectedEl.color || "#000000"}
                  onChange={(e) => updateElement(selectedEl.id, { color: e.target.value })}
                />
              </>
            )}
            {selectedEl.type === "shape" && (
              <input
                type="color"
                className="w-7 h-7 rounded cursor-pointer border-none"
                value={selectedEl.bgColor || "#3b82f6"}
                onChange={(e) => updateElement(selectedEl.id, { bgColor: e.target.value })}
              />
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteElement(selectedEl.id)}>
              <Trash2 size={14} />
            </Button>
          </div>
        )}

        <div className="flex items-center gap-1 border-l pl-2 ml-1">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={loadDocs} disabled={generating}>
            <Sparkles size={14} />
            From Document
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          </Button>
        </div>
      </div>

      {/* Generating overlay */}
      {generating && (
        <div className="bg-primary/10 border-b px-4 py-2 text-sm flex items-center gap-2 text-primary">
          <Loader2 size={14} className="animate-spin" />
          {genStatus}
        </div>
      )}

      {/* Doc picker modal */}
      {showDocPicker && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setShowDocPicker(false)}>
          <div className="bg-background rounded-xl border shadow-xl w-[480px] max-h-[60vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b font-semibold text-sm flex items-center gap-2">
              <FileText size={16} />
              Select a Document
            </div>
            <div className="overflow-y-auto max-h-[400px]">
              {documents.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No documents found. Create one in the Word Processor first.
                </div>
              ) : (
                documents.map(doc => (
                  <button
                    key={doc.id}
                    className="w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b last:border-b-0 flex items-center gap-3"
                    onClick={() => generateFromDocument(doc.id)}
                  >
                    <FileText size={16} className="shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{doc.title}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {doc.content?.replace(/<[^>]*>/g, "").slice(0, 80) || "Empty"}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Slide Thumbnails Sidebar */}
        <div className="w-[200px] border-r bg-muted/30 flex flex-col shrink-0">
          <div className="p-2 border-b flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 text-xs flex-1 gap-1" onClick={() => addSlide("title_body")}>
              <Plus size={12} />
              Add Slide
            </Button>
            <div className="relative group">
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Layout size={12} />
              </Button>
              <div className="hidden group-hover:block absolute top-full left-0 z-50 bg-popover border rounded-lg shadow-lg p-1 w-32">
                {LAYOUTS.map(l => (
                  <button
                    key={l.key}
                    className="w-full text-left text-xs px-2 py-1.5 hover:bg-accent rounded transition-colors"
                    onClick={() => addSlide(l.key)}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {pres.slides.map((slide, idx) => (
              <div
                key={slide.id}
                className={cn(
                  "relative group cursor-pointer rounded-lg border-2 transition-all",
                  activeSlideIndex === idx ? "border-primary shadow-md" : "border-transparent hover:border-border"
                )}
                onClick={() => { setActiveSlideIndex(idx); setSelectedElement(null); setEditingElement(null); }}
              >
                <div className="text-[8px] absolute top-1 left-1 text-muted-foreground font-mono z-10 bg-background/80 rounded px-1">
                  {idx + 1}
                </div>
                {/* Thumbnail preview */}
                <div
                  className="rounded-md overflow-hidden"
                  style={{
                    aspectRatio: "16/9",
                    backgroundColor: pres.theme.bgColor,
                  }}
                >
                  <div className="w-full h-full relative" style={{ transform: `scale(${176 / SLIDE_W})`, transformOrigin: "top left", width: SLIDE_W, height: SLIDE_H }}>
                    {(slide.elements || []).map(el => (
                      <div
                        key={el.id}
                        style={{
                          position: "absolute",
                          left: el.x,
                          top: el.y,
                          width: el.width,
                          height: el.height,
                          fontSize: el.fontSize || 20,
                          fontWeight: el.fontWeight || "normal",
                          fontStyle: el.fontStyle || "normal",
                          textAlign: (el.textAlign || "left") as any,
                          color: el.color || pres.theme.textColor,
                          backgroundColor: el.bgColor,
                          borderRadius: el.borderRadius,
                          overflow: "hidden",
                          lineHeight: 1.3,
                        }}
                      >
                        {el.type === "text" ? el.content : ""}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Slide controls */}
                <div className="absolute top-1 right-1 hidden group-hover:flex gap-0.5">
                  <button className="p-0.5 rounded bg-background/80 hover:bg-background" onClick={(e) => { e.stopPropagation(); moveSlide(idx, -1); }}>
                    <ChevronUp size={10} />
                  </button>
                  <button className="p-0.5 rounded bg-background/80 hover:bg-background" onClick={(e) => { e.stopPropagation(); moveSlide(idx, 1); }}>
                    <ChevronDown size={10} />
                  </button>
                  {pres.slides.length > 1 && (
                    <button className="p-0.5 rounded bg-background/80 hover:text-destructive" onClick={(e) => { e.stopPropagation(); deleteSlide(slide.id, idx); }}>
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Canvas */}
        <div className="flex-1 flex items-center justify-center bg-muted/20 overflow-auto p-8">
          {activeSlide ? (
            <div
              ref={canvasRef}
              className="relative shadow-2xl rounded-lg overflow-hidden select-none"
              style={{
                width: "min(100%, 960px)",
                aspectRatio: "16/9",
                backgroundColor: pres.theme.bgColor,
              }}
              onMouseDown={handleCanvasMouseDown}
            >
              {(activeSlide.elements || []).map(el => (
                <div
                  key={el.id}
                  data-element-id={el.id}
                  className={cn(
                    "absolute group/el cursor-move",
                    selectedElement === el.id && "ring-2 ring-primary ring-offset-1",
                  )}
                  style={{
                    left: `${(el.x / SLIDE_W) * 100}%`,
                    top: `${(el.y / SLIDE_H) * 100}%`,
                    width: `${(el.width / SLIDE_W) * 100}%`,
                    height: `${(el.height / SLIDE_H) * 100}%`,
                    backgroundColor: el.bgColor,
                    borderRadius: el.borderRadius,
                  }}
                  onMouseDown={(e) => handleElementMouseDown(e, el.id)}
                  onDoubleClick={() => { if (el.type === "text") { setEditingElement(el.id); setSelectedElement(el.id); } }}
                >
                  {el.type === "text" && (
                    editingElement === el.id ? (
                      <textarea
                        className="w-full h-full bg-transparent outline-none resize-none p-1"
                        style={{
                          fontSize: `${((el.fontSize || 20) / SLIDE_W) * 100}vw`,
                          fontWeight: el.fontWeight || "normal",
                          fontStyle: el.fontStyle || "normal",
                          textAlign: (el.textAlign || "left") as any,
                          color: el.color || pres.theme.textColor,
                          lineHeight: 1.3,
                          fontFamily: pres.theme.fontFamily || "Inter",
                        }}
                        value={el.content}
                        onChange={(e) => updateElement(el.id, { content: e.target.value })}
                        onBlur={() => setEditingElement(null)}
                        autoFocus
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div
                        className="w-full h-full overflow-hidden p-1 whitespace-pre-wrap"
                        style={{
                          fontSize: `clamp(8px, ${((el.fontSize || 20) / SLIDE_W) * 100}vw, ${el.fontSize || 20}px)`,
                          fontWeight: el.fontWeight || "normal",
                          fontStyle: el.fontStyle || "normal",
                          textAlign: (el.textAlign || "left") as any,
                          color: el.color || pres.theme.textColor,
                          lineHeight: 1.3,
                          fontFamily: pres.theme.fontFamily || "Inter",
                        }}
                      >
                        {el.content}
                      </div>
                    )
                  )}
                  {el.type === "shape" && (
                    <div className="w-full h-full" />
                  )}
                  {/* Resize handle */}
                  {selectedElement === el.id && (
                    <div
                      className="absolute bottom-0 right-0 w-3 h-3 bg-primary rounded-tl cursor-se-resize"
                      onMouseDown={(e) => handleResizeMouseDown(e, el.id)}
                    />
                  )}
                </div>
              ))}
              {activeSlide.elements.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/40 gap-2 pointer-events-none">
                  <Layout size={48} />
                  <span className="text-sm">Empty slide - add elements from the toolbar</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">No slides yet. Click "Add Slide" to get started.</div>
          )}
        </div>
      </div>
    </div>
  );
}
