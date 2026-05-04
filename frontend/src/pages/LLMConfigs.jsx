import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Brain, Trash, Lightning, Cpu, Key, Globe, CheckCircle, Cloud, Desktop, CaretRight, CaretLeft } from "@phosphor-icons/react";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

/* ── Provider catalogue ── */
const PROVIDERS = {
  openai:    { label: "OpenAI",        cat: "cloud", desc: "GPT-4o, o1, o3 series",       model: "gpt-4o-mini",                    keyHint: "sk-..." },
  anthropic: { label: "Anthropic",     cat: "cloud", desc: "Claude Opus, Sonnet, Haiku",   model: "claude-sonnet-4-5-20250929",         keyHint: "sk-ant-..." },
  gemini:    { label: "Google Gemini", cat: "cloud", desc: "Gemini 2.5 Flash & Pro",       model: "gemini-2.5-flash",               keyHint: "AI..." },
  azure:     { label: "Azure OpenAI",  cat: "cloud", desc: "Azure-hosted deployment",      model: "gpt-4o-mini",                    keyHint: "...",     baseUrl: "https://<resource>.openai.azure.com/v1" },
  groq:      { label: "Groq",          cat: "cloud", desc: "Ultra-fast cloud inference",   model: "llama-3.3-70b-versatile",        keyHint: "gsk_...", baseUrl: "https://api.groq.com/openai/v1" },
  deepseek:  { label: "DeepSeek",      cat: "cloud", desc: "V3, R1, Coder",               model: "deepseek-chat",                  keyHint: "sk-...",  baseUrl: "https://api.deepseek.com/v1" },
  together:  { label: "Together AI",   cat: "cloud", desc: "Hosted open-source models",    model: "meta-llama/Llama-3-70b-chat-hf", keyHint: "...",     baseUrl: "https://api.together.xyz/v1" },
  mistral:   { label: "Mistral AI",    cat: "cloud", desc: "Mistral Large, Codestral",     model: "mistral-large-latest",           keyHint: "...",     baseUrl: "https://api.mistral.ai/v1" },
  ollama:    { label: "Ollama",        cat: "local", desc: "Run models locally",            model: "qwen2.5:3b",                    keyHint: "",        baseUrl: "http://localhost:11434/v1" },
  lmstudio:  { label: "LM Studio",    cat: "local", desc: "Desktop inference app",         model: "local-model",                    keyHint: "",        baseUrl: "http://localhost:1234/v1" },
  vllm:      { label: "vLLM",          cat: "local", desc: "High-throughput serving",       model: "",                               keyHint: "",        baseUrl: "http://localhost:8000/v1" },
  custom:    { label: "Custom",        cat: "other", desc: "Any OpenAI-compatible API",     model: "",                               keyHint: "",        baseUrl: "" },
};

const CATS = [
  { key: "cloud", label: "Cloud providers", icon: Cloud },
  { key: "local", label: "Local / Self-hosted", icon: Desktop },
  { key: "other", label: "Other", icon: Globe },
];

const emptyForm = { name: "", provider: "openai", api_key: "", base_url: "", model: "gpt-4o-mini" };

