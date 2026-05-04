import React from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  HouseSimple, Database, Brain, Robot, SignOut, TreeStructure,
  Gauge, Cpu, Lightning, Sparkle, Bell, MagnifyingGlass,
  CaretRight,
} from "@phosphor-icons/react";
import SiriOrb from "@/components/SiriOrb";

const NAV_SECTIONS = [
  {
    label: "General",
    items: [
      {
        to: "/", label: "Dashboard", icon: Gauge, end: true, testid: "nav-dashboard",
        gradient: "from-blue-500 to-cyan-400", shadow: "shadow-blue-500/25",
      },
    ],
  },
  {
    label: "Configure",
    items: [
      {
        to: "/assets", label: "Assets", icon: Database, testid: "nav-assets",
        gradient: "from-violet-500 to-indigo-400", shadow: "shadow-violet-500/25",
      },
      {
        to: "/llm", label: "LLM Providers", icon: Cpu, testid: "nav-llm",
        gradient: "from-fuchsia-500 to-pink-400", shadow: "shadow-fuchsia-500/25",
      },
    ],
  },
  {
    label: "Interact",
    items: [
      {
        to: "/workspaces", label: "Workspaces", icon: Sparkle, testid: "nav-workspaces",
        gradient: "from-emerald-500 to-teal-400", shadow: "shadow-emerald-500/25",
      },
    ],
  },
  {
    label: "Automate",
    items: [
      {
        to: "/flows", label: "Flows", icon: Lightning, testid: "nav-flows",
        gradient: "from-amber-500 to-orange-400", shadow: "shadow-amber-500/25",
      },
    ],
  },
];

function navClass({ isActive }) {
  return `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
    isActive
      ? "bg-white/[0.08] text-white"
      : "text-white/55 hover:text-white hover:bg-white/[0.05]"
  }`;
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const location = useLocation();

  const crumbs = (() => {
    const segs = location.pathname.split("/").filter(Boolean);
    if (segs.length === 0) return [{ label: "Dashboard" }];
    const labels = { assets: "Assets", llm: "LLM Providers", workspaces: "Workspaces", flows: "Flows" };
    return segs.map((s, i) => ({
      label: labels[s] || (s === "new" ? "New" : s === "templates" ? "Templates" : s.length > 20 ? "Detail" : s.charAt(0).toUpperCase() + s.slice(1)),
      to: i < segs.length - 1 ? "/" + segs.slice(0, i + 1).join("/") : undefined,
    }));
  })();

  return (
    <div className="h-screen w-screen flex bg-background text-foreground overflow-hidden">
      <aside className="w-[260px] glass border-r border-white/[0.06] flex flex-col shrink-0" data-testid="sidebar">
        {/* Brand */}
        <div className="px-5 py-5 flex items-center gap-3 border-b border-white/[0.04]">
          <div className="relative">
            <SiriOrb size={34} active={true} />
          </div>
          <div>
            <div className="text-[15px] font-bold tracking-tight text-white">AgentForge</div>
            <div className="text-[10px] text-white/30 font-semibold uppercase tracking-widest">
              AI Orchestrator
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 pb-3 overflow-y-auto">
          {NAV_SECTIONS.map((section, i) => (
            <div key={section.label} className={i > 0 ? "mt-6" : "mt-4"}>
              <div className="px-3 pb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-white/20">{section.label}</div>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    data-testid={item.testid}
                    className={navClass}
                  >
                    {({ isActive }) => (
                      <>
                        <div className={`w-8 h-8 rounded-[10px] bg-gradient-to-br ${item.gradient} flex items-center justify-center shadow-md ${item.shadow} transition-transform duration-200 ${isActive ? "scale-105" : "group-hover:scale-105"}`}>
                          <item.icon size={16} weight="fill" className="text-white drop-shadow-sm" />
                        </div>
                        <span className="text-[13px]">{item.label}</span>
                        {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60" />}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[11px] font-bold text-white shadow-md shadow-blue-500/20 ring-2 ring-white/10">
              {user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-white/70 truncate" data-testid="user-email">
                {user?.email}
              </div>
              <div className="text-[10px] text-white/25">Administrator</div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 rounded-lg hover:bg-white/10 text-white/25 hover:text-red-400 transition-colors"
              onClick={async () => { await logout(); nav("/login"); }}
              data-testid="logout-button"
            >
              <SignOut size={14} />
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden" data-testid="main-content">
        {/* Top bar */}
        <div className="h-14 shrink-0 border-b border-white/[0.04] flex items-center justify-between px-8 bg-white/[0.01]">
          <div className="flex items-center gap-1.5 text-[12px]">
            <span className="text-white/25">AgentForge</span>
            {crumbs.map((c, i) => (
              <React.Fragment key={i}>
                <CaretRight size={10} className="text-white/15" />
                {c.to ? (
                  <button onClick={() => nav(c.to)} className="text-white/40 hover:text-white/70 transition-colors">{c.label}</button>
                ) : (
                  <span className="text-white/70 font-medium">{c.label}</span>
                )}
              </React.Fragment>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/8 border border-emerald-500/10">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] font-semibold text-emerald-400/80">Online</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
