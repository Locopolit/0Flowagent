import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Brain, Trash, Lightning } from "@phosphor-icons/react";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

const emptyForm = { name: "", provider: "openai", api_key: "", base_url: "", model: "gpt-4o-mini" };

const DEFAULT_MODELS = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-5-20250929",
  gemini: "gemini-2.5-flash",
  local: "llama3.1",
};

const HELP = {
  openai: { label: "OpenAI", help: "Get your key at platform.openai.com/api-keys" },
  anthropic: { label: "Anthropic", help: "Get your key at console.anthropic.com" },
  gemini: { label: "Google Gemini", help: "Get your key at aistudio.google.com/apikey" },
  local: { label: "Local / OpenAI-compatible", help: "Point to Ollama, LM Studio, vLLM, etc. e.g. http://host.docker.internal:11434/v1" },
};

export default function LLMConfigs() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null);

  const load = async () => { const { data } = await api.get("/llm-configs"); setItems(data); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/llm-configs", form);
      toast.success("Provider added");
      setOpen(false); setForm(emptyForm); load();
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
      toast.success(`SLM responded: "${data.reply}"`, { duration: 5000 });
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="p-8 max-w-[1280px] mx-auto" data-testid="llm-page">
      <PageHeader
        label="llm providers"
        title="Model providers"
        description="Bring your own keys. Local models supported via OpenAI-compatible endpoints."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="rounded-xl gap-2" data-testid="add-llm-button"><Plus size={14} /> Add provider</Button></DialogTrigger>
          <DialogContent className="max-w-lg bg-white/[0.03] border-white/[0.06]">
            <DialogHeader><DialogTitle>Add LLM provider</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label className="text-[12px] font-medium text-white/60">label</Label>
                <Input placeholder="e.g. My OpenAI key" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5" data-testid="llm-name" />
              </div>
              <div><Label className="text-[12px] font-medium text-white/60">provider</Label>
                <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v, model: DEFAULT_MODELS[v] || "" })}>
                  <SelectTrigger className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5" data-testid="llm-provider"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(HELP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">{HELP[form.provider]?.help}</p>
              </div>
              {form.provider !== "local" && (
                <div><Label className="text-[12px] font-medium text-white/60">api key</Label>
                  <Input type="password" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5 font-mono text-sm" data-testid="llm-api-key" />
                </div>
              )}
              {form.provider === "local" && (
                <>
                  <div><Label className="text-[12px] font-medium text-white/60">base url</Label>
                    <Input placeholder="http://localhost:11434/v1" value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5 font-mono text-sm" data-testid="llm-base-url" />
                  </div>
                  <div><Label className="text-[12px] font-medium text-white/60">api key (optional)</Label>
                    <Input type="password" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5 font-mono text-sm" />
                  </div>
                </>
              )}
              <div><Label className="text-[12px] font-medium text-white/60">model</Label>
                <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5 font-mono text-sm" data-testid="llm-model" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving || !form.name || !form.model} data-testid="save-llm-button">{saving ? "Saving..." : "Add"}</Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Brain}
          title="No model providers configured"
          description="Add an OpenAI, Anthropic, Gemini, or local (Ollama / LM Studio) provider to start building agents."
          action={
            <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
              <Plus size={14} /> Add provider
            </Button>
          }
        />
      ) : (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] divide-y divide-white/[0.06] overflow-hidden">
          {items.map((it) => (
            <div key={it.id} className="p-5 flex items-center justify-between" data-testid={`llm-${it.id}`}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center">
                  <Brain size={18} weight="fill" className="text-purple-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[14px] text-white/90">{it.name}</span>
                    <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded-md bg-white/[0.06] text-white/40">{it.provider}</span>
                  </div>
                  <div className="text-[12px] text-white/40 mt-0.5">
                    model: {it.model}{it.base_url ? ` · ${it.base_url}` : ""}{it.api_key_masked ? ` · key: ${it.api_key_masked}` : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs rounded-lg border-white/[0.08] hover:bg-white/[0.06]"
                  disabled={testing === it.id}
                  onClick={() => testLlm(it.id)}
                  data-testid={`test-llm-${it.id}`}
                >
                  <Lightning size={14} className={testing === it.id ? "animate-pulse" : ""} />
                  {testing === it.id ? "Testing..." : "Test"}
                </Button>
                <button className="text-white/25 hover:text-red-400 transition-colors" onClick={() => remove(it.id)} data-testid={`delete-llm-${it.id}`}>
                  <Trash size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
