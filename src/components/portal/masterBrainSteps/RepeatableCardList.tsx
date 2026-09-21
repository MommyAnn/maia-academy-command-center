import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/common/Button";

export function RepeatableCardList<T>({
  items,
  onAdd,
  onRemove,
  onItemChange,
  renderItem,
  addLabel,
  emptyLabel,
  itemLabel,
}: {
  items: T[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onItemChange: (index: number, patch: Partial<T>) => void;
  renderItem: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
  addLabel: string;
  emptyLabel: string;
  itemLabel: (item: T, index: number) => string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {items.length === 0 && (
        <p className="rounded-xl bg-maia-bg px-4 py-6 text-center text-sm text-maia-ink-soft">{emptyLabel}</p>
      )}
      {items.map((item, index) => (
        <div key={index} className="rounded-xl border border-maia-border p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-bold uppercase tracking-wide text-maia-gold-deep">{itemLabel(item, index)}</p>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-maia-danger hover:bg-maia-danger-bg"
            >
              <Trash2 size={13} />
              REMOVE
            </button>
          </div>
          <div className="flex flex-col gap-4">{renderItem(item, (patch) => onItemChange(index, patch))}</div>
        </div>
      ))}
      <Button variant="secondary" onClick={onAdd} className="w-full sm:w-auto">
        <Plus size={14} />
        {addLabel}
      </Button>
    </div>
  );
}
