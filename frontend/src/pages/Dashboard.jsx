import React, { useEffect, useState } from "react";
import api from "@/api";
import { Link } from "react-router-dom";
import {
  Database, Brain, Robot, ChatsCircle, ArrowUpRight, TreeStructure, Play,
  WebhooksLogo, Clock, Plus, Lightning, Shield, Pulse,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";

function StatCard({ label, value, icon: Icon, to, testid, iconColor, iconBg }) {
  const content = (
    <div
      className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm hover:bg-white/[0.06] transition-all duration-300 p-6 flex items-start justify-between overflow-hidden hover:shadow-xl hover:shadow-black/30 hover:-translate-y-1 hover:border-white/[0.1]"
      data-testid={testid}
    >
      <div className="relative">
        <p className="text-[12px] font-medium uppercase tracking-wider text-white/40">{label}</p>
        <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums text-white">{value ?? "—"}</p>
      </div>
      <div className="relative flex flex-col items-end gap-3">
        <div className={`w-10 h-10 rounded-xl ${iconBg || "bg-blue-500/15"} flex items-center justify-center shadow-sm`}>
          <Icon size={20} weight="fill" className={iconColor || "text-blue-400"} />
        </div>
        {to && <ArrowUpRight size={14} className="text-white/30 group-hover:text-white transition-colors" />}
      </div>
    </div>
  );
  return to ? <Link to={to} className="block">{content}</Link> : content;
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
        title="Command Center"
        description={
          <>
            Register external vendor APIs as <span className="text-white font-medium">Assets</span>, bring your own LLM,
            and compose agent <span className="text-white font-medium">Workspaces</span> that call the right API at the right moment.
          </>
        }
        action={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[12px] font-medium text-emerald-400">Operational</span>
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        <StatCard label="Assets" value={stats?.assets} icon={Database} to="/assets" testid="stat-assets" iconColor="text-blue-400" iconBg="bg-blue-500/15" />
        <StatCard label="LLM Providers" value={stats?.llm_configs} icon={Brain} to="/llm" testid="stat-llm" iconColor="text-purple-400" iconBg="bg-purple-500/15" />
        <StatCard label="Workspaces" value={stats?.workspaces} icon={Robot} to="/workspaces" testid="stat-workspaces" iconColor="text-teal-400" iconBg="bg-teal-500/15" />
        <StatCard label="Conversations" value={stats?.conversations} icon={ChatsCircle} to="/workspaces" testid="stat-conv" iconColor="text-orange-400" iconBg="bg-orange-500/15" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Recent flows — span two columns */}
        <div className="lg:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Activity</p>
              <h3 className="mt-1 text-xl font-semibold text-white">Recent Flows</h3>
            </div>
            <Link to="/flows">
              <Button variant="outline" size="sm" className="gap-2 rounded-xl border-white/10 hover:bg-white/[0.06] text-white/70">
                <TreeStructure size={14} /> View all
              </Button>
            </Link>
          </div>

          {flowsLoading ? (
            <div className="py-10 text-center text-sm text-white/40">
              Loading...
            </div>
          ) : recent.length === 0 ? (
            <div className="py-10 text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-orange-500/15 flex items-center justify-center mb-3">
                <TreeStructure size={22} className="text-orange-400" weight="fill" />
              </div>
              <p className="text-sm text-white/50 mb-4">
                No flows yet. Automate vendor API calls with triggers.
              </p>
              <Link to="/flows/new">
                <Button size="sm" className="gap-2 rounded-xl">
                  <Plus size={14} /> New flow
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06] overflow-hidden">
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
                    className="flex items-center gap-3 p-3.5 hover:bg-white/[0.04] transition-colors"
                    data-testid={`dash-flow-${f.id}`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
                      <TrigIcon size={14} className="text-orange-400" weight="fill" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium truncate text-white/90">{f.name}</span>
                        {trig && (
                          <span className="text-[9px] font-mono uppercase text-white/30 bg-white/[0.06] px-1.5 py-0.5 rounded-md">
                            {trig.subtype}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-white/35 mt-0.5">
                        {nodes.length} nodes · updated {relativeTime(f.updated_at || f.created_at)}
                      </div>
                    </div>
                    <ArrowUpRight size={14} className="text-white/20 shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick start */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Setup</p>
          <h3 className="mt-1 text-xl font-semibold text-white">Get Started</h3>
          <ol className="mt-5 space-y-4 text-sm">
            {[
              ["1", "LLM Provider", "Add a key or point to a local LLM.", "/llm", "bg-purple-500"],
              ["2", "Asset", "Configure the vendor and its auth.", "/assets", "bg-indigo-500"],
              ["3", "Endpoints", "Describe the API calls agents can make.", "/assets", "bg-blue-500"],
              ["4", "Workspace", "Pick the LLM, attach Assets, chat.", "/workspaces", "bg-teal-500"],
            ].map(([n, title, desc, to, color]) => (
              <li key={n} className="flex gap-3 items-start">
                <div className={`w-6 h-6 rounded-lg ${color} flex items-center justify-center text-[11px] font-bold text-white shadow-sm shrink-0 mt-0.5`}>{n}</div>
                <div>
                  <Link to={to} className="text-white/90 font-medium hover:text-white transition-colors">{title}</Link>
                  <p className="text-white/40 text-xs mt-0.5">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
