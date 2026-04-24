import React, { useEffect, useMemo, useState } from "react";
import api, { formatApiError } from "@/api";
import { Link } from "react-router-dom";
import {
  TreeStructure, Plus, Play, Trash, WebhooksLogo, Clock, Robot, Database, GitBranch,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import EmptyState from "@/components/EmptyState";
import Loading from "@/components/Loading";
import PageHeader from "@/components/PageHeader";
import { toast } from "sonner";

const TRIGGER_ICONS = { webhook: WebhooksLogo, cron: Clock };
const ACTION_ICONS = { llm: Robot, tool: Database, if_else: GitBranch };

function relativeTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

export default function FlowsList() {
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("updated");

  useEffect(() => {
    fetchFlows();
  }, []);

  const fetchFlows = async () => {
    setLoading(true);
    try {
      const r = await api.get("/flows");
      setFlows(r.data);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  const deleteFlow = async (id) => {
    if (!window.confirm("Delete this flow?")) return;
    try {
      await api.delete(`/flows/${id}`);
      toast.success("Flow deleted");
      fetchFlows();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const executeFlow = async (id) => {
    setRunningId(id);
    try {
      const { data } = await api.post(`/flows/${id}/execute`, { input: null });
      const status = data?.result?.status;
      if (status === "error") {
        toast.error(`Flow error: ${data.result.error}`);
      } else {
        const nodeCount = Object.keys(data?.result?.nodes || {}).length;
        toast.success(`Flow ran — ${nodeCount} node(s) executed`);
      }
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setRunningId(null);
    }
  };

  const visibleFlows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q
      ? flows.filter((f) =>
          (f.name || "").toLowerCase().includes(q) ||
          (f.description || "").toLowerCase().includes(q)
        )
      : flows.slice();
    list.sort((a, b) => {
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      const ka = a.updated_at || a.created_at || "";
      const kb = b.updated_at || b.created_at || "";
      return kb.localeCompare(ka);
    });
    return list;
  }, [flows, query, sortBy]);

  return (
    <div className="p-8 max-w-[1280px] mx-auto">
      <PageHeader
        label="automation"
        title="Flows"
        description="Design event-driven workflows that connect LLMs with your assets."
        action={
          <Link to="/flows/new">
            <Button size="sm" className="gap-2">
              <Plus size={14} /> New Flow
            </Button>
          </Link>
        }
      />

      {!loading && flows.length > 0 && (
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <MagnifyingGlass
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search flows…"
              className="pl-9 bg-neutral-900"
              data-testid="flows-search"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-9 rounded-sm border border-input bg-neutral-900 px-3 text-sm font-mono"
            data-testid="flows-sort"
          >
            <option value="updated">Recent</option>
            <option value="name">Name (A→Z)</option>
          </select>
          <span className="ml-auto font-mono text-[11px] text-muted-foreground tabular-nums">
            {visibleFlows.length} / {flows.length}
          </span>
        </div>
      )}

      {loading ? (
        <Loading label="loading flows" testid="flows-loading" />
      ) : flows.length === 0 ? (
        <EmptyState
          icon={TreeStructure}
          title="No flows yet"
          description="Flows run on webhooks or schedules and chain LLM steps, asset calls, and branching logic together."
          action={
            <Link to="/flows/new">
              <Button size="sm" className="gap-2">
                <Plus size={14} /> Create your first flow
              </Button>
            </Link>
          }
          testid="flows-empty"
        />
      ) : visibleFlows.length === 0 ? (
        <div className="py-12 text-center font-mono text-sm text-muted-foreground">
          No flows match "{query}".
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleFlows.map((flow) => {
            const nodes = flow.nodes || [];
            const triggers = nodes.filter((n) => n.type === "trigger");
            const actions = nodes.filter((n) => n.type === "action");
            const logic = nodes.filter((n) => n.type === "logic");
            const updated = flow.updated_at || flow.created_at;

            return (
              <div
                key={flow.id}
                className="border border-border bg-card p-6 flex flex-col gap-4 group hover:border-neutral-600 transition-colors"
                data-testid={`flow-card-${flow.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-lg truncate">{flow.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {flow.description || "No description"}
                    </p>
                  </div>
                  <div className="p-2 bg-neutral-900 border border-border text-primary rounded-sm shrink-0">
                    <TreeStructure size={18} weight="duotone" />
                  </div>
                </div>

                {triggers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {triggers.map((n) => {
                      const Icon = TRIGGER_ICONS[n.subtype] || Clock;
                      return (
                        <span
                          key={n.id}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 node-pill-trigger text-[10px] uppercase font-mono rounded-full"
                        >
                          <Icon size={10} /> {n.subtype}
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="flex-1 flex items-center gap-3 text-[11px] font-mono text-muted-foreground tabular-nums">
                  <span>{nodes.length} nodes</span>
                  <span className="text-border">·</span>
                  <span className="inline-flex items-center gap-1">
                    {actions.map((n) => {
                      const Icon = ACTION_ICONS[n.subtype];
                      return Icon ? <Icon key={n.id} size={11} /> : null;
                    })}
                    {logic.map((n) => (
                      <GitBranch key={n.id} size={11} />
                    ))}
                  </span>
                  {updated && (
                    <span className="ml-auto">updated {relativeTime(updated)}</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2 rounded-sm"
                    disabled={runningId === flow.id}
                    onClick={() => executeFlow(flow.id)}
                  >
                    <Play size={14} weight="fill" />{" "}
                    {runningId === flow.id ? "Running…" : "Run"}
                  </Button>
                  <Link to={`/flows/${flow.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full rounded-sm">
                      Edit
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-red-500"
                    onClick={() => deleteFlow(flow.id)}
                  >
                    <Trash size={14} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
