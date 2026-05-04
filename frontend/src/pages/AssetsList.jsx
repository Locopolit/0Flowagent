import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { formatApiError } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Database, Trash, Plugs, Sparkle, ArrowUpRight, Globe, ShieldCheck, CaretRight, CaretLeft, CheckCircle } from "@phosphor-icons/react";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import Loading from "@/components/Loading";

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
  const [step, setStep] = useState(0);

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
      <PageHeader
        label="assets"
        title="Registered vendors"
        description="External APIs that agents can invoke as tools."
        action={
          <>
            <Link to="/assets/templates" data-testid="browse-templates-button">
              <Button variant="outline" className="rounded-xl gap-2">
                <Sparkle size={14} weight="duotone" /> Browse templates
              </Button>
            </Link>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setStep(0); setForm(emptyForm); } }}>
              <DialogTrigger asChild>
                <Button className="rounded-xl gap-2" data-testid="new-asset-button"><Plus size={14} /> Register asset</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl bg-card border-border p-0 overflow-hidden">
                {/* ── Header ── */}
                <div className="relative px-6 pt-6 pb-4">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-indigo-400 to-blue-500" />
                  <DialogHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-400 flex items-center justify-center shadow-lg shadow-violet-500/20">
                        <Database size={18} weight="fill" className="text-white" />
                      </div>
                      <div>
                        <DialogTitle className="text-lg">Register asset</DialogTitle>
                        <p className="text-[13px] text-white/40 mt-0.5">Connect any vendor API — on-prem, cloud, or SaaS</p>
                      </div>
                    </div>
                  </DialogHeader>

                  {/* ── Step indicators ── */}
                  <div className="flex items-center gap-2 mt-5">
                    {[
                      { icon: Globe, label: "Connection" },
                      { icon: ShieldCheck, label: "Authentication" },
                    ].map((s, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && <div className={`flex-1 h-px ${i <= step ? "bg-violet-500/40" : "bg-white/[0.06]"}`} />}
                        <button
                          onClick={() => i < step && setStep(i)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                            i === step
                              ? "bg-violet-500/10 text-violet-400 border border-violet-500/30"
                              : i < step
                              ? "text-violet-400/60 hover:text-violet-400 cursor-pointer"
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

                {/* ── Step 0: Connection ── */}
                {step === 0 && (
                  <div className="px-6 py-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-[12px] font-medium text-white/60">name</Label>
                        <Input
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          placeholder="e.g. Production ServiceNow"
                          className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5 h-11"
                          autoFocus
                          data-testid="asset-name"
                        />
                      </div>
                      <div>
                        <Label className="text-[12px] font-medium text-white/60">vendor</Label>
                        <Select value={form.vendor} onValueChange={(v) => setForm({ ...form, vendor: v })}>
                          <SelectTrigger className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5 h-11" data-testid="asset-vendor"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["Commvault", "Rubrik", "NetApp", "Dell PowerMax", "Pure Storage", "Veeam", "ServiceNow", "HPE", "IBM Storage", "Zerto", "Cohesity", "Veritas", "VMware", "AWS", "Azure", "GCP", "Other"].map(v => (
                              <SelectItem key={v} value={v}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-[12px] font-medium text-white/60">base url</Label>
                      <Input
                        placeholder="https://vendor.example.com/api/v1"
                        value={form.base_url}
                        onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                        className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5 font-mono text-sm h-11"
                        data-testid="asset-base-url"
                      />
                      <p className="text-[11px] text-white/25 mt-1">The root URL for all API endpoints (without trailing slash).</p>
                    </div>
                    <div>
                      <Label className="text-[12px] font-medium text-white/60">description <span className="text-white/25">(optional)</span></Label>
                      <Textarea
                        rows={2}
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        placeholder="What this API provides..."
                        className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5"
                      />
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button onClick={() => setStep(1)} disabled={!form.name || !form.base_url} className="rounded-xl gap-2">
                        Next <CaretRight size={14} />
                      </Button>
                    </div>
                  </div>
                )}

                {/* ── Step 1: Authentication ── */}
                {step === 1 && (
                  <div className="px-6 py-5 space-y-4">
                    <div>
                      <Label className="text-[12px] font-medium text-white/60">auth type</Label>
                      <Select value={form.auth_type} onValueChange={(v) => setForm({ ...form, auth_type: v })}>
                        <SelectTrigger className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5 h-11" data-testid="asset-auth-type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="token">Token-based (login → token)</SelectItem>
                          <SelectItem value="basic">Basic auth (username + password)</SelectItem>
                          <SelectItem value="api_key">API key (header)</SelectItem>
                          <SelectItem value="none">No auth</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {form.auth_type === "token" && (
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4">
                        <p className="text-[11px] text-white/40 font-medium uppercase tracking-wider">Token configuration</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-[12px] font-medium text-white/60">username</Label>
                            <Input value={form.auth_config.username} onChange={(e) => setCfg({ username: e.target.value })} className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5" />
                          </div>
                          <div>
                            <Label className="text-[12px] font-medium text-white/60">password</Label>
                            <Input type="password" value={form.auth_config.password} onChange={(e) => setCfg({ password: e.target.value })} className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5" />
                          </div>
                          <div>
                            <Label className="text-[12px] font-medium text-white/60">login path</Label>
                            <Input value={form.auth_config.login_path} onChange={(e) => setCfg({ login_path: e.target.value })} className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5 font-mono text-sm" />
                          </div>
                          <div>
                            <Label className="text-[12px] font-medium text-white/60">token path <span className="text-white/25">(dot notation)</span></Label>
                            <Input placeholder="e.g. data.access_token" value={form.auth_config.token_path || ""} onChange={(e) => setCfg({ token_path: e.target.value })} className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5 font-mono text-sm" />
                          </div>
                          <div>
                            <Label className="text-[12px] font-medium text-white/60">token header</Label>
                            <Input value={form.auth_config.token_header} onChange={(e) => setCfg({ token_header: e.target.value })} className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5 font-mono text-sm" />
                          </div>
                          <div>
                            <Label className="text-[12px] font-medium text-white/60">token prefix</Label>
                            <Input value={form.auth_config.token_prefix} onChange={(e) => setCfg({ token_prefix: e.target.value })} className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5 font-mono text-sm" />
                          </div>
                        </div>
                      </div>
                    )}

                    {form.auth_type === "basic" && (
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4">
                        <p className="text-[11px] text-white/40 font-medium uppercase tracking-wider">Basic auth credentials</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-[12px] font-medium text-white/60">username</Label>
                            <Input value={form.auth_config.username} onChange={(e) => setCfg({ username: e.target.value })} className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5" />
                          </div>
                          <div>
                            <Label className="text-[12px] font-medium text-white/60">password</Label>
                            <Input type="password" value={form.auth_config.password} onChange={(e) => setCfg({ password: e.target.value })} className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5" />
                          </div>
                        </div>
                      </div>
                    )}

                    {form.auth_type === "api_key" && (
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4">
                        <p className="text-[11px] text-white/40 font-medium uppercase tracking-wider">API key configuration</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-[12px] font-medium text-white/60">header name</Label>
                            <Input value={form.auth_config.header_name} onChange={(e) => setCfg({ header_name: e.target.value })} className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5 font-mono text-sm" />
                          </div>
                          <div>
                            <Label className="text-[12px] font-medium text-white/60">header prefix</Label>
                            <Input value={form.auth_config.header_prefix} onChange={(e) => setCfg({ header_prefix: e.target.value })} className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5 font-mono text-sm" />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-[12px] font-medium text-white/60">api key</Label>
                            <Input type="password" value={form.auth_config.api_key} onChange={(e) => setCfg({ api_key: e.target.value })} className="bg-white/[0.04] border-white/[0.08] rounded-lg mt-1.5 font-mono text-sm" />
                          </div>
                        </div>
                      </div>
                    )}

                    {form.auth_type === "none" && (
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center text-sm text-white/40">
                        No authentication required — requests will be sent without credentials.
                      </div>
                    )}

                    {/* ── Summary ── */}
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider mb-3">Summary</p>
                      <div className="space-y-2 text-[13px]">
                        <div className="flex items-center justify-between">
                          <span className="text-white/40">Asset</span>
                          <span className="font-medium text-white/80">{form.name}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/40">Vendor</span>
                          <span className="font-medium text-white/80">{form.vendor}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/40">Base URL</span>
                          <span className="font-mono text-[12px] text-white/60 truncate max-w-[300px]">{form.base_url}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/40">Auth</span>
                          <span className="font-medium text-white/80">{form.auth_type}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between pt-2">
                      <Button variant="outline" onClick={() => setStep(0)} className="rounded-xl gap-2">
                        <CaretLeft size={14} /> Back
                      </Button>
                      <Button
                        onClick={save}
                        disabled={saving || !form.name || !form.base_url}
                        className="rounded-xl gap-2 bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-500 hover:to-indigo-400 border-0 shadow-lg shadow-violet-500/20"
                        data-testid="save-asset-button"
                      >
                        {saving ? "[ registering... ]" : <><Database size={14} weight="fill" /> Register asset</>}
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {loading ? (
        <Loading label="loading assets" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No assets registered"
          description="Add your first vendor API so agents and flows can call it as a tool."
          action={
            <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
              <Plus size={14} /> Register asset
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((a) => (
            <Link to={`/assets/${a.id}`} key={a.id} data-testid={`asset-card-${a.id}`}>
              <div className="group rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 hover:bg-white/[0.06] hover:border-white/[0.1] transition-all h-full">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[12px] bg-gradient-to-br from-violet-500 to-indigo-400 flex items-center justify-center shadow-lg shadow-violet-500/20">
                      <Database size={18} weight="fill" className="text-white" />
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold text-white/90">{a.name}</div>
                      <div className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mt-0.5">{a.vendor}</div>
                    </div>
                  </div>
                  <button onClick={(e) => { e.preventDefault(); remove(a.id); }} className="text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all" data-testid={`delete-asset-${a.id}`}>
                    <Trash size={14} />
                  </button>
                </div>
                <div className="mt-4 flex items-center gap-2 text-[11px] text-white/30">
                  <Globe size={12} className="text-white/25" />
                  <span className="font-mono truncate">{a.base_url}</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 tracking-wider">
                    <ShieldCheck size={11} weight="fill" /> {a.auth_type}
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
                    <span className="text-[10px] text-emerald-400/60 font-medium">Connected</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
