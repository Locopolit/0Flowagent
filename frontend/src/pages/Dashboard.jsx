import React, { useEffect, useState } from "react";
import api from "@/api";
import { Link } from "react-router-dom";
import {
  Database, Brain, Robot, ChatsCircle, ArrowUpRight, TreeStructure, Play,
  WebhooksLogo, Clock, Plus,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";

function StatCard({ label, value, icon: Icon, to, testid }) {
  const content = (
    <div
      className="group border border-border bg-card hover:border-neutral-600 transition-colors p-6 flex items-start justify-between"
      data-testid={testid}
    >
      <div>
        <p className="mono-label">{label}</p>
        <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums">{value ?? "—"}</p>
      </div>
      <div className="flex flex-col items-end gap-3">
        <Icon size={20} weight="duotone" className="text-muted-foreground group-hover:text-primary transition-colors" />
        <ArrowUpRight size={14} className="text-muted-foreground group-hover:text-white transition-colors" />
      </div>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

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

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [flows, setFlows] = useState([]);
  const [flowsLoading, setFlowsLoading] = useState(true);

  useEffect(() => {
    api.get("/stats").then((r) => setStats(r.data)).catch(() => {});
    api
      .get("/flows")
      .then((r) => setFlows(r.data || []))
      .catch(() => {})
      .finally(() => setFlowsLoading(false));
  }, []);

  const recent = [...flows]
    .sort((a, b) =>
      (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || "")
    )
    .slice(0, 5);

  return (
    <div className="p-8 max-w-[1280px] mx-auto" data-testid="dashboard">
      <PageHeader
        label="overview"
        title="Command center"
        description={
          <>
            Register external vendor APIs as <span className="text-white">Assets</span>, bring your own LLM,
            and compose agent <span className="text-white">Workspaces</span> that call the right API at the right moment.
          </>
        }
        action={
          <div className="font-mono text-[11px] text-muted-foreground">
            status: <span className="text-emerald-400">● operational</span>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard label="Assets" value={stats?.assets} icon={Database} to="/assets" testid="stat-assets" />
        <StatCard label="LLM Providers" value={stats?.llm_configs} icon={Brain} to="/llm" testid="stat-llm" />
        <StatCard label="Workspaces" value={stats?.workspaces} icon={Robot} to="/workspaces" testid="stat-workspaces" />
        <StatCard label="Conversations" value={stats?.conversations} icon={ChatsCircle} testid="stat-conv" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Recent flows — span two columns */}
        <div className="lg:col-span-2 border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="mono-label">// recent flows</p>
              <h3 className="mt-1 text-xl font-medium">Automation activity</h3>
            </div>
            <Link to="/flows">
              <Button variant="outline" size="sm" className="gap-2 rounded-sm">
                <TreeStructure size={14} /> View all
              </Button>
            </Link>
          </div>

          {flowsLoading ? (
            <div className="py-10 text-center font-mono text-xs text-muted-foreground">
              [ loading ]
            </div>
          ) : recent.length === 0 ? (
            <div className="py-10 text-center">
              <TreeStructure size={28} className="mx-auto text-muted-foreground mb-2" weight="duotone" />
              <p className="text-sm text-muted-foreground mb-4">
                No flows yet. Automate vendor API calls on webhook or schedule triggers.
              </p>
              <Link to="/flows/new">
                <Button size="sm" className="gap-2">
                  <Plus size={14} /> New flow
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border border border-border">
              {recent.map((f) => {
                const nodes = f.nodes || [];
                const trig = nodes.find((n) => n.type === "trigger");
                const TrigIcon =
                  trig?.subtype === "cron" ? Clock
                  : trig?.subtype === "webhook" ? WebhooksLogo
                  : Play;
                return (
                  <Link
                    key={f.id}
                    to={`/flows/${f.id}`}
                    className="flex items-center gap-3 p-3 hover:bg-neutral-900/50 transition-colors"
                    data-testid={`dash-flow-${f.id}`}
                  >
                    <div className="p-1.5 border border-border node-pill-trigger rounded-sm">
                      <TrigIcon size={12} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{f.name}</span>
                        {trig && (
                          <span className="text-[9px] font-mono uppercase text-muted-foreground">
                            {trig.subtype}
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground tabular-nums">
                        {nodes.length} nodes · updated {relativeTime(f.updated_at || f.created_at)}
                      </div>
                    </div>
                    <ArrowUpRight size={14} className="text-muted-foreground shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick start */}
        <div className="border border-border bg-card p-6">
          <p className="mono-label">// quick start</p>
          <h3 className="mt-1 text-xl font-medium">Set up your first agent</h3>
          <ol className="mt-5 space-y-3 text-sm">
            {[
              ["1", "LLM Provider", "Add a key or point to a local LLM.", "/llm"],
              ["2", "Asset", "Configure the vendor and its auth.", "/assets"],
              ["3", "Endpoints", "Describe the API calls agents can make.", "/assets"],
              ["4", "Workspace", "Pick the LLM, attach Assets, chat.", "/workspaces"],
            ].map(([n, title, desc, to]) => (
              <li key={n} className="flex gap-3">
                <div className="font-mono text-xs text-primary mt-0.5 w-4 tabular-nums">{n}</div>
                <div>
                  <Link to={to} className="text-white hover:underline">{title}</Link>
                  <p className="text-muted-foreground text-xs">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
