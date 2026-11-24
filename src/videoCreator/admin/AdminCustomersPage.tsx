import clsx from "clsx";
import { Copy, KeyRound, Plus, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { adminApi, newIdempotencyKey, type AdminCustomer, type CreditTransaction } from "../api";
import { Alert, Button, Card, formatDate, Input, Label, PageHeader, Spinner, TextArea } from "../components/ui";
import { TX_LABEL } from "../pages/CreditsPage";

export function AdminCustomersPage() {
  const [customers, setCustomers] = useState<AdminCustomer[] | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<AdminCustomer | null>(null);

  const load = useCallback(async () => {
    try {
      const { customers } = await adminApi.customers(search.trim() || undefined);
      setCustomers(customers);
      setSelected((s) => (s ? customers.find((c) => c.studentId === s.studentId) ?? null : null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load customers.");
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Create logins for customers whose purchase you have verified, and manage their access and credits."
        action={
          <Button onClick={() => setCreating(true)} data-testid="new-customer">
            <Plus className="h-4 w-4" /> New customer
          </Button>
        }
      />
      <Input type="search" placeholder="Search name, email or ID…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4 max-w-md" />
      {error && <Alert kind="error">{error}</Alert>}
      {!customers ? (
        <Spinner />
      ) : customers.length === 0 ? (
        <Card className="text-center text-sm text-vc-muted">No customers yet. Click “New customer” after verifying a purchase.</Card>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-vc-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-vc-surface text-xs uppercase tracking-wider text-vc-dim">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Access</th>
                <th className="px-4 py-3 text-right">Credits</th>
                <th className="px-4 py-3 text-right">Videos</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-vc-border">
              {customers.map((c) => (
                <tr key={c.studentId} className="bg-vc-black hover:bg-vc-surface">
                  <td className="px-4 py-3">
                    <p className="font-medium text-vc-ivory">{c.fullName}</p>
                    <p className="text-xs text-vc-dim">{c.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx("rounded-full px-2.5 py-1 text-xs font-semibold", c.accessStatus === "ACTIVE" ? "bg-vc-success/10 text-vc-success" : "bg-vc-danger/10 text-vc-danger")}>{c.accessStatus === "ACTIVE" ? "Active" : "Suspended"}</span>
                    {c.loginStatus !== "ACTIVE" && <span className="ml-2 text-xs text-vc-danger">login {c.loginStatus.toLowerCase()}</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-display font-bold text-vc-gold-bright">{c.creditBalance}</td>
                  <td className="px-4 py-3 text-right text-vc-muted">
                    {c.videos.completed}
                    {c.videos.failed > 0 && <span className="text-vc-danger"> / {c.videos.failed} failed</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-vc-muted">{c.lastLoginAt ? formatDate(c.lastLoginAt) : "Never"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="secondary" onClick={() => setSelected(c)}>
                      Manage
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && <CreateCustomerModal onClose={() => setCreating(false)} onCreated={load} />}
      {selected && <ManageCustomerModal customer={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-vc-border bg-vc-surface p-6 sm:rounded-3xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-vc-ivory">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-vc-muted hover:bg-vc-raised">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} onFocus={(e) => e.target.select()} />
        <Button
          variant="secondary"
          type="button"
          onClick={async () => {
            await navigator.clipboard?.writeText(value).catch(() => {});
            setCopied(true);
          }}
        >
          <Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

function CreateCustomerModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ fullName: "", email: "", initialCredits: "", purchaseReference: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ email: string; temporaryPassword: string; loginUrl: string; creditBalance: number } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await adminApi.createCustomer({ fullName: form.fullName, email: form.email, initialCredits: form.initialCredits === "" ? undefined : Number(form.initialCredits), purchaseReference: form.purchaseReference || undefined, notes: form.notes || undefined });
      setResult(r);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the customer.");
    } finally {
      setBusy(false);
    }
  }

  if (result)
    return (
      <Modal title="Customer created" onClose={onClose}>
        <div className="space-y-4">
          <Alert kind="success" title={`${result.creditBalance} credit(s) added. Access is active.`}>
            Send these login details to the customer privately. The temporary password is shown only once — ask them to change it in Account Settings.
          </Alert>
          <CopyField label="Login page" value={result.loginUrl} />
          <CopyField label="Email" value={result.email} />
          <CopyField label="Temporary password" value={result.temporaryPassword} />
          <Button className="w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      </Modal>
    );

  return (
    <Modal title="New customer" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Alert kind="info">Only create an account after the purchase has been verified. Enrollment and payment happen outside this app.</Alert>
        {error && <Alert kind="error">{error}</Alert>}
        <div>
          <Label htmlFor="fn">Full name</Label>
          <Input id="fn" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="em">Email (their login)</Label>
          <Input id="em" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="cr" hint="(blank = default)">Starting credits</Label>
            <Input id="cr" type="number" min={0} max={10000} value={form.initialCredits} onChange={(e) => setForm({ ...form, initialCredits: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="pr">Purchase reference</Label>
            <Input id="pr" placeholder="Receipt / order no." value={form.purchaseReference} onChange={(e) => setForm({ ...form, purchaseReference: e.target.value })} />
          </div>
        </div>
        <div>
          <Label htmlFor="nt" hint="(admin only)">Notes</Label>
          <TextArea id="nt" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <Button type="submit" className="w-full" loading={busy}>
          Create customer & activate access
        </Button>
      </form>
    </Modal>
  );
}

function ManageCustomerModal({ customer, onClose, onChanged }: { customer: AdminCustomer; onClose: () => void; onChanged: () => void }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [tx, setTx] = useState<CreditTransaction[] | null>(null);

  const loadTx = useCallback(() => adminApi.customerTransactions(customer.studentId).then((r) => setTx(r.transactions), () => setTx([])), [customer.studentId]);
  useEffect(() => {
    void loadTx();
  }, [loadTx]);

  async function act(name: string, fn: () => Promise<unknown>, success: string) {
    setBusy(name);
    setMsg(null);
    try {
      await fn();
      setMsg({ kind: "success", text: success });
      onChanged();
      void loadTx();
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "Action failed." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal title={customer.fullName} onClose={onClose}>
      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-2xl bg-vc-black p-4">
          <div>
            <p className="text-xs text-vc-dim">{customer.email}</p>
            <p className="text-xs text-vc-dim">
              {customer.displayId}
              {customer.purchaseReference ? ` · Purchase ${customer.purchaseReference}` : ""}
            </p>
          </div>
          <p className="font-display text-3xl font-extrabold text-vc-gold-bright">{customer.creditBalance}</p>
        </div>
        {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

        <div>
          <h3 className="mb-2 text-sm font-semibold text-vc-ivory">Add or remove credits</h3>
          <div className="grid gap-2 sm:grid-cols-[110px_1fr]">
            <Input type="number" placeholder="+5 or -1" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Credit amount" />
            <Input placeholder="Reason (e.g. bonus, correction)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" />
          </div>
          <Button
            className="mt-2 w-full"
            loading={busy === "credits"}
            disabled={!amount || Number(amount) === 0 || reason.trim().length < 3}
            onClick={() =>
              act("credits", async () => {
                await adminApi.adjustCredits(customer.studentId, Number(amount), reason.trim(), newIdempotencyKey());
                setAmount("");
                setReason("");
              }, "Credits updated.")
            }
          >
            Apply credit change
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {customer.accessStatus === "ACTIVE" ? (
            <Button variant="danger" loading={busy === "suspend"} onClick={() => window.confirm(`Suspend ${customer.fullName}'s video access?`) && act("suspend", () => adminApi.suspend(customer.studentId), "Access suspended.")}>
              Suspend access
            </Button>
          ) : (
            <Button loading={busy === "activate"} onClick={() => act("activate", () => adminApi.activate(customer.studentId), "Access activated.")}>
              Activate access
            </Button>
          )}
          <Button
            variant="secondary"
            loading={busy === "reset"}
            onClick={() =>
              act("reset", async () => {
                setLink((await adminApi.resetLink(customer.studentId)).url);
              }, "Password reset link created (valid 24 hours).")
            }
          >
            <KeyRound className="h-4 w-4" /> Password reset link
          </Button>
        </div>
        {link && <CopyField label="Send this link to the customer" value={link} />}

        <div>
          <h3 className="mb-2 text-sm font-semibold text-vc-ivory">Credit history</h3>
          {!tx ? (
            <Spinner />
          ) : tx.length === 0 ? (
            <p className="text-sm text-vc-muted">No transactions.</p>
          ) : (
            <ul className="max-h-60 divide-y divide-vc-border overflow-y-auto rounded-xl border border-vc-border text-sm">
              {tx.map((t) => (
                <li key={t.id} className="flex justify-between gap-3 px-3 py-2">
                  <span>
                    <span className="text-vc-ivory">{TX_LABEL[t.type]}</span>
                    <span className="block text-xs text-vc-dim">
                      {formatDate(t.createdAt)} {t.reason ? `· ${t.reason}` : ""}
                    </span>
                  </span>
                  <span className={clsx("font-semibold", t.amount > 0 ? "text-vc-success" : "text-vc-ivory")}>{t.amount > 0 ? `+${t.amount}` : t.amount}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
