import clsx from "clsx";
import { Coins } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { vcApi, type CreditTransaction } from "../api";
import { useMe } from "../components/Layout";
import { Alert, Card, formatDate, PageHeader, Spinner } from "../components/ui";

export const TX_LABEL: Record<CreditTransaction["type"], string> = {
  GRANT: "Credits added",
  ADJUSTMENT: "Credits adjusted",
  GENERATION_CHARGE: "Video created",
  GENERATION_REFUND: "Credits returned (video failed)",
};

export function CreditsPage() {
  const { me } = useMe();
  const [data, setData] = useState<{ balance: number; transactions: CreditTransaction[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    vcApi.transactions().then(setData, (e) => setError(e instanceof Error ? e.message : "Could not load credits."));
  }, []);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Video Credits" subtitle="Each video uses credits. If a video fails, its credits are returned automatically." />
      <Card className="mb-6 flex items-center gap-5 border-vc-gold/40 bg-gradient-to-br from-vc-raised to-vc-surface">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-vc-gold/15 ring-1 ring-vc-gold/40">
          <Coins className="h-7 w-7 text-vc-gold-bright" />
        </span>
        <div>
          <p className="text-sm text-vc-muted">Remaining credits</p>
          <p className="font-display text-4xl font-extrabold text-vc-gold-bright">{data?.balance ?? me?.account.creditBalance ?? "—"}</p>
          {me && (
            <p className="text-xs text-vc-dim">
              {Object.entries(me.options.creditCost)
                .map(([r, c]) => `${r}: ${c} credit${c === 1 ? "" : "s"} per video`)
                .join(" · ")}
            </p>
          )}
        </div>
      </Card>
      <p className="mb-4 text-sm text-vc-muted">Need more credits? Contact M.A.I.A. support — you're never charged automatically.</p>
      {error && <Alert kind="error">{error}</Alert>}
      {!data ? (
        <Spinner />
      ) : (
        <Card className="p-0 sm:p-0">
          <h2 className="border-b border-vc-border px-5 py-4 font-display font-bold text-vc-ivory">History</h2>
          {data.transactions.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-vc-muted">No credit activity yet.</p>
          ) : (
            <ul className="divide-y divide-vc-border">
              {data.transactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-vc-ivory">{TX_LABEL[t.type]}</p>
                    <p className="truncate text-xs text-vc-dim">
                      {formatDate(t.createdAt)}
                      {t.jobId && t.jobDisplayId && (
                        <>
                          {" · "}
                          <Link to={`/studio/videos/${t.jobId}`} className="text-vc-gold hover:underline">
                            {t.jobDisplayId}
                          </Link>
                        </>
                      )}
                      {t.type !== "GENERATION_CHARGE" && t.reason ? ` · ${t.reason}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={clsx("font-display font-bold", t.amount > 0 ? "text-vc-success" : "text-vc-ivory")}>{t.amount > 0 ? `+${t.amount}` : t.amount}</p>
                    <p className="text-xs text-vc-dim">Balance {t.balanceAfter}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
