import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { formatApiError } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Robot, Trash, Sparkle, ChatText, ArrowRight, Brain, Cube, Lightning, CaretRight, CaretLeft, CheckCircle, Gear } from "@phosphor-icons/react";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

const defaultPrompt = "You are AgentForge — an intelligent IT operations assistant. You have access to external vendor APIs as tools.\n\nYour capabilities:\n• Discover and analyse infrastructure, services, databases, and applications\n• Perform root cause analysis on incidents and outages\n• Monitor operational status and health of assets\n• Generate reports and summaries from live data\n• Answer questions by querying the attached systems\n\nAlways decide which tool to call based on the user's intent, extract parameters carefully, and present results in clear, actionable prose.";

const emptyForm = {
  name: "",
  description: "",
  llm_config_id: "",
  asset_ids: [],
  system_prompt: defaultPrompt,
};

export default function WorkspacesList() {
  const [items, setItems] = useState([]);
  const [llms, setLlms] = useState([]);
  const [assets, setAssets] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const load = async () => {
    const [w, l, a] = await Promise.all([
      api.get("/workspaces"), api.get("/llm-configs"), api.get("/assets"),
    ]);
    setItems(w.data); setLlms(l.data); setAssets(a.data);
  };
  useEffect(() => { load(); }, []);

  const toggleAsset = (id) =>
    setForm((f) => ({ ...f, asset_ids: f.asset_ids.includes(id) ? f.asset_ids.filter((x) => x !== id) : [...f.asset_ids, id] }));

  const save = async () => {
    try {
      await api.post("/workspaces", form);
      toast.success("Workspace created");
      setOpen(false); setForm(emptyForm); load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete workspace and all its data?")) return;
    await api.delete(`/workspaces/${id}`); load();
  };

  return (
    <div className="p-8 max-w-[1280px] mx-auto" data-testid="workspaces-page">
      <PageHeader
        label="workspaces"
        title="Agents"
        description="Each workspace is an agent: one LLM + attached assets + private chat."
        action={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setStep(0); setForm(emptyForm); } }}>
            <DialogTrigger asChild><Button className="rounded-xl gap-2" data-testid="new-workspace-button"><Plus size={14} /> New workspace</Button></DialogTrigger>
            <DialogContent className="max-w-2xl bg-card border-border p-0 overflow-hidden">
              {/* ── Header with gradient accent ── */}
              <div className="relative px-6 pt-6 pb-4">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <Sparkle size={18} weight="fill" className="text-white" />
                    </div>
                    <div>
                      <DialogTitle className="text-lg">Create workspace</DialogTitle>
                      <p className="text-[13px] text-white/40 mt-0.5">Configure your intelligent agent in 3 steps</p>
                    </div>
                  </div>
                </DialogHeader>

                {/* ── Step indicators ── */}
                <div className="flex items-center gap-2 mt-5">
                  {[
                    { icon: Sparkle, label: "Identity" },
                    { icon: Brain, label: "LLM & Assets" },
                    { icon: Gear, label: "Behaviour" },
                  ].map((s, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <div className={`flex-1 h-px ${i <= step ? "bg-emerald-500/40" : "bg-white/[0.06]"}`} />}
                      <button
                        onClick={() => i < step && setStep(i)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                          i === step
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : i < step
                            ? "text-emerald-400/60 hover:text-emerald-400 cursor-pointer"
                            : "text-white/25"
                        }`}
                      >
                        {i < step ? <CheckCircle size={13} weight="fill" /> : <s.icon size={13} />}
                        {s.label}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div className="px-6 pb-2">
                <div className="h-px bg-white/[0.06]" />
              </div>

              {/* ── Step 0: Identity ── */}
              {step === 0 && (
                <div className="px-6 pb-6 space-y-4">
                  <div>
                    <Label className="text-[12px] font-medium text-white/60">workspace name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g. CMDB Analyser, Backup Monitor, Incident Bot"
                      className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5 h-11"
                      autoFocus
                      data-testid="workspace-name"
                    />
                  </div>
                  <div>
                    <Label className="text-[12px] font-medium text-white/60">description <span className="text-white/25">(optional)</span></Label>
                    <Textarea
                      rows={3}
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Describe what this agent will do — analyse CMDB data, monitor backups, respond to incidents..."
                      className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5"
                    />
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button onClick={() => setStep(1)} disabled={!form.name} className="rounded-xl gap-2">
                      Next <CaretRight size={14} />
                    </Button>
                  </div>
                </div>
              )}

              {/* ── Step 1: LLM & Assets ── */}
              {step === 1 && (
                <div className="px-6 pb-6 space-y-5">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Brain size={14} className="text-white/40" />
                      <Label className="text-[12px] font-medium text-white/60">llm provider</Label>
                    </div>
                    <Select value={form.llm_config_id} onValueChange={(v) => setForm({ ...form, llm_config_id: v })}>
                      <SelectTrigger className="bg-white/[0.04] border-white/[0.08] rounded-lg h-11" data-testid="workspace-llm">
                        <SelectValue placeholder="Select an LLM provider..." />
                      </SelectTrigger>
                      <SelectContent>
                        {llms.length === 0
                          ? <div className="p-3 text-sm text-muted-foreground">No LLMs configured. <Link to="/llm" className="text-primary underline">Add one</Link></div>
                          : llms.map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              <span className="font-medium">{l.name}</span>
                              <span className="text-white/40 ml-2">{l.provider}/{l.model}</span>
                            </SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Cube size={14} className="text-white/40" />
                      <Label className="text-[12px] font-medium text-white/60">attach assets</Label>
                    </div>
                    <p className="text-[11px] text-white/25 mb-2">Select which API assets this agent can access as tools.</p>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] max-h-52 overflow-y-auto">
                      {assets.length === 0
                        ? <div className="text-sm text-muted-foreground p-4 text-center">No assets yet. <Link to="/assets" className="text-primary underline">Add one</Link></div>
                        : assets.map((a, i) => (
                          <label
                            key={a.id}
                            className={`flex items-center gap-3 text-sm cursor-pointer hover:bg-white/[0.04] px-4 py-3 transition-colors ${
                              i > 0 ? "border-t border-white/[0.04]" : ""
                            } ${form.asset_ids.includes(a.id) ? "bg-emerald-500/[0.04]" : ""}`}
                          >
                            <input
                              type="checkbox"
                              className="rounded accent-emerald-500"
                              checked={form.asset_ids.includes(a.id)}
                              onChange={() => toggleAsset(a.id)}
                              data-testid={`toggle-asset-${a.id}`}
                            />
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/[0.06] text-white/40 shrink-0">{a.vendor}</span>
                              <span className="truncate">{a.name}</span>
                            </div>
                            {form.asset_ids.includes(a.id) && (
                              <CheckCircle size={14} weight="fill" className="text-emerald-400 shrink-0" />
                            )}
                          </label>
                        ))
                      }
                    </div>
                    {form.asset_ids.length > 0 && (
                      <p className="text-[11px] text-emerald-400/60 mt-2 flex items-center gap-1">
                        <Lightning size={11} /> {form.asset_ids.length} asset{form.asset_ids.length > 1 ? "s" : ""} selected
                      </p>
                    )}
                  </div>
                  <div className="flex justify-between pt-2">
                    <Button variant="outline" onClick={() => setStep(0)} className="rounded-xl gap-2">
                      <CaretLeft size={14} /> Back
                    </Button>
                    <Button onClick={() => setStep(2)} disabled={!form.llm_config_id} className="rounded-xl gap-2">
                      Next <CaretRight size={14} />
                    </Button>
                  </div>
                </div>
              )}

              {/* ── Step 2: Behaviour ── */}
              {step === 2 && (
                <div className="px-6 pb-6 space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Gear size={14} className="text-white/40" />
                        <Label className="text-[12px] font-medium text-white/60">system prompt</Label>
                      </div>
                      <button
                        type="button"
                        className="text-[11px] text-white/25 hover:text-white/50 transition-colors"
                        onClick={() => setForm({ ...form, system_prompt: defaultPrompt })}
                      >
                        reset to default
                      </button>
                    </div>
                    <Textarea
                      rows={8}
                      value={form.system_prompt}
                      onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
                      className="bg-white/[0.04] border-white/[0.08] rounded-lg font-mono text-xs leading-relaxed"
                      placeholder="Describe the agent's role, capabilities, and behaviour..."
                    />
                    <p className="text-[11px] text-white/25 mt-1.5">Customise to match your use case — CMDB analysis, backup monitoring, incident response, etc.</p>
                  </div>

                  {/* ── Summary ── */}
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider mb-3">Summary</p>
                    <div className="space-y-2 text-[13px]">
                      <div className="flex items-center justify-between">
                        <span className="text-white/40">Name</span>
                        <span className="font-medium text-white/80">{form.name || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/40">LLM</span>
                        <span className="font-medium text-white/80">
                          {llms.find((l) => l.id === form.llm_config_id)?.name || "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/40">Assets</span>
                        <span className="font-medium text-white/80">{form.asset_ids.length} connected</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between pt-2">
                    <Button variant="outline" onClick={() => setStep(1)} className="rounded-xl gap-2">
                      <CaretLeft size={14} /> Back
                    </Button>
                    <Button
                      onClick={save}
                      disabled={!form.name || !form.llm_config_id}
                      className="rounded-xl gap-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 border-0 shadow-lg shadow-emerald-500/20"
                      data-testid="save-workspace-button"
                    >
                      <Sparkle size={14} weight="fill" /> Create workspace
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Robot}
          title="No workspaces yet"
          description="Create a workspace to pair an LLM with your assets and start chatting."
          action={
            <Button size="sm" className="gap-2 rounded-xl" onClick={() => setOpen(true)}>
              <Plus size={14} /> New workspace
            </Button>
          }
        />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((w) => (
            <Link key={w.id} to={`/workspaces/${w.id}`} data-testid={`workspace-card-${w.id}`}>
              <div className="group rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 hover:bg-white/[0.06] hover:border-white/[0.1] transition-all h-full">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[12px] bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <Sparkle size={18} weight="fill" className="text-white" />
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold text-white/90">{w.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-white/30 font-medium">{w.asset_ids?.length || 0} assets</span>
                        <span className="text-white/10">·</span>
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400/60 font-medium">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" /> Active
                        </span>
                      </div>
                    </div>
                  </div>
                  <button onClick={(e) => { e.preventDefault(); remove(w.id); }} className="text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><Trash size={14} /></button>
                </div>
                {w.description && <div className="text-[12px] text-white/35 mt-4 line-clamp-2 leading-relaxed">{w.description}</div>}
                <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] text-white/25">
                    <ChatText size={12} />
                    <span>Start conversation</span>
                  </div>
                  <ArrowRight size={12} className="text-white/15 group-hover:text-white/40 transition-colors" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
