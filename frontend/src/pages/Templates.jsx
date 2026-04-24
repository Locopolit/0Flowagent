import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { formatApiError } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Sparkle, Lightning, CaretRight } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function Templates() {
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // template being configured
  const [form, setForm] = useState({ name: "", base_url: "", username: "", password: "", api_key: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/asset-templates").then((r) => setItems(r.data)).finally(() => setLoading(false));
  }, []);

  const openConfigure = (tpl) => {
    setSelected(tpl);
    setForm({
      name: tpl.name,
      base_url: tpl.base_url_example || "",
      username: "",
      password: "",
      api_key: "",
    });
  };

  const instantiate = async () => {
    setSaving(true);
    const auth_config = {};
    if (selected.auth_type === "token" || selected.auth_type === "basic") {
      auth_config.username = form.username;
      auth_config.password = form.password;
    } else if (selected.auth_type === "api_key") {
      auth_config.api_key = form.api_key;
    }
    try {
      const { data } = await api.post(`/asset-templates/${selected.id}/instantiate`, {
        name: form.name,
        base_url: form.base_url,
        auth_config,
      });
      toast.success(`Created ${data.asset.name} with ${data.endpoints_created} endpoints`);
      nav(`/assets/${data.asset.id}`);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-[1280px] mx-auto" data-testid="templates-page">
      <button
        onClick={() => nav("/assets")}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white mb-6"
        data-testid="back-to-assets"
      >
        <ArrowLeft size={14} /> Back to Assets
      </button>

      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="mono-label">// marketplace</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight flex items-center gap-3">
            Template gallery
            <Sparkle size={22} weight="duotone" className="text-primary" />
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl">
            One-click presets for major vendors. We wire up auth and common endpoints — you just supply
            the base URL and credentials.
          </p>
        </div>
        <div className="font-mono text-[11px] text-muted-foreground">
          {items.length} templates · {items.reduce((s, t) => s + t.endpoint_count, 0)} endpoints
        </div>
      </div>

      {loading ? (
        <div className="font-mono text-sm text-muted-foreground">[ loading templates... ]</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((t) => (
            <button
              key={t.id}
              onClick={() => openConfigure(t)}
              className="group text-left border border-border bg-card hover:border-neutral-500 transition-colors p-6 relative overflow-hidden"
              data-testid={`template-${t.id}`}
            >
              <div
                className="absolute top-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: t.color }}
              />
              <div className="flex items-start justify-between">
                <div>
                  <div
                    className="w-9 h-9 border border-border flex items-center justify-center font-mono text-xs font-semibold"
                    style={{ color: t.color }}
                  >
                    {t.vendor.slice(0, 2).toUpperCase()}
                  </div>
                </div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 border border-border rounded-sm">
                  {t.auth_type}
                </span>
              </div>

              <div className="mt-4">
                <div className="mono-label">// {t.vendor}</div>
                <div className="text-lg font-medium mt-0.5">{t.name}</div>
                <div className="text-xs text-muted-foreground mt-1">{t.tagline}</div>
              </div>

              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground">
                  <Lightning size={11} className="inline mr-1" />
                  {t.endpoint_count} endpoints
                </span>
                <CaretRight size={14} className="text-muted-foreground group-hover:text-white transition-colors" />
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-2xl bg-card border-border">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Deploy{" "}
                  <span style={{ color: selected.color }}>{selected.vendor}</span>{" "}
                  template
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  {selected.description}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label className="mono-label">asset name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="bg-neutral-900 mt-1"
                    data-testid="tpl-name"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="mono-label">base url</Label>
                  <Input
                    value={form.base_url}
                    placeholder={selected.base_url_example}
                    onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                    className="bg-neutral-900 mt-1 font-mono text-sm"
                    data-testid="tpl-base-url"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Example: {selected.base_url_example}</p>
                </div>

                {(selected.auth_type === "token" || selected.auth_type === "basic") && (
                  <>
                    <div>
                      <Label className="mono-label">username</Label>
                      <Input
                        value={form.username}
                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                        className="bg-neutral-900 mt-1"
                        data-testid="tpl-username"
                      />
                    </div>
                    <div>
                      <Label className="mono-label">password</Label>
                      <Input
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        className="bg-neutral-900 mt-1"
                        data-testid="tpl-password"
                      />
                    </div>
                  </>
                )}
                {selected.auth_type === "api_key" && (
                  <div className="col-span-2">
                    <Label className="mono-label">api key</Label>
                    <Input
                      type="password"
                      value={form.api_key}
                      onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                      className="bg-neutral-900 mt-1 font-mono text-sm"
                      data-testid="tpl-api-key"
                    />
                  </div>
                )}

                <div className="col-span-2 mt-2">
                  <div className="mono-label mb-2">// endpoints that will be created</div>
                  <ScrollArea className="h-40 border border-border bg-neutral-950 rounded-sm">
                    <div className="divide-y divide-border">
                      {selected.endpoints.map((ep) => (
                        <div key={ep.name} className="p-2.5 flex items-start gap-3">
                          <span
                            className={`method-${ep.method} text-[9px] font-mono px-1.5 py-0.5 rounded-sm shrink-0 mt-0.5`}
                          >
                            {ep.method}
                          </span>
                          <div className="min-w-0">
                            <div className="font-mono text-xs text-white truncate">{ep.path}</div>
                            <div className="text-[11px] text-muted-foreground truncate">{ep.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
                <p className="col-span-2 text-xs text-muted-foreground">{selected.auth_hint}</p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={instantiate}
                  disabled={saving || !form.base_url || !form.name}
                  data-testid="tpl-deploy-button"
                >
                  {saving ? "[ deploying... ]" : `Deploy ${selected.endpoints.length} endpoints`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
