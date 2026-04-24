import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { formatApiError } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Robot, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

const emptyForm = {
  name: "",
  description: "",
  llm_config_id: "",
  asset_ids: [],
  system_prompt: "You are AgentForge — an expert IT operations assistant. You have access to external vendor APIs as tools. Decide carefully which tool to call, extract parameters from the user's message, and report results in clear prose.",
};

export default function WorkspacesList() {
  const [items, setItems] = useState([]);
  const [llms, setLlms] = useState([]);
  const [assets, setAssets] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);

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
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="rounded-sm gap-2" data-testid="new-workspace-button"><Plus size={14} /> New workspace</Button></DialogTrigger>
          <DialogContent className="max-w-2xl bg-card border-border">
            <DialogHeader><DialogTitle>Create workspace</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label className="mono-label">name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-neutral-900 mt-1" data-testid="workspace-name" /></div>
              <div className="col-span-2"><Label className="mono-label">description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-neutral-900 mt-1" /></div>
              <div className="col-span-2"><Label className="mono-label">llm provider</Label>
                <Select value={form.llm_config_id} onValueChange={(v) => setForm({ ...form, llm_config_id: v })}>
                  <SelectTrigger className="bg-neutral-900 mt-1" data-testid="workspace-llm"><SelectValue placeholder="Select LLM..." /></SelectTrigger>
                  <SelectContent>
                    {llms.length === 0 ? <div className="p-3 text-sm text-muted-foreground">No LLMs yet. <Link to="/llm" className="text-primary underline">Add one</Link></div> :
                      llms.map((l) => <SelectItem key={l.id} value={l.id}>{l.name} — {l.provider}/{l.model}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="mono-label">attach assets</Label>
                <div className="mt-2 border border-border bg-neutral-950 p-3 max-h-44 overflow-y-auto space-y-1">
                  {assets.length === 0 ? <div className="text-sm text-muted-foreground p-1">No assets yet. <Link to="/assets" className="text-primary underline">Add one</Link></div> :
                    assets.map((a) => (
                      <label key={a.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-neutral-900 px-2 py-1.5">
                        <input type="checkbox" checked={form.asset_ids.includes(a.id)} onChange={() => toggleAsset(a.id)} data-testid={`toggle-asset-${a.id}`} />
                        <span className="font-mono text-[10px] uppercase text-muted-foreground">{a.vendor}</span>
                        <span>{a.name}</span>
                      </label>
                    ))}
                </div>
              </div>
              <div className="col-span-2"><Label className="mono-label">system prompt</Label>
                <Textarea rows={4} value={form.system_prompt} onChange={(e) => setForm({ ...form, system_prompt: e.target.value })} className="bg-neutral-900 mt-1 font-mono text-xs" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={!form.name || !form.llm_config_id} data-testid="save-workspace-button">Create</Button>
            </DialogFooter>
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
            <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
              <Plus size={14} /> New workspace
            </Button>
          }
        />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((w) => (
            <Link key={w.id} to={`/workspaces/${w.id}`} data-testid={`workspace-card-${w.id}`}>
              <div className="border border-border bg-card p-5 hover:border-neutral-600 transition-colors h-full">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="mono-label">// agent</div>
                    <div className="text-lg font-medium mt-0.5">{w.name}</div>
                  </div>
                  <button onClick={(e) => { e.preventDefault(); remove(w.id); }} className="text-muted-foreground hover:text-red-400"><Trash size={14} /></button>
                </div>
                {w.description && <div className="text-sm text-muted-foreground mt-2 line-clamp-2">{w.description}</div>}
                <div className="mt-4 flex gap-2 flex-wrap">
                  <span className="text-[10px] font-mono px-2 py-0.5 border border-border rounded-sm">{w.asset_ids?.length || 0} assets</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
