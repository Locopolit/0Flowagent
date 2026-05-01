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
            <DialogTrigger asChild><Button className="rounded-xl gap-2" data-testid="new-workspace-button"><Plus size={14} /> New workspace</Button></DialogTrigger>
          <DialogContent className="max-w-2xl bg-white/[0.03] border-white/[0.06]">
            <DialogHeader><DialogTitle>Create workspace</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label className="text-[12px] font-medium text-white/60">name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5" data-testid="workspace-name" /></div>
              <div className="col-span-2"><Label className="text-[12px] font-medium text-white/60">description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5" /></div>
              <div className="col-span-2"><Label className="text-[12px] font-medium text-white/60">llm provider</Label>
                <Select value={form.llm_config_id} onValueChange={(v) => setForm({ ...form, llm_config_id: v })}>
                  <SelectTrigger className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5" data-testid="workspace-llm"><SelectValue placeholder="Select LLM..." /></SelectTrigger>
                  <SelectContent>
                    {llms.length === 0 ? <div className="p-3 text-sm text-muted-foreground">No LLMs yet. <Link to="/llm" className="text-primary underline">Add one</Link></div> :
                      llms.map((l) => <SelectItem key={l.id} value={l.id}>{l.name} — {l.provider}/{l.model}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-[12px] font-medium text-white/60">attach assets</Label>
                <div className="mt-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 max-h-44 overflow-y-auto space-y-1">
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
              <div className="col-span-2"><Label className="text-[12px] font-medium text-white/60">system prompt</Label>
                <Textarea rows={4} value={form.system_prompt} onChange={(e) => setForm({ ...form, system_prompt: e.target.value })} className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5 font-mono text-xs" />
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
                    <div className="w-9 h-9 rounded-xl bg-teal-500/15 flex items-center justify-center">
                      <Robot size={17} weight="fill" className="text-teal-400" />
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold text-white/90">{w.name}</div>
                      <div className="text-[11px] text-white/35 mt-0.5">{w.asset_ids?.length || 0} assets attached</div>
                    </div>
                  </div>
                  <button onClick={(e) => { e.preventDefault(); remove(w.id); }} className="text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash size={14} /></button>
                </div>
                {w.description && <div className="text-[12px] text-white/40 mt-3 line-clamp-2 leading-relaxed">{w.description}</div>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
