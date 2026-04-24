import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Brain, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";

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

  return (
    <div className="p-8 max-w-[1280px] mx-auto" data-testid="llm-page">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="mono-label">// llm providers</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Model providers</h1>
          <p className="mt-2 text-sm text-muted-foreground">Bring your own keys. Local models supported via OpenAI-compatible endpoints.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="rounded-sm gap-2" data-testid="add-llm-button"><Plus size={14} /> Add provider</Button></DialogTrigger>
          <DialogContent className="max-w-lg bg-card border-border">
            <DialogHeader><DialogTitle>Add LLM provider</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label className="mono-label">label</Label>
                <Input placeholder="e.g. My OpenAI key" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-neutral-900 mt-1" data-testid="llm-name" />
              </div>
              <div><Label className="mono-label">provider</Label>
                <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v, model: DEFAULT_MODELS[v] || "" })}>
                  <SelectTrigger className="bg-neutral-900 mt-1" data-testid="llm-provider"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(HELP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">{HELP[form.provider]?.help}</p>
              </div>
              {form.provider !== "local" && (
                <div><Label className="mono-label">api key</Label>
                  <Input type="password" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} className="bg-neutral-900 mt-1 font-mono text-sm" data-testid="llm-api-key" />
                </div>
              )}
              {form.provider === "local" && (
                <>
                  <div><Label className="mono-label">base url</Label>
                    <Input placeholder="http://localhost:11434/v1" value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} className="bg-neutral-900 mt-1 font-mono text-sm" data-testid="llm-base-url" />
                  </div>
                  <div><Label className="mono-label">api key (optional)</Label>
                    <Input type="password" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} className="bg-neutral-900 mt-1 font-mono text-sm" />
                  </div>
                </>
              )}
              <div><Label className="mono-label">model</Label>
                <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="bg-neutral-900 mt-1 font-mono text-sm" data-testid="llm-model" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving || !form.name || !form.model} data-testid="save-llm-button">{saving ? "Saving..." : "Add"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <div className="border border-dashed border-border p-16 text-center">
          <Brain size={28} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No LLM providers configured. Add one to start building agents.</p>
        </div>
      ) : (
        <div className="border border-border bg-card divide-y divide-border">
          {items.map((it) => (
            <div key={it.id} className="p-5 flex items-center justify-between" data-testid={`llm-${it.id}`}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 border border-border flex items-center justify-center">
                  <Brain size={16} className="text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{it.name}</span>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 border border-border rounded-sm">{it.provider}</span>
                  </div>
                  <div className="font-mono text-xs text-muted-foreground mt-0.5">
                    model: {it.model}{it.base_url ? ` · ${it.base_url}` : ""}{it.api_key_masked ? ` · key: ${it.api_key_masked}` : ""}
                  </div>
                </div>
              </div>
              <button className="text-muted-foreground hover:text-red-400" onClick={() => remove(it.id)} data-testid={`delete-llm-${it.id}`}>
                <Trash size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
