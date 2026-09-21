import { Megaphone, Pin } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { useStudentPortal } from "@/context/StudentPortalContext";
import { usePortalStore } from "@/data/portalStore";
import { isAnnouncementVisibleToStudent } from "@/utils/portal";

export function Announcements() {
  const { student } = useStudentPortal();
  const { announcements } = usePortalStore();

  const visible = announcements
    .filter((a) => isAnnouncementVisibleToStudent(a, student))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return a.createdAt < b.createdAt ? 1 : -1;
    });

  return (
    <div className="flex flex-col gap-4">
      {visible.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Megaphone size={28} className="text-maia-ink-soft/40" />
            <p className="text-sm font-medium text-maia-ink">No announcements yet</p>
            <p className="text-sm text-maia-ink-soft">Check back here for updates from the Academy.</p>
          </div>
        </Card>
      ) : (
        visible.map((a) => (
          <Card key={a.id} className={a.important ? "border-maia-gold/40 bg-maia-gold-bg/30" : undefined}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {a.pinned && <Pin size={13} className="text-maia-gold-deep" />}
                  <p className="text-sm font-semibold text-maia-ink">{a.title}</p>
                  {a.important && <Badge tone="gold">Important</Badge>}
                </div>
                <p className="mt-2 text-sm text-maia-ink-soft">{a.message}</p>
                {a.attachmentUrl && (
                  <a href={a.attachmentUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold text-maia-gold-deep underline">
                    {a.attachmentLabel || "View Attachment"}
                  </a>
                )}
              </div>
              <p className="flex-shrink-0 text-xs text-maia-ink-soft">{a.date}</p>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
