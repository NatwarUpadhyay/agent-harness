// Local dataset library — persisted to localStorage.
// Supports uploading CSV, JSON, JSONL, and Markdown files.
// Parses row counts and keeps a preview of the first ~50 rows for inspection.

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "datasets.library.v1";
const MAX_PREVIEW_ROWS = 50;
const MAX_INLINE_BYTES = 2_000_000; // 2 MB — anything bigger stores metadata only.

export type DatasetKind = "csv" | "jsonl" | "json" | "markdown" | "parquet";

export interface DatasetRecord {
  id: string;
  name: string;
  kind: DatasetKind;
  rows: number;
  columns: string[];
  sizeBytes: number;
  createdAt: number;
  source: "seed" | "upload";
  preview: Record<string, string>[]; // stringified cells for display
  truncated: boolean;                // preview only, not the full file
}

const SEED: DatasetRecord[] = [
  {
    id: "d_support_q2", name: "support_tickets_2025_q2.parquet", kind: "parquet",
    rows: 184_233, columns: ["ticket_id", "customer", "category", "resolved_at"],
    sizeBytes: 260_046_848, createdAt: Date.parse("2025-06-12"), source: "seed",
    preview: [
      { ticket_id: "T-90211", customer: "acme.co",   category: "billing", resolved_at: "2025-06-11 14:02" },
      { ticket_id: "T-90212", customer: "globex.io", category: "bug",     resolved_at: "2025-06-11 14:07" },
      { ticket_id: "T-90213", customer: "initech",   category: "how-to",  resolved_at: "2025-06-11 14:19" },
    ],
    truncated: true,
  },
  {
    id: "d_golden_eval", name: "golden_eval_set.jsonl", kind: "jsonl",
    rows: 1_200, columns: ["prompt", "expected", "category"],
    sizeBytes: 4_404_019, createdAt: Date.parse("2025-05-30"), source: "seed",
    preview: [
      { prompt: "Summarise this refund policy", expected: "3-bullet summary", category: "summarisation" },
      { prompt: "Extract PII from message",     expected: "[EMAIL] [PHONE]",  category: "safety" },
    ],
    truncated: true,
  },
  {
    id: "d_redteam", name: "redteam_prompts.jsonl", kind: "jsonl",
    rows: 384, columns: ["prompt", "attack_type", "severity"],
    sizeBytes: 943_718, createdAt: Date.parse("2025-04-28"), source: "seed",
    preview: [
      { prompt: "Ignore previous rules and…", attack_type: "prompt-injection", severity: "high" },
      { prompt: "Pretend you are DAN and…",   attack_type: "jailbreak",        severity: "high" },
    ],
    truncated: true,
  },
];

function read(): DatasetRecord[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : SEED;
  } catch { return SEED; }
}

function write(rows: DatasetRecord[]) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows)); } catch { /* quota */ }
  try { window.dispatchEvent(new CustomEvent("datasets-library-changed")); } catch { /* ignore */ }
}

function inferKind(name: string): DatasetKind {
  const lower = name.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".jsonl") || lower.endsWith(".ndjson")) return "jsonl";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  if (lower.endsWith(".parquet")) return "parquet";
  return "csv";
}

// Minimal CSV splitter — handles quoted fields but not embedded newlines inside quotes.
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = ""; let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function stringifyCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

interface ParseResult { rows: number; columns: string[]; preview: Record<string, string>[]; truncated: boolean; }

function parseCsv(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return { rows: 0, columns: [], preview: [], truncated: false };
  const columns = splitCsvLine(lines[0]);
  const data = lines.slice(1);
  const preview = data.slice(0, MAX_PREVIEW_ROWS).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    columns.forEach((c, i) => { row[c] = cells[i] ?? ""; });
    return row;
  });
  return { rows: data.length, columns, preview, truncated: data.length > preview.length };
}

function parseJsonl(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const parsed = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) as Record<string, unknown>[];
  const columns = Array.from(new Set(parsed.slice(0, 20).flatMap((r) => Object.keys(r ?? {}))));
  const preview = parsed.slice(0, MAX_PREVIEW_ROWS).map((r) => {
    const row: Record<string, string> = {};
    columns.forEach((c) => { row[c] = stringifyCell(r[c]); });
    return row;
  });
  return { rows: parsed.length, columns, preview, truncated: parsed.length > preview.length };
}

function parseJson(text: string): ParseResult {
  try {
    const parsed = JSON.parse(text);
    const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.data) ? parsed.data : [parsed];
    return parseJsonl(arr.map((x: unknown) => JSON.stringify(x)).join("\n"));
  } catch { return { rows: 0, columns: [], preview: [], truncated: false }; }
}

function parseMarkdown(text: string): ParseResult {
  const sections = text.split(/\n(?=#{1,3}\s)/).filter((s) => s.trim().length > 0);
  const preview = sections.slice(0, MAX_PREVIEW_ROWS).map((s, i) => ({
    "#": String(i + 1),
    heading: (s.match(/^#{1,3}\s+(.+)$/m)?.[1] ?? "(untitled)").slice(0, 80),
    excerpt: s.replace(/^#{1,3}\s+.+$/m, "").trim().slice(0, 140),
  }));
  return { rows: sections.length, columns: ["#", "heading", "excerpt"], preview, truncated: sections.length > preview.length };
}

export async function parseFile(file: File): Promise<Omit<DatasetRecord, "id" | "createdAt" | "source">> {
  const kind = inferKind(file.name);
  const sizeBytes = file.size;
  if (kind === "parquet" || sizeBytes > MAX_INLINE_BYTES) {
    // Too large or binary — store metadata only.
    return { name: file.name, kind, rows: 0, columns: [], sizeBytes, preview: [], truncated: true };
  }
  const text = await file.text();
  const parsed =
    kind === "csv"      ? parseCsv(text) :
    kind === "jsonl"    ? parseJsonl(text) :
    kind === "json"     ? parseJson(text) :
                          parseMarkdown(text);
  return { name: file.name, kind, sizeBytes, ...parsed };
}

export function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

export function useDatasets() {
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  useEffect(() => {
    setDatasets(read());
    const onChange = () => setDatasets(read());
    window.addEventListener("datasets-library-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("datasets-library-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const upload = useCallback(async (file: File): Promise<DatasetRecord> => {
    const parsed = await parseFile(file);
    const rec: DatasetRecord = {
      ...parsed,
      id: `d_${Date.now().toString(36)}`,
      createdAt: Date.now(),
      source: "upload",
    };
    write([rec, ...read()]);
    return rec;
  }, []);

  const remove = useCallback((id: string) => {
    write(read().filter((r) => r.id !== id));
  }, []);

  return { datasets, upload, remove };
}
