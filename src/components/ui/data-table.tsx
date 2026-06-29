import type { ReactNode } from "react";
import { motion } from "framer-motion";

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
}: {
  columns: Column<T>[];
  rows: T[];
}) {
  return (
    <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-[var(--bg-elevated)]/60 sticky top-0">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider font-medium text-[var(--text-muted)]"
                  style={{ width: c.width, textAlign: c.align ?? "left" }}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <motion.tr
                key={row.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02, duration: 0.25 }}
                className="border-t border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)]/50 transition-colors"
              >
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-3" style={{ textAlign: c.align ?? "left" }}>
                    {c.render(row)}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
