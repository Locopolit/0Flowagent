import React, { useEffect, useState } from "react";
import api from "@/api";
import { Link } from "react-router-dom";
import {
  Database, Brain, Robot, ChatsCircle, ArrowUpRight, TreeStructure, Play,
  WebhooksLogo, Clock, Plus, Lightning, Shield, Pulse, ChatText,
  Cpu, Sparkle, ArrowRight, CheckCircle, Plugs,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import SiriOrb from "@/components/SiriOrb";

function StatCard({ label, value, icon: Icon, to, testid, gradient, shadow, subtitle }) {
  const content = (
    <div
      className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] transition-all duration-300 p-5 overflow-hidden hover:border-white/[0.1]"
      data-testid={testid}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-[12px] bg-gradient-to-br ${gradient || "from-blue-500 to-cyan-400"} flex items-center justify-center shadow-lg ${shadow || "shadow-blue-500/20"}`}>
          <Icon size={18} weight="fill" className="text-white" />
        </div>
        {to && <ArrowUpRight size={14} className="text-white/20 group-hover:text-white/60 transition-colors" />}
      </div>
      <p className="text-3xl font-bold tracking-tight tabular-nums text-white">{value ?? "—"}</p>
      <p className="text-[12px] font-medium text-white/40 mt-1">{label}</p>
      {subtitle && <p className="text-[11px] text-white/25 mt-0.5">{subtitle}</p>}
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
  const [assets, setAssets] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [flowsLoading, setFlowsLoading] = useState(true);

  useEffect(() => {
    api.get("/stats").then((r) => setStats(r.data)).catch(() => {});
    api.get("/flows").then((r) => setFlows(r.data || [])).catch(() => {}).finally(() => setFlowsLoading(false));
    api.get("/assets").then((r) => setAssets(r.data || [])).catch(() => {});
    api.get("/workspaces").then((r) => setWorkspaces(r.data || [])).catch(() => {});
  }, []);

  const recent = [...flows]
    .sort((a, b) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""))
    .slice(0, 5);

  const vendorCounts = assets.reduce((acc, a) => { acc[a.vendor] = (acc[a.vendor] || 0) + 1; return acc; }, {});

  return (
    <div className="p-8 max-w-[1400px] mx-auto" data-testid="dashboard">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25">Overview</p>
          <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-white">Command Center</h1>
          <p className="mt-2 text-[14px] text-white/45 max-w-xl leading-relaxed">
            Manage vendor APIs, configure AI models, and orchestrate intelligent agents — all from a single control plane.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/15">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[12px] font-semibold text-emerald-400">All Systems Operational</span>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="Connected Assets" value={stats?.assets} icon={Database} to="/assets" testid="stat-assets"
          gradient="from-violet-500 to-indigo-400" shadow="shadow-violet-500/20" subtitle="Vendor integrations" />
        <StatCard label="LLM Providers" value={stats?.llm_configs} icon={Cpu} to="/llm" testid="stat-llm"
          gradient="from-fuchsia-500 to-pink-400" shadow="shadow-fuchsia-500/20" subtitle="Model backends" />
        <StatCard label="Workspaces" value={stats?.workspaces} icon={Sparkle} to="/workspaces" testid="stat-workspaces"
          gradient="from-emerald-500 to-teal-400" shadow="shadow-emerald-500/20" subtitle="Active agents" />
        <StatCard label="Conversations" value={stats?.conversations} icon={ChatsCircle} to="/workspaces" testid="stat-conv"
          gradient="from-amber-500 to-orange-400" shadow="shadow-amber-500/20" subtitle="Chat sessions" />
        <StatCard label="Messages" value={stats?.messages} icon={ChatText}
          gradient="from-blue-500 to-cyan-400" shadow="shadow-blue-500/20" subtitle="Total exchanges" />
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-5 mb-8">
        {/* Recent Flows */}
        <div className="lg:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25">Activity</p>
              <h3 className="mt-1 text-lg font-bold text-white">Recent Flows</h3>
            </div>
            <Link to="/flows">
              <Button variant="outline" size="sm" className="gap-2 rounded-xl border-white/[0.08] hover:bg-white/[0.06] text-white/60 text-[12px]">
                View all <ArrowRight size={12} />
              </Button>
            </Link>
          </div>

          {flowsLoading ? (
            <div className="py-12 text-center text-sm text-white/30">Loading...</div>
          ) : recent.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-amber-500 to-orange-400 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/20">
                <Lightning size={24} className="text-white" weight="fill" />
              </div>
              <p className="text-[14px] font-medium text-white/70 mb-1">No automation flows yet</p>
              <p className="text-[12px] text-white/35 mb-5 max-w-xs mx-auto">Create flows to automate vendor API calls with webhook or cron triggers.</p>
              <Link to="/flows/new">
                <Button size="sm" className="gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 border-0 text-white shadow-md shadow-amber-500/20">
                  <Plus size={14} /> Create Flow
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.05] rounded-xl border border-white/[0.06] overflow-hidden">
              {recent.map((f) => {
                const nodes = f.nodes || [];
                const trig = nodes.find((n) => n.type === "trigger");
                const TrigIcon = trig?.subtype === "cron" ? Clock : trig?.subtype === "webhook" ? WebhooksLogo : Play;
                return (
                  <Link key={f.id} to={`/flows/${f.id}`} className="flex items-center gap-3 p-3.5 hover:bg-white/[0.03] transition-colors" data-testid={`dash-flow-${f.id}`}>
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                      <TrigIcon size={15} className="text-amber-400" weight="fill" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] font-medium text-white/85 truncate block">{f.name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        {trig && <span className="text-[9px] uppercase text-white/30 bg-white/[0.05] px-1.5 py-0.5 rounded-md font-medium">{trig.subtype}</span>}
                        <span className="text-[11px] text-white/25">{nodes.length} nodes · {relativeTime(f.updated_at || f.created_at)}</span>
                      </div>
                    </div>
                    <ArrowRight size={14} className="text-white/15 shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Start */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 flex flex-col">
          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25">Setup Guide</p>
            <h3 className="mt-1 text-lg font-bold text-white">Get Started</h3>
            <p className="text-[12px] text-white/35 mt-1">Four steps to your first AI agent.</p>
          </div>
          <ol className="space-y-3 flex-1">
            {[
              { n: "1", title: "Add LLM Provider", desc: "OpenAI, Anthropic, Gemini, or local Ollama.", to: "/llm", gradient: "from-fuchsia-500 to-pink-400", done: (stats?.llm_configs || 0) > 0 },
              { n: "2", title: "Register Asset", desc: "Connect a vendor like Commvault or Rubrik.", to: "/assets", gradient: "from-violet-500 to-indigo-400", done: (stats?.assets || 0) > 0 },
              { n: "3", title: "Define Endpoints", desc: "Map the API calls agents can execute.", to: "/assets", gradient: "from-blue-500 to-cyan-400", done: (stats?.assets || 0) > 0 },
              { n: "4", title: "Create Workspace", desc: "Pair LLM + Assets and start chatting.", to: "/workspaces", gradient: "from-emerald-500 to-teal-400", done: (stats?.workspaces || 0) > 0 },
            ].map((step) => (
              <li key={step.n}>
                <Link to={step.to} className="flex gap-3 items-start group p-2.5 -mx-2.5 rounded-xl hover:bg-white/[0.03] transition-colors">
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${step.gradient} flex items-center justify-center text-[11px] font-bold text-white shadow-md shrink-0 mt-0.5`}>
                    {step.done ? <CheckCircle size={14} weight="fill" /> : step.n}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-white/80 group-hover:text-white transition-colors">{step.title}</div>
                    <div className="text-[11px] text-white/30 mt-0.5">{step.desc}</div>
                  </div>
                  <ArrowRight size={12} className="text-white/15 group-hover:text-white/40 transition-colors mt-1.5 shrink-0" />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Connected Vendors */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25">Integrations</p>
              <h3 className="mt-1 text-lg font-bold text-white">Connected Vendors</h3>
            </div>
            <Link to="/assets">
              <Button variant="outline" size="sm" className="gap-1.5 rounded-xl border-white/[0.08] text-white/60 text-[12px] hover:bg-white/[0.06]">
                <Plus size={12} /> Add
              </Button>
            </Link>
          </div>
          {assets.length === 0 ? (
            <div className="py-8 text-center">
              <Plugs size={28} className="text-white/20 mx-auto mb-2" />
              <p className="text-[12px] text-white/30">No vendors connected yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {assets.map((a) => (
                <Link key={a.id} to={`/assets/${a.id}`} className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.08] transition-all group">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center">
                    <Database size={14} className="text-violet-400" weight="fill" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-white/80 truncate">{a.name}</div>
                    <div className="text-[10px] text-white/30 uppercase font-medium">{a.vendor}</div>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-emerald-400/60" title="Connected" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Active Workspaces */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25">Agents</p>
              <h3 className="mt-1 text-lg font-bold text-white">Active Workspaces</h3>
            </div>
            <Link to="/workspaces">
              <Button variant="outline" size="sm" className="gap-1.5 rounded-xl border-white/[0.08] text-white/60 text-[12px] hover:bg-white/[0.06]">
                View <ArrowRight size={12} />
              </Button>
            </Link>
          </div>
          {workspaces.length === 0 ? (
            <div className="py-8 text-center">
              <Sparkle size={28} className="text-white/20 mx-auto mb-2" />
              <p className="text-[12px] text-white/30">No workspaces created yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {workspaces.map((w) => (
                <Link key={w.id} to={`/workspaces/${w.id}`} className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.08] transition-all group">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                    <SiriOrb size={16} active={false} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-white/80 truncate">{w.name}</div>
                    <div className="text-[10px] text-white/30">{w.asset_ids?.length || 0} assets · {w.description ? w.description.slice(0, 40) : "Agent workspace"}</div>
                  </div>
                  <ArrowRight size={12} className="text-white/15 group-hover:text-white/40 transition-colors" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Platform Info */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25">Platform</p>
            <h3 className="mt-1 text-lg font-bold text-white">Capabilities</h3>
          </div>
          <div className="space-y-3">
            {[
              { icon: Shield, label: "Root Cause Analysis", desc: "Automated job failure diagnosis with full API trace.", gradient: "from-red-500 to-rose-400" },
              { icon: Lightning, label: "Multi-step Reasoning", desc: "LangGraph ReAct agent chains multiple API calls.", gradient: "from-amber-500 to-orange-400" },
              { icon: Database, label: "Multi-vendor Support", desc: `${Object.keys(vendorCounts).length > 0 ? Object.keys(vendorCounts).join(", ") : "Commvault, Rubrik, NetApp"} and more.`, gradient: "from-violet-500 to-indigo-400" },
              { icon: Brain, label: "Bring Your Own LLM", desc: "OpenAI, Anthropic, Gemini, or local models.", gradient: "from-fuchsia-500 to-pink-400" },
              { icon: TreeStructure, label: "Flow Automation", desc: "Trigger API sequences on schedule or webhook.", gradient: "from-emerald-500 to-teal-400" },
            ].map((cap) => (
              <div key={cap.label} className="flex items-start gap-3">
                <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${cap.gradient} flex items-center justify-center shadow-sm shrink-0 mt-0.5`}>
                  <cap.icon size={13} weight="fill" className="text-white" />
                </div>
                <div>
                  <div className="text-[12px] font-medium text-white/75">{cap.label}</div>
                  <div className="text-[11px] text-white/30 mt-0.5 leading-relaxed">{cap.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
