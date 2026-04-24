import React, { useEffect, useState } from "react";
import api from "@/api";
import { Link } from "react-router-dom";
import { Database, Brain, Robot, ChatsCircle, ArrowUpRight } from "@phosphor-icons/react";

function StatCard({ label, value, icon: Icon, to, testid }) {
  const content = (
    <div className="group border border-border bg-card hover:border-neutral-600 transition-colors p-6 flex items-start justify-between" data-testid={testid}>
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

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  return (
    <div className="p-8 max-w-[1280px] mx-auto" data-testid="dashboard">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="mono-label">// overview</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Command center</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl">
            Register external vendor APIs as <span className="text-white">Assets</span>, bring your own LLM,
            and compose agent <span className="text-white">Workspaces</span> that call the right API at the right moment.
          </p>
        </div>
        <div className="font-mono text-[11px] text-muted-foreground">
          status: <span className="text-emerald-400">● operational</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        <StatCard label="Assets" value={stats?.assets} icon={Database} to="/assets" testid="stat-assets" />
        <StatCard label="LLM Providers" value={stats?.llm_configs} icon={Brain} to="/llm" testid="stat-llm" />
        <StatCard label="Workspaces" value={stats?.workspaces} icon={Robot} to="/workspaces" testid="stat-workspaces" />
        <StatCard label="Conversations" value={stats?.conversations} icon={ChatsCircle} testid="stat-conv" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="border border-border bg-card p-6">
          <p className="mono-label">// quick start</p>
          <h3 className="mt-1 text-xl font-medium">Set up your first agent</h3>
          <ol className="mt-5 space-y-3 text-sm">
            {[
              ["1", "Add an LLM Provider", "Add your OpenAI/Anthropic/Gemini key or point to a local LLM.", "/llm"],
              ["2", "Register an Asset", "Configure the vendor (Commvault, Rubrik, NetApp, etc.) and its auth.", "/assets"],
              ["3", "Define Endpoints", "Describe the API calls agents are allowed to make.", "/assets"],
              ["4", "Create a Workspace", "Pick the LLM, attach Assets, and start chatting.", "/workspaces"],
            ].map(([n, title, desc, to]) => (
              <li key={n} className="flex gap-4">
                <div className="font-mono text-xs text-primary mt-0.5 w-5">{n}</div>
                <div>
                  <Link to={to} className="text-white hover:underline">{title}</Link>
                  <p className="text-muted-foreground">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="border border-border bg-card p-6 relative overflow-hidden">
          <p className="mono-label">// architecture</p>
          <h3 className="mt-1 text-xl font-medium">How it works</h3>
          <div className="mt-5 font-mono text-xs leading-relaxed text-muted-foreground whitespace-pre">
{`user → workspace ──▶ LLM (BYOK)
                    │
                    ├─▶ tool: asset.endpoint
                    │    └─ execute via token / basic auth
                    │
                    └─▶ RAG: in-memory TF-IDF
                         └─ pdf · docx · md · txt`}
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            Every tool call is captured as a trace you can inspect inside the workspace chat.
          </div>
        </div>
      </div>
    </div>
  );
}
