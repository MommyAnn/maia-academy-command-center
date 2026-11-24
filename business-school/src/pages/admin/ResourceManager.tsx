import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { EmptyState, ErrorNote, Spinner } from "@/components/ui";
import { AdminPageHeader, FormGrid, Modal, useToast, type FieldDef } from "./kit";

type Row = Record<string, unknown> & { id: number };

/** Generic list + create/edit/delete screen for simple admin tables. */
export function ResourceManager({
  endpoint,
  title,
  sub,
  noun,
  fields,
  blank,
  columns,
  emptyText,
}: {
  endpoint: string;
  title: string;
  sub: ReactNode;
  noun: string;
  fields: FieldDef[];
  blank: Record<string, unknown>;
  columns: { label: string; render: (r: Row, ctx: { courses: { id: number; title: string }[] }) => ReactNode }[];
  emptyText: string;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [courses, setCourses] = useState<{ id: number; title: string }[]>([]);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    api.get<Row[]>(`/api/admin/${endpoint}`).then(setRows).catch(toast.err);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);
  useEffect(() => {
    load();
    api.get<{ id: number; title: string }[]>("/api/admin/courses").then(setCourses).catch(() => {});
  }, [load]);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    const payload = Object.fromEntries(
      fields.map((f) => [f.key, f.type === "checkbox" ? !!editing[f.key] : editing[f.key]]),
    );
    try {
      if (editing.id) await api.put(`/api/admin/${endpoint}/${editing.id}`, payload);
      else await api.post(`/api/admin/${endpoint}`, payload);
      setEditing(null);
      toast.ok(`${noun} saved.`);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r: Row) => {
    if (!confirm(`Delete this ${noun.toLowerCase()}? This cannot be undone.`)) return;
    try {
      await api.del(`/api/admin/${endpoint}/${r.id}`);
      toast.ok(`${noun} deleted.`);
      load();
    } catch (e) {
      toast.err(e);
    }
  };

  return (
    <>
      <AdminPageHeader
        title={title}
        sub={sub}
        actions={
          <button className="btn btn-gold" onClick={() => { setError(null); setEditing({ ...blank }); }}>
            <Plus className="h-4 w-4" /> Add {noun.toLowerCase()}
          </button>
        }
      />
      {!rows ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState title={`No ${noun.toLowerCase()}s yet`}>{emptyText}</EmptyState>
      ) : (
        <div className="glass overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-gold/20 text-xs tracking-[0.12em] text-gold uppercase">
                {columns.map((c) => (
                  <th key={c.label} className="px-4 py-3 font-semibold">{c.label}</th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gold/10">
              {rows.map((r) => (
                <tr key={r.id} className="text-ivory/85">
                  {columns.map((c) => (
                    <td key={c.label} className="px-4 py-3 align-top">{c.render(r, { courses })}</td>
                  ))}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button className="btn btn-ghost p-2" onClick={() => { setError(null); setEditing({ ...r }); }} aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button className="btn btn-ghost p-2 text-danger" onClick={() => remove(r)} aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <Modal title={`${editing.id ? "Edit" : "New"} ${noun.toLowerCase()}`} onClose={() => setEditing(null)} wide>
          <FormGrid fields={fields} data={editing} setData={setEditing} courses={courses} />
          <div className="mt-5">
            <ErrorNote message={error} />
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn btn-gold" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          </div>
        </Modal>
      )}
      {toast.node}
    </>
  );
}
