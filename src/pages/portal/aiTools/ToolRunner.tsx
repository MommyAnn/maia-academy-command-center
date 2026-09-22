import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronUp, Download, Heart, Loader2, Send, Sparkles, Archive as ArchiveIcon, FolderPlus } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { TextField } from "@/components/common/TextField";
import { TextAreaField } from "@/components/common/TextAreaField";
import { SelectField } from "@/components/common/SelectField";
import { ChipMultiSelect } from "@/components/common/ChipMultiSelect";
import { ToolIcon } from "@/components/aiTools/ToolIcon";
import { MasterBrainConnectionCard } from "@/components/aiTools/MasterBrainConnectionCard";
import { AiOutputView } from "@/components/aiTools/AiOutputView";
import { useStudentPortal } from "@/context/StudentPortalContext";
import { useAiToolsStore } from "@/data/aiToolsStore";
import type { AiGeneration, AiProjectType } from "@/types/aiTools";
import { AI_PROJECT_TYPES } from "@/types/aiTools";

const NEW_PRODUCT_VALUE = "__new_not_in_master_brain__";

const LOADING_STEPS = ["ANALYZING YOUR BRAND MASTER BRAIN...", "BUILDING YOUR STRATEGY...", "GENERATING...", "PREPARING YOUR OUTPUT..."];

