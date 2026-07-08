// Local prompt library — versioned prompts persisted to localStorage.
// Each prompt has a stack of versions; the last one is "current".
// Variables are extracted from {{name}} placeholders.

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "prompts.library.v1";

export interface PromptVersion {
  version: string;      // e.g. "v1.0"
  body: string;
  note?: string;
  createdAt: number;
}

export interface PromptRecord {
  id: string;
  name: string;
  category: string;
  tags: string[];
  versions: PromptVersion[];
  updatedAt: number;
}

const SEED: PromptRecord[] = [
  {
    id: "p_sales_discovery",
    name: "sales/discovery-call",
    category: "sales",
    tags: ["b2b", "outbound"],
    versions: [
      {
        version: "v1.0", createdAt: Date.now() - 86400000 * 12,
        body: "You are a discovery-call coach for {{industry}} sellers.\nAsk 3 open questions to uncover the buyer's biggest pain about {{topic}}.\nKeep tone consultative, never pushy.",
      },
      {
        version: "v1.1", createdAt: Date.now() - 86400000 * 3, note: "Tightened tone rules",
        body: "You are a discovery-call coach for {{industry}} sellers.\nAsk exactly 3 open questions to uncover the buyer's biggest pain about {{topic}}.\nUse short sentences. Never mention pricing on the first call.\nReturn the questions as a numbered list.",
      },
    ],
    updatedAt: Date.now() - 86400000 * 3,
  },
  {
    id: "p_support_triage",
    name: "support/triage-router",
    category: "support",
    tags: ["routing", "classifier"],
    versions: [
      {
        version: "v1.0", createdAt: Date.now() - 86400000 * 20,
        body: "Classify the support ticket into one of: billing, bug, how-to, feedback.\nTicket: {{ticket}}\nRespond with only the label.",
      },
    ],
    updatedAt: Date.now() - 86400000 * 20,
  },
  {
    id: "p_research_summary",
    name: "research/paper-summary",
    category: "research",
    tags: ["academic"],
    versions: [
      {
        version: "v1.0", createdAt: Date.now() - 86400000 * 30,
        body: "Summarise the following paper in {{words}} words for a busy {{audience}}.\n---\n{{content}}",
      },
    ],
    updatedAt: Date.now() - 86400000 * 30,
  },
  {
    id: "p_safety_pii",
    name: "compliance/pii-redactor",
    category: "safety",
    tags: ["compliance", "guardrail"],
    versions: [
      {
        version: "v1.0", createdAt: Date.now() - 86400000 * 45,
        body: "Redact any PII (names, emails, phone numbers, addresses) from the text below.\nReplace each with a tag like [NAME], [EMAIL].\nText: {{text}}",
      },
    ],
    updatedAt: Date.now() - 86400000 * 45,
  },
];

function read(): PromptRecord[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : SEED;
  } catch { return SEED; }
}

function write(rows: PromptRecord[]) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows)); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent("prompts-library-changed")); } catch { /* ignore */ }
}

export function extractVariables(body: string): string[] {
  const set = new Set<string>();
  const re = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) set.add(m[1]);
  return [...set];
}

export function renderPrompt(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

function bumpVersion(prev: string): string {
  const m = /v(\d+)\.(\d+)/.exec(prev);
  if (!m) return "v1.0";
  return `v${m[1]}.${Number(m[2]) + 1}`;
}

export function usePromptLibrary() {
  const [prompts, setPrompts] = useState<PromptRecord[]>([]);
  useEffect(() => {
    setPrompts(read());
    const onChange = () => setPrompts(read());
    window.addEventListener("prompts-library-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("prompts-library-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const create = useCallback((input: { name: string; category: string; body: string; tags?: string[] }) => {
    const rows = read();
    const rec: PromptRecord = {
      id: `p_${Date.now().toString(36)}`,
      name: input.name,
      category: input.category,
      tags: input.tags ?? [],
      versions: [{ version: "v1.0", body: input.body, createdAt: Date.now() }],
      updatedAt: Date.now(),
    };
    const next = [rec, ...rows];
    write(next);
    return rec;
  }, []);

  const saveNewVersion = useCallback((id: string, body: string, note?: string) => {
    const rows = read();
    const next = rows.map((r) => {
      if (r.id !== id) return r;
      const last = r.versions[r.versions.length - 1];
      if (last && last.body === body) return r;
      const version = bumpVersion(last?.version ?? "v1.0");
      return {
        ...r,
        versions: [...r.versions, { version, body, note, createdAt: Date.now() }],
        updatedAt: Date.now(),
      };
    });
    write(next);
  }, []);

  const remove = useCallback((id: string) => {
    write(read().filter((r) => r.id !== id));
  }, []);

  return { prompts, create, saveNewVersion, remove };
}
