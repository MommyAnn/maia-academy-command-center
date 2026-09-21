import { useState } from "react";
import { Plus, Truck } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { SearchInput } from "@/components/common/SearchInput";
import { SUPPLIER_STATUS_TONE } from "@/components/inventory/statusMeta";
import { SupplierFormModal } from "@/components/inventory/SupplierFormModal";
import { SupplierDetailModal } from "@/components/inventory/SupplierDetailModal";
import { useInventoryStore } from "@/data/inventoryStore";
import type { Supplier } from "@/types/inventory";

export function Suppliers() {
  const { suppliers, items, setSupplierStatus } = useInventoryStore();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);

  const filtered = suppliers.filter((s) => !search.trim() || `${s.name} ${s.contactPerson}`.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-maia-gold-deep">Inventory</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-maia-ink sm:text-[28px]">Suppliers</h1>
          <p className="mt-1 text-sm text-maia-ink-soft">{suppliers.length} suppliers on record.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={15} />
          ADD SUPPLIER
        </Button>
      </div>

      <SearchInput value={search} onChange={setSearch} placeholder="Search suppliers..." />

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Contact Person</th>
                <th className="px-4 py-3">Contact Number</th>
                <th className="px-4 py-3">Items Supplied</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const itemCount = items.filter((i) => i.supplierId === s.id).length;
                return (
                  <tr key={s.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">{s.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{s.contactPerson || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{s.contactNumber || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{itemCount}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone={SUPPLIER_STATUS_TONE[s.status]}>{s.status}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => setViewingSupplier(s)}>
                          VIEW
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingSupplier(s)}>
                          EDIT
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSupplierStatus(s.id, s.status === "Active" ? "Inactive" : "Active")}
                        >
                          {s.status === "Active" ? "DEACTIVATE" : "ACTIVATE"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    <Truck className="mx-auto mb-2 text-maia-ink-soft/50" size={22} />
                    No suppliers match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <SupplierFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
      {editingSupplier && (
        <SupplierFormModal open={Boolean(editingSupplier)} onClose={() => setEditingSupplier(null)} editingSupplier={editingSupplier} />
      )}
      {viewingSupplier && (
        <SupplierDetailModal open={Boolean(viewingSupplier)} onClose={() => setViewingSupplier(null)} supplier={viewingSupplier} />
      )}
    </div>
  );
}
