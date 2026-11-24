import { useEffect, useState } from "react";
import { adminApi } from "../api";
import { Alert, Card, formatDate, PageHeader, Spinner } from "../components/ui";

export function AdminAuditPage() {
  const [entries, setEntries] = useState<{ id: string; action: string; summary: string; createdAt: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    adminApi.audit().then((r) => setEntries(r.entries), (e) => setError(e.message));
  }, []);
  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Admin actions, credit changes and video events (latest 300)." />
      {error && <Alert kind="error">{error}</Alert>}
      {!entries ? (
        <Spinner />
      ) : (
        <Card className="p-0 sm:p-0">
          <ul className="divide-y divide-vc-border">
            {entries.map((e) => (
              <li key={e.id} className="px-5 py-3 text-sm">
                <p className="font-medium text-vc-ivory">{e.action}</p>
                <p className="text-xs text-vc-muted">
                  {formatDate(e.createdAt)} — {e.summary}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