export default function LLMConfigs() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null);
  const [step, setStep] = useState(0);

  const load = async () => { const { data } = await api.get("/llm-configs"); setItems(data); };
  useEffect(() => { load(); }, []);

  const pickProvider = (k) => {
    const p = PROVIDERS[k];
    setForm((f) => ({ ...f, provider: k, model: p.model, base_url: p.baseUrl || "" }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/llm-configs", form);
      toast.success("Provider added");
      setOpen(false); setStep(0); setForm(emptyForm); load();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete LLM provider?")) return;
    await api.delete(`/llm-configs/${id}`); load();
  };

  const testLlm = async (id) => {
    setTesting(id);
    try {
      const { data } = await api.post(`/llm-configs/${id}/test`);
      toast.success(`Model responded: "${data.reply}"`, { duration: 5000 });
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setTesting(null);
    }
  };

  const prov = PROVIDERS[form.provider] || {};
  const needsKey = prov.cat === "cloud" || form.provider === "custom";
  const needsUrl = prov.cat === "local" || form.provider === "custom" || !!prov.baseUrl;

  return (
    <div className="p-8 max-w-[1280px] mx-auto" data-testid="llm-page">
      <PageHeader
        label="llm providers"
        title="Model providers"
        description="Cloud, local, or self-hosted — connect any LLM from anywhere."
        action={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setStep(0); setForm(emptyForm); } }}>
            <DialogTrigger asChild><Button className="rounded-xl gap-2" data-testid="add-llm-button"><Plus size={14} /> Add provider</Button></DialogTrigger>
            <DialogContent className="max-w-2xl bg-card border-border p-0 overflow-hidden">
              {/* ── Header ── */}
              <div className="relative px-6 pt-6 pb-4">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-fuchsia-500 via-violet-500 to-blue-500" />
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-500 flex items-center justify-center shadow-lg shadow-fuchsia-500/20">
                      <Brain size={18} weight="fill" className="text-white" />
                    </div>
                    <div>
                      <DialogTitle className="text-lg">Add LLM provider</DialogTitle>
                      <p className="text-[13px] text-white/40 mt-0.5">Cloud APIs, local models, or any OpenAI-compatible endpoint</p>
                    </div>
                  </div>
                </DialogHeader>

                {/* ── Step indicators ── */}
                <div className="flex items-center gap-2 mt-5">
                  {[
                    { icon: Globe, label: "Choose provider" },
                    { icon: Key, label: "Configure" },
                  ].map((s, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <div className={`flex-1 h-px ${i <= step ? "bg-fuchsia-500/40" : "bg-white/[0.06]"}`} />}
                      <button
                        onClick={() => i < step && setStep(i)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                          i === step
                            ? "bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/30"
                            : i < step
                            ? "text-fuchsia-400/60 hover:text-fuchsia-400 cursor-pointer"
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

              <div className="px-6"><div className="h-px bg-white/[0.06]" /></div>

              {/* ── Step 0: Provider selection ── */}
              {step === 0 && (
                <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
                  {CATS.map(({ key: catKey, label: catLabel, icon: CatIcon }) => {
                    const provs = Object.entries(PROVIDERS).filter(([, v]) => v.cat === catKey);
                    if (!provs.length) return null;
                    return (
                      <div key={catKey}>
                        <div className="flex items-center gap-2 mb-2.5">
                          <CatIcon size={13} className="text-white/30" />
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/30">{catLabel}</span>
                        </div>
                        <div className={`grid ${catKey === "cloud" ? "grid-cols-2 sm:grid-cols-4" : catKey === "local" ? "grid-cols-3" : "grid-cols-1"} gap-2`}>
                          {provs.map(([k, v]) => (
                            <button
                              key={k}
                              type="button"
                              onClick={() => { pickProvider(k); setStep(1); }}
                              className={`group relative flex flex-col items-start gap-1 px-3.5 py-3 rounded-xl border text-left transition-all ${
                                form.provider === k
                                  ? "border-fuchsia-500/40 bg-fuchsia-500/[0.06] text-white ring-1 ring-fuchsia-500/20"
                                  : "border-white/[0.06] bg-white/[0.02] text-white/60 hover:bg-white/[0.05] hover:border-white/[0.12] hover:text-white/80"
                              }`}
                              data-testid={`llm-provider-${k}`}
                            >
                              <div className="flex items-center gap-2 w-full">
                                {v.cat === "local" ? <Desktop size={15} className="shrink-0" /> : v.cat === "other" ? <Globe size={15} className="shrink-0" /> : <Cloud size={15} className="shrink-0" />}
                                <span className="font-semibold text-[13px]">{v.label}</span>
                                {form.provider === k && <CheckCircle size={13} weight="fill" className="ml-auto text-fuchsia-400 shrink-0" />}
                              </div>
                              <span className="text-[11px] text-white/30 group-hover:text-white/40 leading-tight">{v.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Step 1: Configure ── */}
              {step === 1 && (
                <div className="px-6 py-5 space-y-4">
                  {/* Selected provider chip */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 tracking-wider">
                      {prov.cat === "local" ? <Desktop size={11} className="inline mr-1 -mt-0.5" /> : prov.cat === "cloud" ? <Cloud size={11} className="inline mr-1 -mt-0.5" /> : <Globe size={11} className="inline mr-1 -mt-0.5" />}
                      {prov.label}
                    </span>
                    <span className="text-[11px] text-white/25">{prov.desc}</span>
                  </div>

                  <div>
                    <Label className="text-[12px] font-medium text-white/60">label</Label>
                    <Input
                      placeholder={`e.g. My ${prov.label} setup`}
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5 h-11"
                      autoFocus
                      data-testid="llm-name"
                    />
                  </div>

                  {/* Credentials section */}
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                    <p className="text-[11px] text-white/40 font-medium uppercase tracking-wider">Connection</p>

                    {needsKey && (
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <Key size={13} className="text-white/40" />
                          <Label className="text-[12px] font-medium text-white/60">api key</Label>
                        </div>
                        <Input
                          type="password"
                          value={form.api_key}
                          onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                          placeholder={prov.keyHint || "paste your key..."}
                          className="bg-white/[0.04] border-white/[0.08] rounded-lg font-mono text-sm h-11"
                          data-testid="llm-api-key"
                        />
                      </div>
                    )}

                    {needsUrl && (
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <Globe size={13} className="text-white/40" />
                          <Label className="text-[12px] font-medium text-white/60">base url</Label>
                        </div>
                        <Input
                          placeholder={prov.baseUrl || "https://api.example.com/v1"}
                          value={form.base_url}
                          onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                          className="bg-white/[0.04] border-white/[0.08] rounded-lg font-mono text-sm h-11"
                          data-testid="llm-base-url"
                        />
                      </div>
                    )}

                    {prov.cat === "local" && (
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <Key size={13} className="text-white/40" />
                          <Label className="text-[12px] font-medium text-white/60">api key <span className="text-white/25">(optional)</span></Label>
                        </div>
                        <Input
                          type="password"
                          value={form.api_key}
                          onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                          className="bg-white/[0.04] border-white/[0.08] rounded-lg font-mono text-sm h-11"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Cpu size={13} className="text-white/40" />
                      <Label className="text-[12px] font-medium text-white/60">model</Label>
                    </div>
                    <Input
                      value={form.model}
                      onChange={(e) => setForm({ ...form, model: e.target.value })}
                      placeholder="e.g. gpt-4o-mini, qwen2.5:3b, llama3.1"
                      className="bg-white/[0.04] border-white/[0.08] rounded-lg font-mono text-sm h-11"
                      data-testid="llm-model"
                    />
                  </div>

                  {/* Summary */}
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider mb-3">Summary</p>
                    <div className="space-y-2 text-[13px]">
                      <div className="flex items-center justify-between">
                        <span className="text-white/40">Provider</span>
                        <span className="font-medium text-white/80">{prov.label}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/40">Type</span>
                        <span className="flex items-center gap-1.5 text-white/60">
                          {prov.cat === "local" ? <><Desktop size={12} /> Local</> : prov.cat === "cloud" ? <><Cloud size={12} /> Cloud</> : <><Globe size={12} /> Custom</>}
                        </span>
                      </div>
                      {form.model && (
                        <div className="flex items-center justify-between">
                          <span className="text-white/40">Model</span>
                          <span className="font-mono text-[12px] text-white/60">{form.model}</span>
                        </div>
                      )}
                      {form.base_url && (
                        <div className="flex items-center justify-between">
                          <span className="text-white/40">Endpoint</span>
                          <span className="font-mono text-[11px] text-white/40 truncate max-w-[250px]">{form.base_url}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between pt-2">
                    <Button variant="outline" onClick={() => setStep(0)} className="rounded-xl gap-2">
                      <CaretLeft size={14} /> Back
                    </Button>
                    <Button
                      onClick={save}
                      disabled={saving || !form.name || !form.model}
                      className="rounded-xl gap-2 bg-gradient-to-r from-fuchsia-600 to-violet-500 hover:from-fuchsia-500 hover:to-violet-400 border-0 shadow-lg shadow-fuchsia-500/20"
                      data-testid="save-llm-button"
                    >
                      {saving ? "[ adding... ]" : <><Brain size={14} weight="fill" /> Add provider</>}
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
          icon={Brain}
          title="No model providers configured"
          description="Add a cloud, local, or self-hosted LLM provider to start building agents."
          action={
            <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
              <Plus size={14} /> Add provider
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            <div key={it.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 flex items-center justify-between hover:bg-white/[0.05] hover:border-white/[0.1] transition-all" data-testid={`llm-${it.id}`}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-[12px] bg-gradient-to-br from-fuchsia-500 to-pink-400 flex items-center justify-center shadow-lg shadow-fuchsia-500/20">
                  <Brain size={18} weight="fill" className="text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-[14px] text-white/90">{it.name}</span>
                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-md bg-white/[0.05] text-white/35 tracking-wider border border-white/[0.04]">{it.provider}</span>
                  </div>
                  <div className="text-[12px] text-white/35 mt-1 font-mono">
                    {it.model}{it.base_url ? <span className="text-white/20"> · {it.base_url}</span> : ""}{it.api_key_masked ? <span className="text-white/20"> · {it.api_key_masked}</span> : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-[11px] rounded-xl border-white/[0.08] hover:bg-white/[0.06] text-white/50"
                  disabled={testing === it.id}
                  onClick={() => testLlm(it.id)}
                  data-testid={`test-llm-${it.id}`}
                >
                  <Lightning size={13} weight="fill" className={testing === it.id ? "animate-pulse text-amber-400" : ""} />
                  {testing === it.id ? "Testing..." : "Test"}
                </Button>
                <button className="text-white/20 hover:text-red-400 transition-colors" onClick={() => remove(it.id)} data-testid={`delete-llm-${it.id}`}>
                  <Trash size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
