import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Plus, Save, ArrowLeft, Table, Download } from "lucide-react";
import jspreadsheet from "jspreadsheet-ce";
import "jspreadsheet-ce/dist/jspreadsheet.css";
import * as XLSX from "xlsx";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";
import { useUserContext } from "../lib/user-context";

type Spreadsheet = {
  id: number;
  name: string;
  schemaJson?: Array<{ name: string }> | null;
  rowCount: number;
};

type SpreadsheetRow = {
  rowIndex: number;
  data: Record<string, string>;
};

const DEFAULT_COLUMNS = ["A", "B", "C", "D", "E"];

function buildEmptyRows(columns: string[], count: number) {
  return Array.from({ length: count }, () => columns.map(() => ""));
}

export default function SpreadsheetEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeUser } = useUserContext();
  const sheetId = id ? Number(id) : NaN;
  const [sheet, setSheet] = useState<Spreadsheet | null>(null);
  const [name, setName] = useState("");
  const [columns, setColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [rows, setRows] = useState<string[][]>(buildEmptyRows(DEFAULT_COLUMNS, 12));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const sheetInstanceRef = useRef<any>(null);

  const columnLabels = useMemo(() => {
    return columns.length > 0 ? columns : DEFAULT_COLUMNS;
  }, [columns]);

  const loadSpreadsheet = useCallback(async () => {
    if (!Number.isFinite(sheetId)) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/spreadsheets/${sheetId}`);
      if (!res.ok) {
        setSheet(null);
        setIsLoading(false);
        return;
      }
      const data: Spreadsheet = await res.json();
      const nextColumns = data.schemaJson?.map((c) => c.name).filter(Boolean) || DEFAULT_COLUMNS;
      setSheet(data);
      setName(data.name || "Untitled Spreadsheet");
      setColumns(nextColumns.length > 0 ? nextColumns : DEFAULT_COLUMNS);

      const rowsRes = await fetch(`/api/spreadsheets/${sheetId}/rows`);
      if (rowsRes.ok) {
        const rowsData: { rows: SpreadsheetRow[] } = await rowsRes.json();
        const mapped = rowsData.rows.map((row) =>
          nextColumns.map((col) => row.data?.[col] ?? "")
        );
        setRows(mapped.length > 0 ? mapped : buildEmptyRows(nextColumns, 12));
      } else {
        setRows(buildEmptyRows(nextColumns, 12));
      }
      setHasChanges(false);
    } finally {
      setIsLoading(false);
    }
  }, [sheetId]);

  useEffect(() => {
    loadSpreadsheet();
  }, [loadSpreadsheet]);

  const buildSheet = useCallback(() => {
    if (!sheetRef.current) return;
    if (typeof window === "undefined") return;
    const jss = (jspreadsheet as any)?.default ?? jspreadsheet;
    if (typeof jss !== "function") return;
    if (sheetInstanceRef.current) {
      sheetInstanceRef.current.destroy();
      sheetInstanceRef.current = null;
    }
    const columnDefs = columnLabels.map((title) => ({
      type: "text",
      title,
      width: 140,
    }));
    sheetInstanceRef.current = jss(sheetRef.current, {
      data: rows,
      columns: columnDefs,
      minDimensions: [Math.max(columnDefs.length, 5), Math.max(rows.length, 12)],
      allowInsertRow: true,
      allowInsertColumn: true,
      allowDeleteRow: true,
      allowDeleteColumn: true,
      columnSorting: true,
      columnResize: true,
      rowResize: true,
      contextMenu: true,
      onchange: () => setHasChanges(true),
      oncolumnrename: () => setHasChanges(true),
      oninsertrow: () => setHasChanges(true),
      oninsertcolumn: () => setHasChanges(true),
      ondeleterow: () => setHasChanges(true),
      ondeletecolumn: () => setHasChanges(true),
    });
  }, [columnLabels, rows]);

  useEffect(() => {
    if (!sheet) return;
    buildSheet();
    return () => {
      if (sheetInstanceRef.current) {
        sheetInstanceRef.current.destroy();
        sheetInstanceRef.current = null;
      }
    };
  }, [sheet, buildSheet]);

  const addColumn = () => {
    sheetInstanceRef.current?.insertColumn();
    setHasChanges(true);
  };

  const addRow = () => {
    sheetInstanceRef.current?.insertRow();
    setHasChanges(true);
  };

  const getHeaders = () => {
    const instance = sheetInstanceRef.current;
    if (!instance || !instance.getHeaders) return columnLabels;
    const raw = instance.getHeaders(true);
    if (Array.isArray(raw)) return raw.map((h) => String(h).trim()).filter(Boolean);
    if (typeof raw === "string") {
      return raw.split(",").map((h: string) => h.trim()).filter(Boolean);
    }
    return columnLabels;
  };

  const getData = () => {
    const instance = sheetInstanceRef.current;
    if (!instance || !instance.getData) return rows;
    return instance.getData();
  };

  const saveSpreadsheet = async () => {
    if (!Number.isFinite(sheetId)) return;
    setIsSaving(true);
    try {
      const nextColumns = getHeaders();
      const nextRows = getData();
      await fetch(`/api/spreadsheets/${sheetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          columns: nextColumns,
          rows: nextRows,
          lastEditedByUserId: activeUser?.id || null,
        }),
      });
      setColumns(nextColumns.length > 0 ? nextColumns : DEFAULT_COLUMNS);
      setRows(nextRows.length > 0 ? nextRows : buildEmptyRows(nextColumns, 12));
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  const exportToExcel = () => {
    const nextColumns = getHeaders();
    const nextRows = getData();
    const worksheetData = [nextColumns, ...nextRows];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    const filename = `${name || "spreadsheet"}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading spreadsheet...
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className="text-center py-24 text-muted-foreground">
        <Table className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
        Spreadsheet not found.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setHasChanges(true);
          }}
          className="max-w-md"
          placeholder="Spreadsheet name"
        />
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={addColumn}>
          <Plus className="h-4 w-4 mr-1" />
          Column
        </Button>
        <Button variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-4 w-4 mr-1" />
          Row
        </Button>
        <Button variant="outline" size="sm" onClick={exportToExcel}>
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>
        <Button size="sm" onClick={saveSpreadsheet} disabled={isSaving || !hasChanges}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          Save
        </Button>
      </div>

      <ScrollArea className="border border-border rounded-lg bg-background">
        <div className="min-w-[720px] p-2">
          <div ref={sheetRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
