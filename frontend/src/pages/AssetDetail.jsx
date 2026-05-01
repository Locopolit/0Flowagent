import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { formatApiError } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, PlayCircle, Trash, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { toast } from "sonner";

const emptyEp = { name: "", description: "", method: "GET", path: "/", query_params: [] };

export default function AssetDetail() {
  const { id } = useParams();
  const [asset, setAsset] = useState(null);
  const [endpoints, setEndpoints] = useState([]);
  const [epOpen, setEpOpen] = useState(false);
  const [epForm, setEpForm] = useState(emptyEp);
  const [testState, setTestState] = useState(null);
  const [running, setRunning] = useState(null); // endpoint-id being tested
  const [runResult, setRunResult] = useState({});

  const load = async () => {
    const [a, e] = await Promise.all([
      api.get(`/assets/${id}`), api.get(`/assets/${id}/endpoints`),
    ]);
    setAsset(a.data); setEndpoints(e.data);
  };
  useEffect(() => { load(); }, [id]);

  const testConn = async () => {
    setTestState({ loading: true });
    try { const { data } = await api.post(`/assets/${id}/test`); setTestState(data); }
    catch (e) { setTestState({ ok: false, detail: formatApiError(e) }); }
  };

  const addEp = async () => {
    try {
      await api.post(`/assets/${id}/endpoints`, epForm);
      setEpOpen(false); setEpForm(emptyEp); load();
      toast.success("Endpoint added");
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const deleteEp = async (epId) => {
    if (!window.confirm("Delete endpoint?")) return;
    await api.delete(`/assets/${id}/endpoints/${epId}`); load();
  };

  const runEp = async (ep) => {
    setRunning(ep.id);
    setRunResult({ ...runResult, [ep.id]: { loading: true } });
    try {
      const { data } = await api.post(`/assets/${id}/endpoints/${ep.id}/test`, { path_params: {}, query_params: {}, body: null });
      setRunResult((r) => ({ ...r, [ep.id]: data }));
    } catch (e) {
      setRunResult((r) => ({ ...r, [ep.id]: { ok: false, body: formatApiError(e) } }));
    } finally { setRunning(null); }
  };

  if (!asset) return <div className="p-8 font-mono text-sm text-white/40">[ loading... ]</div>;

  return (
    <div className="p-8 max-w-[1280px] mx-auto" data-testid="asset-detail">
      <Link to="/assets" className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white mb-6"><ArrowLeft size={14} /> Back</Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[12px] font-medium text-white/60">// {asset.vendor}</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">{asset.name}</h1>
          <p className="mt-2 font-mono text-sm text-white/40">{asset.base_url}</p>
          {asset.description && <p className="mt-2 text-sm text-white/40 max-w-2xl">{asset.description}</p>}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={testConn} data-testid="test-connection">
            <PlayCircle size={14} /> Test connection
          </Button>
        </div>
      </div>

      {testState && (
        <div className={`mb-6 border p-4 text-sm font-mono ${testState.ok ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300" : "border-red-500/30 bg-red-500/5 text-red-300"}`} data-testid="test-result">
          <div className="flex items-center gap-2">
            {testState.loading ? "[ testing... ]" : testState.ok ? <><CheckCircle size={16} /> success</> : <><WarningCircle size={16} /> failed</>}
          </div>
          {!testState.loading && <div className="mt-2 text-xs opacity-80">{testState.detail}</div>}
        </div>
      )}

      <div className="flex items-end justify-between mb-4">
        <div>
          <p className="text-[12px] font-medium text-white/60">// endpoints</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">API Endpoints</h2>
          <p className="text-sm text-white/40">These become callable tools inside agent workspaces.</p>
        </div>
        <Dialog open={epOpen} onOpenChange={setEpOpen}>
          <DialogTrigger asChild><Button className="rounded-xl gap-2" data-testid="add-endpoint-button"><Plus size={14} /> Add endpoint</Button></DialogTrigger>
          <DialogContent className="max-w-xl bg-card border-border">
            <DialogHeader><DialogTitle>Add endpoint</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-[12px] font-medium text-white/60">name</Label><Input value={epForm.name} onChange={(e) => setEpForm({ ...epForm, name: e.target.value })} className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5" data-testid="endpoint-name" /></div>
              <div><Label className="text-[12px] font-medium text-white/60">method</Label>
                <Select value={epForm.method} onValueChange={(v) => setEpForm({ ...epForm, method: v })}>
                  <SelectTrigger className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5" data-testid="endpoint-method"><SelectValue /></SelectTrigger>
                  <SelectContent>{["GET", "POST", "PUT", "PATCH", "DELETE"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label className="text-[12px] font-medium text-white/60">path</Label>
                <Input placeholder="/jobs/{id}" value={epForm.path} onChange={(e) => setEpForm({ ...epForm, path: e.target.value })} className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5 font-mono text-sm" data-testid="endpoint-path" />
                <p className="text-xs text-white/40 mt-1">Use <span className="font-mono">{`{name}`}</span> for path parameters — agents will fill them.</p>
              </div>
              <div className="col-span-2"><Label className="text-[12px] font-medium text-white/60">description</Label><Textarea value={epForm.description} onChange={(e) => setEpForm({ ...epForm, description: e.target.value })} className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5" placeholder="What this endpoint does — helps the LLM decide when to use it." /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEpOpen(false)}>Cancel</Button>
              <Button onClick={addEp} disabled={!epForm.name || !epForm.path} data-testid="save-endpoint-button">Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {endpoints.length === 0 ? (
        <div className="border border-dashed border-border p-12 text-center text-sm text-white/40">No endpoints yet. Add one to expose this asset to agents.</div>
      ) : (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] divide-y divide-border">
          {endpoints.map((ep) => (
            <div key={ep.id} className="p-5" data-testid={`endpoint-${ep.id}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <span className={`method-${ep.method} text-[10px] font-mono px-2 py-1 rounded-sm shrink-0 mt-0.5`}>{ep.method}</span>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{ep.name}</div>
                    <div className="font-mono text-xs text-white/40 truncate">{ep.path}</div>
                    {ep.description && <div className="text-xs text-white/40 mt-1 max-w-2xl">{ep.description}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="rounded-xl gap-2" disabled={running === ep.id} onClick={() => runEp(ep)} data-testid={`run-endpoint-${ep.id}`}>
                    {running === ep.id ? "[ running... ]" : <><PlayCircle size={12} /> Run</>}
                  </Button>
                  <button className="text-white/40 hover:text-red-400" onClick={() => deleteEp(ep.id)} data-testid={`delete-endpoint-${ep.id}`}>
                    <Trash size={14} />
                  </button>
                </div>
              </div>
              {runResult[ep.id] && !runResult[ep.id].loading && (
                <pre className="mt-3 border border-border bg-neutral-950 p-3 text-[11px] font-mono overflow-x-auto max-h-80" data-testid={`result-${ep.id}`}>
                  <span className={runResult[ep.id].ok ? "text-emerald-400" : "text-red-400"}>
                    [{runResult[ep.id].status_code}] {runResult[ep.id].ok ? "ok" : "fail"}
                  </span>{"\n"}
                  {typeof runResult[ep.id].body === "string"
                    ? runResult[ep.id].body
                    : JSON.stringify(runResult[ep.id].body, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
