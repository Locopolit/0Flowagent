import React, { useEffect, useMemo, useState } from "react";
import api, { formatApiError } from "@/api";
import { useParams, useNavigate } from "react-router-dom";
import {
  Trash, Robot, Database, WebhooksLogo, Clock, ArrowDown, GitBranch, Play, X,
  ArrowUp, WarningCircle, CheckCircle, Copy,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const NODE_DEFAULTS = {
  webhook: () => ({
    type: "trigger",
    config: { webhook_id: Math.random().toString(36).slice(2, 10) },
  }),
  cron: () => ({
    type: "trigger",
    config: { cron: "*/5 * * * *" },
  }),
  llm: () => ({
    type: "action",
    config: { llm_id: "", system_prompt: "", prompt: "" },
  }),
  tool: () => ({
    type: "action",
    config: { asset_id: "", endpoint_id: "", path_params: {}, query_params: {}, body: "" },
  }),
  if_else: () => ({
    type: "logic",
    config: { left: "", op: "eq", right: "" },
  }),
};

function newNode(subtype) {
  const base = NODE_DEFAULTS[subtype]?.() ?? { type: "action", config: {} };
  return {
    id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    subtype,
    position: { x: 0, y: 0 },
    ...base,
  };
}

function validateNode(node) {
  const cfg = node.config || {};
  switch (node.subtype) {
    case "cron":
      if (!cfg.cron?.trim()) return "Cron expression required";
      return null;
    case "llm":
      if (!cfg.llm_id) return "Select an LLM provider";
      if (!(cfg.prompt || "").trim()) return "Prompt is empty";
      return null;
    case "tool":
      if (!cfg.asset_id) return "Select an asset";
      if (!cfg.endpoint_id) return "Select an endpoint";
      return null;
    case "if_else":
      if (cfg.op !== "truthy" && cfg.op !== "falsy" && !(cfg.left ?? "").toString().trim()) {
        return "Left operand required";
      }
      return null;
    default:
      return null;
  }
}

export default function FlowEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const isNew = id === "new";

  const [flow, setFlow] = useState({ name: "", description: "", nodes: [], edges: [] });
  const [llms, setLlms] = useState([]);
  const [assets, setAssets] = useState([]);
  const [endpointsByAsset, setEndpointsByAsset] = useState({});
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [runInput, setRunInput] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [r1, r2] = await Promise.all([api.get("/llm-configs"), api.get("/assets")]);
        setLlms(r1.data);
        setAssets(r2.data);
      } catch (e) {
        toast.error(formatApiError(e));
      }
    })();
    if (!isNew) {
      (async () => {
        try {
          const r = await api.get(`/flows/${id}`);
          setFlow({
            name: r.data.name || "",
            description: r.data.description || "",
            nodes: r.data.nodes || [],
            edges: r.data.edges || [],
          });
        } catch (e) {
          toast.error(formatApiError(e));
        }
      })();
    }
  }, [id, isNew]);

  const ensureEndpoints = async (assetId) => {
    if (!assetId || endpointsByAsset[assetId]) return;
    try {
      const { data } = await api.get(`/assets/${assetId}/endpoints`);
      setEndpointsByAsset((prev) => ({ ...prev, [assetId]: data }));
    } catch (e) {
      /* silent — endpoints may simply not exist yet */
    }
  };

  useEffect(() => {
    flow.nodes
      .filter((n) => n.subtype === "tool" && n.config?.asset_id)
      .forEach((n) => ensureEndpoints(n.config.asset_id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.nodes]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveFlow();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow, isNew, saving, id]);

  const saveFlow = async () => {
    if (!flow.name.trim()) {
      toast.error("Flow needs a name");
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const { data } = await api.post("/flows", flow);
        toast.success("Flow created");
        nav(`/flows/${data.id}`, { replace: true });
      } else {
        await api.put(`/flows/${id}`, flow);
        toast.success("Saved");
      }
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const runFlow = async () => {
    if (isNew) {
      toast.error("Save the flow before running");
      return;
    }
    let parsedInput = null;
    if (runInput.trim()) {
      try {
        parsedInput = JSON.parse(runInput);
      } catch {
        toast.error("Test input must be valid JSON");
        return;
      }
    }
    setRunning(true);
    setRunResult(null);
    try {
      const { data } = await api.post(`/flows/${id}/execute`, { input: parsedInput });
      setRunResult(data.result);
      if (data.result?.status === "error") {
        toast.error(`Flow error: ${data.result.error}`);
      } else {
        toast.success("Flow executed");
      }
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setRunning(false);
    }
  };

  const addNode = (subtype) => {
    const node = newNode(subtype);
    const edges = [...flow.edges];
    if (flow.nodes.length > 0) {
      const last = flow.nodes[flow.nodes.length - 1];
      edges.push({
        id: `edge_${Date.now()}`,
        source: last.id,
        target: node.id,
        sourceHandle: last.subtype === "if_else" ? "true" : null,
      });
    }
    setFlow({ ...flow, nodes: [...flow.nodes, node], edges });
  };

  const removeNode = (nodeId) => {
    setFlow({
      ...flow,
      nodes: flow.nodes.filter((n) => n.id !== nodeId),
      edges: flow.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    });
  };

  const moveNode = (nodeId, direction) => {
    const idx = flow.nodes.findIndex((n) => n.id === nodeId);
    const target = idx + direction;
    if (idx < 0 || target < 0 || target >= flow.nodes.length) return;
    const nodes = flow.nodes.slice();
    [nodes[idx], nodes[target]] = [nodes[target], nodes[idx]];
    setFlow({ ...flow, nodes });
  };

  const updateNodeConfig = (nodeId, patch) => {
    setFlow({
      ...flow,
      nodes: flow.nodes.map((n) =>
        n.id === nodeId ? { ...n, config: { ...n.config, ...patch } } : n
      ),
    });
  };

  const backendBase = useMemo(
    () => (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, ""),
    []
  );

  return (
    <div className="p-8 max-w-[900px] mx-auto pb-40" data-testid="flow-editor">
      <div className="flex items-center gap-4 mb-3">
        <Button variant="ghost" size="sm" onClick={() => nav("/flows")}>← Back</Button>
        <div className="flex-1">
          <p className="mono-label">// {isNew ? "new" : "edit"}</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isNew ? "Create Flow" : "Edit Flow"}
          </h1>
        </div>
        {!isNew && (
          <Button variant="outline" size="sm" onClick={runFlow} disabled={running} className="gap-2">
            <Play size={14} weight="fill" /> {running ? "Running…" : "Test run"}
          </Button>
        )}
        <Button size="sm" onClick={saveFlow} disabled={saving}>
          {saving ? "Saving…" : "Save Workflow"}
        </Button>
      </div>
      <div className="mb-8 flex items-center gap-3 font-mono text-[11px] text-muted-foreground tabular-nums flex-wrap">
        <span>{flow.nodes.length} nodes</span>
        <span className="text-border">·</span>
        <span>{flow.edges.length} edges</span>
        <span className="text-border">·</span>
        <span>
          {flow.nodes.filter((n) => n.type === "trigger").length} trigger(s)
        </span>
        {(() => {
          const issues = flow.nodes.filter((n) => validateNode(n)).length;
          return (
            <span
              className={`inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded-sm ${
                issues > 0 ? "node-pill-logic" : "node-pill-trigger"
              }`}
            >
              {issues > 0 ? <WarningCircle size={11} /> : <CheckCircle size={11} />}
              {issues > 0 ? `${issues} issue${issues === 1 ? "" : "s"}` : "ready"}
            </span>
          );
        })()}
        <span className="ml-auto opacity-70">⌘S to save</span>
      </div>

      <div className="space-y-6">
        <div className="grid gap-4 p-6 border border-border bg-card">
          <p className="mono-label">// metadata</p>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase font-mono">Flow Name</label>
              <Input
                value={flow.name}
                onChange={(e) => setFlow({ ...flow, name: e.target.value })}
                placeholder="Backup Failure Notification"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase font-mono">Description</label>
              <Input
                value={flow.description}
                onChange={(e) => setFlow({ ...flow, description: e.target.value })}
                placeholder="Triggered when a backup job fails..."
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="mono-label">// nodes</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => addNode("webhook")}>+ Webhook</Button>
              <Button variant="outline" size="sm" onClick={() => addNode("cron")}>+ Cron</Button>
              <Button variant="outline" size="sm" onClick={() => addNode("llm")}>+ LLM</Button>
              <Button variant="outline" size="sm" onClick={() => addNode("tool")}>+ Asset Tool</Button>
              <Button variant="outline" size="sm" onClick={() => addNode("if_else")}>+ If/Else</Button>
            </div>
          </div>

          {flow.nodes.length === 0 && (
            <div className="py-20 border border-dashed border-border text-center text-sm text-muted-foreground">
              No nodes in this flow. Add a trigger to start.
            </div>
          )}

          <div className="space-y-2">
            {flow.nodes.map((node, idx) => (
              <React.Fragment key={node.id}>
                <NodeCard
                  node={node}
                  llms={llms}
                  assets={assets}
                  endpointsByAsset={endpointsByAsset}
                  backendBase={backendBase}
                  validationError={validateNode(node)}
                  canMoveUp={idx > 0}
                  canMoveDown={idx < flow.nodes.length - 1}
                  onMoveUp={() => moveNode(node.id, -1)}
                  onMoveDown={() => moveNode(node.id, 1)}
                  onRemove={() => removeNode(node.id)}
                  onPatch={(patch) => updateNodeConfig(node.id, patch)}
                />
                {idx < flow.nodes.length - 1 && (
                  <div className="flex justify-center py-1 text-border">
                    <ArrowDown size={18} />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {!isNew && (
          <div className="p-6 border border-border bg-card space-y-3">
            <p className="mono-label">// test run input (optional JSON)</p>
            <Textarea
              rows={3}
              value={runInput}
              onChange={(e) => setRunInput(e.target.value)}
              placeholder='{"status": "failed", "job_id": "1234"}'
              className="font-mono text-[11px]"
            />
            <p className="text-[10px] text-muted-foreground">
              Passed as <span className="font-mono">{"{{input}}"}</span> to the flow. Leave empty for null.
            </p>
          </div>
        )}

        {runResult && (
          <div className="p-6 border border-border bg-card">
            <div className="flex items-center justify-between mb-2">
              <p className="mono-label">// last run result</p>
              <div className="flex items-center gap-3">
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-sm ${
                    runResult.status === "ok" ? "method-POST" : "method-DELETE"
                  }`}
                >
                  {runResult.status}
                </span>
                <button
                  onClick={() => setRunResult(null)}
                  className="text-muted-foreground hover:text-white"
                  aria-label="Dismiss result"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            <pre className="font-mono text-[11px] text-muted-foreground overflow-x-auto max-h-96">
              {JSON.stringify(runResult, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function NodeCard({
  node, llms, assets, endpointsByAsset, backendBase,
  validationError, canMoveUp, canMoveDown, onMoveUp, onMoveDown, onRemove, onPatch,
}) {
  const cfg = node.config || {};
  const webhookUrl = cfg.webhook_id
    ? `${backendBase || window.location.origin}/api/webhooks/${cfg.webhook_id}`
    : null;
  const copyWebhook = async () => {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      toast.success("Webhook URL copied");
    } catch {
      toast.error("Copy failed");
    }
  };
  const Icon = {
    webhook: WebhooksLogo,
    cron: Clock,
    llm: Robot,
    tool: Database,
    if_else: GitBranch,
  }[node.subtype] || Robot;
  const typeClass =
    node.type === "trigger" ? "node-trigger"
    : node.type === "logic" ? "node-logic"
    : "node-action";
  const pillClass =
    node.type === "trigger" ? "node-pill-trigger"
    : node.type === "logic" ? "node-pill-logic"
    : "node-pill-action";

  return (
    <div className={`p-6 border border-border bg-card relative group ${typeClass}`}>
      <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost" size="icon" className="h-7 w-7"
          onClick={onMoveUp} disabled={!canMoveUp} aria-label="Move up"
        >
          <ArrowUp size={12} />
        </Button>
        <Button
          variant="ghost" size="icon" className="h-7 w-7"
          onClick={onMoveDown} disabled={!canMoveDown} aria-label="Move down"
        >
          <ArrowDown size={12} />
        </Button>
        <Button
          variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500"
          onClick={onRemove} aria-label="Remove node"
        >
          <Trash size={12} />
        </Button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 border rounded-sm ${pillClass}`}>
          <Icon size={16} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold uppercase font-mono tracking-wider">
              {node.subtype}
            </span>
            <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-sm ${pillClass}`}>
              {node.type}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground tabular-nums truncate">
            ID: {node.id}
          </div>
        </div>
      </div>

      {validationError && (
        <div className="mb-3 flex items-center gap-2 text-xs text-amber-400 font-mono">
          <WarningCircle size={12} /> {validationError}
        </div>
      )}

      <div className="space-y-3">
        {node.subtype === "webhook" && (
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase font-mono">Webhook endpoint</label>
            <div className="flex items-center gap-2">
              <Input value={webhookUrl || ""} readOnly className="bg-neutral-900 font-mono text-[11px]" />
              <Button
                variant="outline" size="icon" className="h-9 w-9 shrink-0"
                onClick={copyWebhook} aria-label="Copy webhook URL"
              >
                <Copy size={14} />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">POST a JSON body here to trigger the flow.</p>
          </div>
        )}

        {node.subtype === "cron" && (
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase font-mono">Cron expression</label>
            <Input
              value={cfg.cron || ""}
              onChange={(e) => onPatch({ cron: e.target.value })}
              placeholder="*/5 * * * *"
              className="font-mono text-[11px]"
            />
            <p className="text-[10px] text-muted-foreground">
              Standard 5-field crontab (minute hour day month weekday).
            </p>
          </div>
        )}

        {node.subtype === "llm" && (
          <>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase font-mono">LLM Provider</label>
              <select
                className="flex h-9 w-full rounded-sm border border-input bg-background px-3 py-1 text-sm"
                value={cfg.llm_id || ""}
                onChange={(e) => onPatch({ llm_id: e.target.value })}
              >
                <option value="">Select LLM…</option>
                {llms.map((l) => (
                  <option key={l.id} value={l.id}>{l.name} ({l.model})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase font-mono">System prompt (optional)</label>
              <Textarea
                value={cfg.system_prompt || ""}
                onChange={(e) => onPatch({ system_prompt: e.target.value })}
                placeholder="You are a helpful automation assistant."
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase font-mono">Prompt</label>
              <Textarea
                value={cfg.prompt || ""}
                onChange={(e) => onPatch({ prompt: e.target.value })}
                placeholder="Analyze this data: {{input}}"
              />
              <p className="text-[10px] text-muted-foreground">
                Use <span className="font-mono">{"{{input}}"}</span> or{" "}
                <span className="font-mono">{"{{nodes.<id>.body}}"}</span> to reference upstream output.
              </p>
            </div>
          </>
        )}

        {node.subtype === "tool" && (
          <>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase font-mono">Asset</label>
              <select
                className="flex h-9 w-full rounded-sm border border-input bg-background px-3 py-1 text-sm"
                value={cfg.asset_id || ""}
                onChange={(e) => onPatch({ asset_id: e.target.value, endpoint_id: "" })}
              >
                <option value="">Select Asset…</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            {cfg.asset_id && (
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase font-mono">Endpoint</label>
                <select
                  className="flex h-9 w-full rounded-sm border border-input bg-background px-3 py-1 text-sm"
                  value={cfg.endpoint_id || ""}
                  onChange={(e) => onPatch({ endpoint_id: e.target.value })}
                >
                  <option value="">Select Endpoint…</option>
                  {(endpointsByAsset[cfg.asset_id] || []).map((ep) => (
                    <option key={ep.id} value={ep.id}>
                      {ep.method} {ep.path} — {ep.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase font-mono">
                Body (JSON, supports {"{{input}}"})
              </label>
              <Textarea
                value={cfg.body || ""}
                onChange={(e) => onPatch({ body: e.target.value })}
                placeholder='{"message": "{{input.text}}"}'
                className="font-mono text-[11px]"
              />
            </div>
          </>
        )}

        {node.subtype === "if_else" && (
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase font-mono">Left</label>
              <Input
                value={cfg.left || ""}
                onChange={(e) => onPatch({ left: e.target.value })}
                placeholder="{{input.status}}"
                className="font-mono text-[11px]"
              />
            </div>
            <select
              className="h-9 rounded-sm border border-input bg-background px-2 text-sm"
              value={cfg.op || "eq"}
              onChange={(e) => onPatch({ op: e.target.value })}
            >
              <option value="eq">==</option>
              <option value="ne">!=</option>
              <option value="gt">&gt;</option>
              <option value="lt">&lt;</option>
              <option value="contains">contains</option>
              <option value="truthy">truthy</option>
              <option value="falsy">falsy</option>
            </select>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase font-mono">Right</label>
              <Input
                value={cfg.right || ""}
                onChange={(e) => onPatch({ right: e.target.value })}
                placeholder="failed"
                className="font-mono text-[11px]"
                disabled={cfg.op === "truthy" || cfg.op === "falsy"}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
