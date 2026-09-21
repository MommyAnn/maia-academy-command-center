import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Award, CalendarClock, ClipboardList, CreditCard, Package, Search, Truck, User, Users } from "lucide-react";
import { useStudentStore } from "@/data/studentStore";
import { useFinanceStore } from "@/data/financeStore";
import { useTaskStore } from "@/data/taskStore";
import { useStaffStore } from "@/data/staffStore";
import { useInventoryStore } from "@/data/inventoryStore";
import { useTrainingStore } from "@/data/trainingStore";

const MAX_PER_GROUP = 5;

export function GlobalSearch() {
  const { students } = useStudentStore();
  const { transactions } = useFinanceStore();
  const { tasks } = useTaskStore();
  const { staff } = useStaffStore();
  const { items, suppliers } = useInventoryStore();
  const { sessions, certificates } = useTrainingStore();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { students: [], payments: [], tasks: [], staff: [], sessions: [], certificates: [], items: [], suppliers: [] };

    const studentMatches = students
      .filter((s) =>
        `${s.fullName} ${s.studentId} ${s.facebookName} ${s.email} ${s.contactNumber}`.toLowerCase().includes(q),
      )
      .slice(0, MAX_PER_GROUP);

    const paymentMatches = transactions
      .filter((t) => `${t.id} ${t.referenceNumber} ${t.studentName}`.toLowerCase().includes(q))
      .slice(0, MAX_PER_GROUP);

    const taskMatches = tasks
      .filter((t) => `${t.id} ${t.title} ${t.assignedToName} ${t.relatedStudentName ?? ""}`.toLowerCase().includes(q))
      .slice(0, MAX_PER_GROUP);

    const staffMatches = staff
      .filter((s) => `${s.fullName} ${s.staffId} ${s.email} ${s.role}`.toLowerCase().includes(q))
      .slice(0, MAX_PER_GROUP);

    const sessionMatches = sessions
      .filter((s) => `${s.sessionId} ${s.title} ${s.batch}`.toLowerCase().includes(q))
      .slice(0, MAX_PER_GROUP);

    const certificateMatches = certificates
      .filter((c) => {
        const student = students.find((s) => s.id === c.studentId);
        return `${c.certificateId} ${student?.fullName ?? ""} ${c.batch}`.toLowerCase().includes(q);
      })
      .slice(0, MAX_PER_GROUP);

    const itemMatches = items
      .filter((i) => `${i.itemId} ${i.name} ${i.sku} ${i.category}`.toLowerCase().includes(q))
      .slice(0, MAX_PER_GROUP);

    const supplierMatches = suppliers.filter((s) => `${s.name} ${s.contactPerson}`.toLowerCase().includes(q)).slice(0, MAX_PER_GROUP);

    return {
      students: studentMatches,
      payments: paymentMatches,
      tasks: taskMatches,
      staff: staffMatches,
      sessions: sessionMatches,
      certificates: certificateMatches,
      items: itemMatches,
      suppliers: supplierMatches,
    };
  }, [query, students, transactions, tasks, staff, sessions, certificates, items, suppliers]);

  const hasResults =
    results.students.length +
      results.payments.length +
      results.tasks.length +
      results.staff.length +
      results.sessions.length +
      results.certificates.length +
      results.items.length +
      results.suppliers.length >
    0;

  function goTo(path: string) {
    setOpen(false);
    setQuery("");
    navigate(path);
  }

  return (
    <div ref={containerRef} className="relative ml-2 hidden max-w-md flex-1 md:block">
      <div className="flex items-center gap-2 rounded-lg border border-maia-border bg-maia-bg px-3 py-2 text-sm text-maia-ink-soft">
        <Search size={16} className="flex-shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search students, payments, tasks, staff, sessions..."
          className="w-full bg-transparent text-maia-ink outline-none placeholder:text-maia-ink-soft/60"
        />
      </div>

      {open && query.trim() && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-maia-border bg-maia-surface shadow-lg">
          {!hasResults ? (
            <p className="px-4 py-6 text-center text-sm text-maia-ink-soft">No results for &ldquo;{query}&rdquo;.</p>
          ) : (
            <>
              {results.students.length > 0 && (
                <ResultGroup label="Students" icon={<User size={13} />}>
                  {results.students.map((s) => (
                    <ResultRow
                      key={s.id}
                      primary={s.fullName}
                      secondary={s.studentId}
                      onClick={() => goTo(`/students/${s.id}`)}
                    />
                  ))}
                </ResultGroup>
              )}

              {results.payments.length > 0 && (
                <ResultGroup label="Payments" icon={<CreditCard size={13} />}>
                  {results.payments.map((t) => (
                    <ResultRow
                      key={t.id}
                      primary={t.id}
                      secondary={`${t.studentName} · ${t.referenceNumber || "no reference"}`}
                      onClick={() => goTo(`/finance/payments?search=${encodeURIComponent(t.id)}`)}
                    />
                  ))}
                </ResultGroup>
              )}

              {results.tasks.length > 0 && (
                <ResultGroup label="Tasks" icon={<ClipboardList size={13} />}>
                  {results.tasks.map((t) => (
                    <ResultRow
                      key={t.id}
                      primary={t.title}
                      secondary={`${t.assignedToName}${t.relatedStudentName ? ` · ${t.relatedStudentName}` : ""}`}
                      onClick={() => goTo(`/team/tasks/${encodeURIComponent(t.id)}`)}
                    />
                  ))}
                </ResultGroup>
              )}

              {results.staff.length > 0 && (
                <ResultGroup label="Staff" icon={<Users size={13} />}>
                  {results.staff.map((s) => (
                    <ResultRow
                      key={s.id}
                      primary={s.fullName}
                      secondary={`${s.staffId} · ${s.role === "Custom Role" ? s.customRoleLabel || "Custom Role" : s.role}`}
                      onClick={() => goTo(`/team/staff/${s.id}`)}
                    />
                  ))}
                </ResultGroup>
              )}

              {results.sessions.length > 0 && (
                <ResultGroup label="Training Sessions" icon={<CalendarClock size={13} />}>
                  {results.sessions.map((s) => (
                    <ResultRow
                      key={s.id}
                      primary={s.title}
                      secondary={`${s.sessionId} · ${s.batch}`}
                      onClick={() => goTo(`/training/sessions/${s.id}`)}
                    />
                  ))}
                </ResultGroup>
              )}

              {results.certificates.length > 0 && (
                <ResultGroup label="Certificates" icon={<Award size={13} />}>
                  {results.certificates.map((c) => {
                    const student = students.find((s) => s.id === c.studentId);
                    return (
                      <ResultRow
                        key={c.id}
                        primary={c.certificateId}
                        secondary={student?.fullName ?? c.batch}
                        onClick={() => goTo(student ? `/students/${student.id}` : "/training/certificates")}
                      />
                    );
                  })}
                </ResultGroup>
              )}

              {results.items.length > 0 && (
                <ResultGroup label="Inventory Items" icon={<Package size={13} />}>
                  {results.items.map((i) => (
                    <ResultRow key={i.id} primary={i.name} secondary={`${i.itemId} · ${i.sku || "no SKU"}`} onClick={() => goTo("/inventory/all-items")} />
                  ))}
                </ResultGroup>
              )}

              {results.suppliers.length > 0 && (
                <ResultGroup label="Suppliers" icon={<Truck size={13} />}>
                  {results.suppliers.map((s) => (
                    <ResultRow key={s.id} primary={s.name} secondary={s.contactPerson || "No contact person"} onClick={() => goTo("/inventory/suppliers")} />
                  ))}
                </ResultGroup>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ResultGroup({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-b border-maia-border py-1.5 last:border-0">
      <p className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-maia-ink-soft">
        {icon}
        {label}
      </p>
      {children}
    </div>
  );
}

function ResultRow({ primary, secondary, onClick }: { primary: string; secondary: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full flex-col items-start px-4 py-2 text-left hover:bg-maia-bg"
    >
      <span className="text-sm font-medium text-maia-ink">{primary}</span>
      <span className="font-mono text-xs text-maia-ink-soft">{secondary}</span>
    </button>
  );
}