export function ToolRunner() {
  const { toolId } = useParams<{ toolId: string }>();
  const [searchParams] = useSearchParams();
  const sourceGenerationId = searchParams.get("from");
  const navigate = useNavigate();
  const { student } = useStudentPortal();
  const {
    tools,
    projects,
    generations,
    getBusinessContext,
    hasToolAccess,
    generate,
    regenerate,
    createProject,
    addOutputToProject,
    toggleFavorite,
    archiveGeneration,
    editGenerationSection,
    logActivity,
  } = useAiToolsStore();

  const tool = tools.find((t) => t.id === toolId);
  const ctx = useMemo(() => getBusinessContext(student.id), [getBusinessContext, student.id]);
  const access = tool ? hasToolAccess(student.id, tool.id) : false;
  const sourceGeneration = sourceGenerationId ? generations.find((g) => g.id === sourceGenerationId && g.studentId === student.id) : null;

  const [form, setForm] = useState<Record<string, string>>({});
  const [newProductText, setNewProductText] = useState("");
  const [contextOpen, setContextOpen] = useState(false);
  const [loadingStep, setLoadingStep] = useState<number | null>(null);
  const [result, setResult] = useState<AiGeneration | null>(null);
  const [saveTarget, setSaveTarget] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectType, setNewProjectType] = useState<AiProjectType>("Other");
  const [showNewProject, setShowNewProject] = useState(false);
  const [sendToTool, setSendToTool] = useState("");

  useEffect(() => {
    if (tool) logActivity({ studentId: student.id, businessId: ctx?.businessId ?? null, action: "Tool Opened", toolId: tool.id, summary: `Opened ${tool.name}` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool?.id]);

  if (!tool) {
    return (
      <Card>
        <p className="text-sm text-maia-ink-soft">Tool not found.</p>
      </Card>
    );
  }

  const myProjects = projects.filter((p) => p.studentId === student.id);
  const otherTools = tools.filter((t) => t.id !== tool.id && t.status === "Active" && hasToolAccess(student.id, t.id));

  function setField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function runGeneration() {
    if (!ctx || !tool) return;
    let step = 0;
    setResult(null);
    setLoadingStep(step);
    const interval = setInterval(() => {
      step += 1;
      if (step >= LOADING_STEPS.length) {
        clearInterval(interval);
        const userInput = { ...form };
        if (userInput.product === NEW_PRODUCT_VALUE) userInput.product = newProductText;
        const generation = generate({
          studentId: student.id,
          businessId: ctx.businessId,
          toolId: tool.id,
          projectId: null,
          userInput,
          sourceGenerationId: sourceGenerationId ?? null,
        });
        setResult(generation);
        setLoadingStep(null);
      } else {
        setLoadingStep(step);
      }
    }, 550);
  }

  function handleSaveToProject() {
    if (!result || !ctx) return;
    if (showNewProject) {
      if (!newProjectName.trim()) return;
      const project = createProject({ studentId: student.id, businessId: ctx.businessId, name: newProjectName.trim(), type: newProjectType, masterBrainVersion: ctx.masterBrainVersion });
      addOutputToProject(result.id, project.id);
      setSaveTarget(project.id);
      setShowNewProject(false);
      setNewProjectName("");
    } else if (saveTarget) {
      addOutputToProject(result.id, saveTarget);
    }
  }

  function handleSendToTool() {
    if (!result || !sendToTool) return;
    navigate(`/portal/ai-tools/tools/${sendToTool}?from=${result.id}`);
  }

  function handleExport() {
    if (!result) return;
    const text = result.output.sections
      .map((s) => `${s.title}\n${"-".repeat(s.title.length)}\n${s.content}${s.items.length ? "\n" + s.items.map((i) => Object.values(i).join(" | ")).join("\n") : ""}`)
      .join("\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.generationId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const blocked = !ctx || !ctx.masterBrainPublished || !access;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-maia-gold-bg text-maia-gold-deep">
          <ToolIcon name={tool.icon} size={20} />
        </div>
        <div>
          <h1 className="font-display text-lg font-bold text-maia-ink">{tool.name}</h1>
          <p className="text-sm text-maia-ink-soft">{tool.description}</p>
        </div>
      </div>

      {!access && (
        <Card className="border-maia-danger/30 bg-maia-danger-bg/40">
          <p className="text-sm font-semibold text-maia-ink">This tool isn&rsquo;t included in your current package.</p>
        </Card>
      )}

      <Card padded={false}>
        <button onClick={() => setContextOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 px-5 py-3.5 sm:px-6">
          <span className="text-xs font-bold uppercase tracking-wide text-maia-ink-soft">Master Brain Context</span>
          {contextOpen ? <ChevronUp size={16} className="text-maia-ink-soft" /> : <ChevronDown size={16} className="text-maia-ink-soft" />}
        </button>
        {contextOpen && (
          <div className="px-5 pb-5 sm:px-6">
            <MasterBrainConnectionCard ctx={ctx} compact />
          </div>
        )}
      </Card>

      {sourceGeneration && (
        <Card className="border-maia-info/30 bg-maia-info-bg/30">
          <p className="text-xs font-bold uppercase tracking-wide text-maia-ink-soft">Sent From</p>
          <p className="mt-1 text-sm text-maia-ink">
            {tools.find((t) => t.id === sourceGeneration.toolId)?.name ?? sourceGeneration.toolId} output — {sourceGeneration.output.sections[0]?.content.slice(0, 140) || "(table output)"}
          </p>
        </Card>
      )}

      {ctx && !ctx.masterBrainPublished && <MasterBrainConnectionCard ctx={ctx} />}
      {!ctx && (
        <Card className="border-maia-danger/30 bg-maia-danger-bg/40">
          <p className="text-sm font-semibold text-maia-ink">MASTER BRAIN NOT FOUND</p>
          <p className="mt-1 text-xs text-maia-ink-soft">We couldn&rsquo;t locate your student record context.</p>
        </Card>
      )}

      {!blocked && (
        <Card>
          <CardHeader title="Tell Us What You Need" subtitle="We only ask what your Master Brain doesn't already know." />
          <div className="flex flex-col gap-4">
            {tool.inputFields.map((field) => {
              if (field.key === "product" && ctx.offers.length > 0) {
                const isNew = form.product === NEW_PRODUCT_VALUE;
                return (
                  <div key={field.key} className="flex flex-col gap-2">
                    <SelectField
                      label={field.label}
                      required={field.required}
                      placeholder="Select a product / service"
                      value={form.product ?? ""}
                      onChange={(e) => setField("product", e.target.value)}
                      options={[...ctx.offers.map((o) => ({ value: o.name, label: o.name })), { value: NEW_PRODUCT_VALUE, label: "NEW / NOT YET IN MASTER BRAIN" }]}
                    />
                    {isNew && (
                      <TextField label="New product / service name" value={newProductText} onChange={(e) => setNewProductText(e.target.value)} placeholder="Describe the new product" />
                    )}
                  </div>
                );
              }
              if (field.type === "select") {
                return (
                  <SelectField
                    key={field.key}
                    label={field.label}
                    required={field.required}
                    placeholder={field.placeholder ?? "Select..."}
                    value={form[field.key] ?? ""}
                    onChange={(e) => setField(field.key, e.target.value)}
                    options={(field.options ?? []).map((o) => ({ value: o, label: o }))}
                  />
                );
              }
              if (field.type === "textarea") {
                return (
                  <TextAreaField key={field.key} label={field.label} required={field.required} placeholder={field.placeholder} value={form[field.key] ?? ""} onChange={(e) => setField(field.key, e.target.value)} />
                );
              }
              if (field.type === "multiselect") {
                return (
                  <ChipMultiSelect
                    key={field.key}
                    label={field.label}
                    options={field.options ?? []}
                    value={form[field.key] ? form[field.key].split(",") : []}
                    onChange={(next) => setField(field.key, next.join(","))}
                  />
                );
              }
              return (
                <TextField
                  key={field.key}
                  type={field.type === "number" ? "number" : "text"}
                  label={field.label}
                  required={field.required}
                  placeholder={field.placeholder}
                  value={form[field.key] ?? ""}
                  onChange={(e) => setField(field.key, e.target.value)}
                />
              );
            })}

            {loadingStep !== null ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-maia-gold/30 bg-maia-gold-bg/40 px-4 py-3.5">
                <Loader2 size={16} className="animate-spin text-maia-gold-deep" />
                <p className="text-sm font-semibold text-maia-gold-deep">{LOADING_STEPS[loadingStep]}</p>
              </div>
            ) : (
              <Button onClick={runGeneration} className="self-start">
                <Sparkles size={15} />
                GENERATE
              </Button>
            )}
          </div>
        </Card>
      )}

      {result && result.status === "Failed" && (
        <Card className="border-maia-danger/30 bg-maia-danger-bg/40">
          <p className="text-sm font-semibold text-maia-ink">{result.failureReason}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={runGeneration}>
            Retry
          </Button>
        </Card>
      )}

      {result && result.status === "Completed" && (
        <Card>
          <CardHeader
            title="Your Output"
            subtitle={`Master Brain v${result.masterBrainVersion} · ${result.generationId}`}
            action={
              <div className="flex items-center gap-2">
                <button onClick={() => toggleFavorite(result.id)} title="Favorite">
                  <Heart size={18} className={result.favorited ? "fill-maia-danger text-maia-danger" : "text-maia-ink-soft"} />
                </button>
                <button onClick={() => archiveGeneration(result.id)} title="Archive">
                  <ArchiveIcon size={18} className="text-maia-ink-soft hover:text-maia-ink" />
                </button>
                <button onClick={handleExport} title="Export">
                  <Download size={18} className="text-maia-ink-soft hover:text-maia-ink" />
                </button>
              </div>
            }
          />

          <AiOutputView output={result.output} onEditSection={(key, content) => editGenerationSection(result.id, key, content)} />

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-maia-border pt-4">
            <Button variant="secondary" size="sm" onClick={() => setResult(regenerate(result.id))}>
              Regenerate
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setResult(regenerate(result.id))}>
              Create Variation
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 border-t border-maia-border pt-4 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-maia-ink-soft">Add To Project</p>
              {!showNewProject ? (
                <div className="flex gap-2">
                  <SelectField
                    label="Project"
                    className="flex-1"
                    placeholder="Select a project"
                    value={saveTarget}
                    onChange={(e) => setSaveTarget(e.target.value)}
                    options={myProjects.map((p) => ({ value: p.id, label: `${p.name} (${p.projectId})` }))}
                  />
                  <Button size="sm" variant="secondary" onClick={handleSaveToProject} disabled={!saveTarget}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowNewProject(true)}>
                    <FolderPlus size={14} />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <TextField label="New project name" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} />
                  <SelectField label="Type" value={newProjectType} onChange={(e) => setNewProjectType(e.target.value as AiProjectType)} options={AI_PROJECT_TYPES.map((t) => ({ value: t, label: t }))} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveToProject}>
                      Create &amp; Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowNewProject(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-maia-ink-soft">Send To Another Tool</p>
              <div className="flex gap-2">
                <SelectField
                  label="Tool"
                  className="flex-1"
                  placeholder="Select a tool"
                  value={sendToTool}
                  onChange={(e) => setSendToTool(e.target.value)}
                  options={otherTools.map((t) => ({ value: t.id, label: t.name }))}
                />
                <Button size="sm" variant="secondary" onClick={handleSendToTool} disabled={!sendToTool}>
                  <Send size={14} />
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
