import { useState, type FormEvent } from "react";
import { useVcAuth } from "../auth";
import { authApi } from "../api";
import { useMe } from "../components/Layout";
import { Alert, Button, Card, Input, Label, PageHeader } from "../components/ui";

export function AccountPage() {
  const { user } = useVcAuth();
  const { me } = useMe();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next !== confirm) return setMsg({ kind: "error", text: "The new passwords don't match." });
    setBusy(true);
    setMsg(null);
    try {
      await authApi.changePassword(current, next);
      setMsg({ kind: "success", text: "Password changed. Other devices have been signed out." });
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setMsg({ kind: "error", text: err instanceof Error ? err.message : "Could not change password." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Account Settings" />
      <Card>
        <h2 className="mb-4 font-display font-bold text-vc-ivory">Your account</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-vc-muted">Name</dt>
            <dd className="text-vc-ivory">{user?.fullName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-vc-muted">Email</dt>
            <dd className="break-all text-vc-ivory">{user?.email}</dd>
          </div>
          {me && (
            <>
              <div className="flex justify-between gap-4">
                <dt className="text-vc-muted">Access</dt>
                <dd className={me.account.accessStatus === "ACTIVE" ? "text-vc-success" : "text-vc-danger"}>{me.account.accessStatus === "ACTIVE" ? "Active" : "Paused"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-vc-muted">Video credits</dt>
                <dd className="font-semibold text-vc-gold-bright">{me.account.creditBalance}</dd>
              </div>
            </>
          )}
        </dl>
        <p className="mt-4 text-xs text-vc-dim">To change your name or email, please contact M.A.I.A. support.</p>
      </Card>
      <Card>
        <h2 className="mb-4 font-display font-bold text-vc-ivory">Change password</h2>
        <form onSubmit={submit} className="space-y-4">
          {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
          <div>
            <Label htmlFor="cur">Current password</Label>
            <Input id="cur" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="new" hint="(10+ characters, upper & lowercase, a number)">New password</Label>
            <Input id="new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="conf">Confirm new password</Label>
            <Input id="conf" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          <Button type="submit" loading={busy}>
            Update password
          </Button>
        </form>
      </Card>
    </div>
  );
}
