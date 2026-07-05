import { AnimatePresence, motion } from "framer-motion";
import { X, Keyboard } from "lucide-react";

interface Props { open: boolean; onClose: () => void }

const shortcuts: Array<[string, Array<[string, string]>]> = [
  ["Navigation", [
    ["⌘ K", "Open command palette"],
    ["?", "Show this shortcut sheet"],
    ["G then D", "Go to Dashboard"],
    ["G then H", "Go to Harness"],
    ["G then E", "Go to Evaluations"],
  ]],
  ["Command palette", [
    ["↑ ↓", "Move between results"],
    ["↵", "Open selected result"],
    ["Esc", "Close"],
  ]],
  ["Harness canvas", [
    ["Space + drag", "Pan canvas"],
    ["Del", "Remove selection"],
    ["⌘ Z / ⌘ ⇧ Z", "Undo / redo"],
  ]],
];

export function ShortcutOverlay({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-6"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 h-12 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-[var(--text-muted)]" />
                <h2 className="text-[14px] font-medium">Keyboard shortcuts</h2>
              </div>
              <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md hover:bg-[var(--bg-surface)]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5">
              {shortcuts.map(([section, items]) => (
                <div key={section}>
                  <h3 className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2">{section}</h3>
                  <ul className="space-y-1.5">
                    {items.map(([keys, desc]) => (
                      <li key={desc} className="flex items-center justify-between text-[12px]">
                        <span className="text-[var(--text-secondary)]">{desc}</span>
                        <kbd className="font-mono-tabular text-[11px] px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)]">
                          {keys}
                        </kbd>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
