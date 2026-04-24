import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { formatApiError } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Database, Trash, Plugs } from "@phosphor-icons/react";
import { toast } from "sonner";

const emptyForm = {
  name: "",
  vendor: "Commvault",
  description: "",
  base_url: "",
  auth_type: "token",
  auth_config: {
    username: "", password: "",
    login_path: "/login", username_field: "username", password_field: "password",
    token_path: "", token_header: "Authorization", token_prefix: "Bearer ",
    header_name: "Authorization", header_prefix: "Bearer ", api_key: "",
  },
};

export default function AssetsList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get("/assets"); setItems(data); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/assets", form);
      toast.success("Asset registered");
      setOpen(false); setForm(emptyForm); load();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this asset and its endpoints?")) return;
    try { await api.delete(`/assets/${id}`); toast.success("Deleted"); load(); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  const setCfg = (patch) => setForm((f) => ({ ...f, auth_config: { ...f.auth_config, ...patch } }));

  return (
    <div className="p-8 max-w-[1280px] mx-auto" data-testid="assets-page">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="mono-label">// assets</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Registered vendors</h1>
          <p className="mt-2 text-sm text-muted-foreground">External APIs that agents can invoke as tools.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-sm gap-2" data-testid="new-asset-button"><Plus size={14} /> Register asset</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl bg-card border-border">
            <DialogHeader><DialogTitle>Register an asset</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mono-label">name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-neutral-900 mt-1" data-testid="asset-name" />
              </div>
              <div>
                <Label className="mono-label">vendor</Label>
                <Select value={form.vendor} onValueChange={(v) => setForm({ ...form, vendor: v })}>
                  <SelectTrigger className="bg-neutral-900 mt-1" data-testid="asset-vendor"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Commvault", "Rubrik", "NetApp", "Dell PowerMax", "Pure Storage", "Veeam", "HPE", "IBM Storage", "Other"].map(v => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="mono-label">base url</Label>
                <Input placeholder="https://vendor.example.com/api/v1" value={form.base_url}
                  onChange={(e) => setForm({ ...form, base_url: e.target.value })} className="bg-neutral-900 mt-1 font-mono text-sm" data-testid="asset-base-url" />
              </div>
              <div className="col-span-2">
                <Label className="mono-label">description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-neutral-900 mt-1" />
              </div>
              <div className="col-span-2">
                <Label className="mono-label">auth type</Label>
                <Select value={form.auth_type} onValueChange={(v) => setForm({ ...form, auth_type: v })}>
                  <SelectTrigger className="bg-neutral-900 mt-1" data-testid="asset-auth-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="token">Token-based (login → token)</SelectItem>
                    <SelectItem value="basic">Basic auth</SelectItem>
                    <SelectItem value="api_key">API key (header)</SelectItem>
                    <SelectItem value="none">No auth</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.auth_type === "token" && (
                <>
                  <div><Label className="mono-label">login path</Label>
                    <Input value={form.auth_config.login_path} onChange={(e) => setCfg({ login_path: e.target.value })} className="bg-neutral-900 mt-1 font-mono text-sm" /></div>
                  <div><Label className="mono-label">token path (dot)</Label>
                    <Input placeholder="e.g. data.access_token" value={form.auth_config.token_path || ""} onChange={(e) => setCfg({ token_path: e.target.value })} className="bg-neutral-900 mt-1 font-mono text-sm" /></div>
                  <div><Label className="mono-label">username</Label>
                    <Input value={form.auth_config.username} onChange={(e) => setCfg({ username: e.target.value })} className="bg-neutral-900 mt-1" /></div>
                  <div><Label className="mono-label">password</Label>
                    <Input type="password" value={form.auth_config.password} onChange={(e) => setCfg({ password: e.target.value })} className="bg-neutral-900 mt-1" /></div>
                  <div><Label className="mono-label">token header</Label>
                    <Input value={form.auth_config.token_header} onChange={(e) => setCfg({ token_header: e.target.value })} className="bg-neutral-900 mt-1 font-mono text-sm" /></div>
                  <div><Label className="mono-label">token prefix</Label>
                    <Input value={form.auth_config.token_prefix} onChange={(e) => setCfg({ token_prefix: e.target.value })} className="bg-neutral-900 mt-1 font-mono text-sm" /></div>
                </>
              )}
              {form.auth_type === "basic" && (
                <>
                  <div><Label className="mono-label">username</Label>
                    <Input value={form.auth_config.username} onChange={(e) => setCfg({ username: e.target.value })} className="bg-neutral-900 mt-1" /></div>
                  <div><Label className="mono-label">password</Label>
                    <Input type="password" value={form.auth_config.password} onChange={(e) => setCfg({ password: e.target.value })} className="bg-neutral-900 mt-1" /></div>
                </>
              )}
              {form.auth_type === "api_key" && (
                <>
                  <div><Label className="mono-label">header name</Label>
                    <Input value={form.auth_config.header_name} onChange={(e) => setCfg({ header_name: e.target.value })} className="bg-neutral-900 mt-1 font-mono text-sm" /></div>
                  <div><Label className="mono-label">header prefix</Label>
                    <Input value={form.auth_config.header_prefix} onChange={(e) => setCfg({ header_prefix: e.target.value })} className="bg-neutral-900 mt-1 font-mono text-sm" /></div>
                  <div className="col-span-2"><Label className="mono-label">api key</Label>
                    <Input type="password" value={form.auth_config.api_key} onChange={(e) => setCfg({ api_key: e.target.value })} className="bg-neutral-900 mt-1 font-mono text-sm" /></div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving || !form.name || !form.base_url} data-testid="save-asset-button">
                {saving ? "Saving..." : "Register asset"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="font-mono text-sm text-muted-foreground">[ loading assets... ]</div>
      ) : items.length === 0 ? (
        <div className="border border-dashed border-border p-16 text-center">
          <Database size={28} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No assets registered yet. Add your first vendor above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((a) => (
            <Link to={`/assets/${a.id}`} key={a.id} data-testid={`asset-card-${a.id}`}>
              <div className="border border-border bg-card p-5 hover:border-neutral-600 transition-colors h-full">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs font-mono text-muted-foreground uppercase">{a.vendor}</div>
                    <div className="text-lg font-medium mt-0.5">{a.name}</div>
                  </div>
                  <button onClick={(e) => { e.preventDefault(); remove(a.id); }} className="text-muted-foreground hover:text-red-400" data-testid={`delete-asset-${a.id}`}>
                    <Trash size={16} />
                  </button>
                </div>
                <div className="mt-3 font-mono text-xs text-muted-foreground truncate">{a.base_url}</div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 border border-border rounded-sm uppercase">
                    <Plugs size={10} /> {a.auth_type}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
