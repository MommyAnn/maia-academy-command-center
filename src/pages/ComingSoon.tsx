import { Construction } from "lucide-react";
import { Card } from "@/components/common/Card";

export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <Card className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-maia-gold-bg text-maia-gold-deep">
          <Construction size={26} strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold text-maia-ink">{title}</h2>
          <p className="mt-2 text-sm text-maia-ink-soft">Coming in the next build step.</p>
        </div>
      </Card>
    </div>
  );
}
