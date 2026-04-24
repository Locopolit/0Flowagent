import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  HouseSimple, Database, Brain, Robot, SignOut,
} from "@phosphor-icons/react";

const NAV = [
  { to: "/", label: "Dashboard", icon: HouseSimple, end: true, testid: "nav-dashboard" },
  { to: "/assets", label: "Assets", icon: Database, testid: "nav-assets" },
  { to: "/llm", label: "LLM Providers", icon: Brain, testid: "nav-llm" },
  { to: "/workspaces", label: "Workspaces", icon: Robot, testid: "nav-workspaces" },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <div className="h-screen w-screen flex bg-background text-foreground overflow-hidden">
      <aside className="w-[248px] border-r border-border flex flex-col shrink-0" data-testid="sidebar">
        <div className="px-5 py-5 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 border border-border flex items-center justify-center">
            <span className="font-mono text-[11px] font-semibold">AF</span>
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">AgentForge</div>
            <div className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">orchestrator</div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          <div className="mono-label px-2 py-2">// navigate</div>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              data-testid={item.testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-sm text-sm transition-colors ${
                  isActive
                    ? "bg-neutral-900 text-white border border-border"
                    : "text-muted-foreground hover:text-white hover:bg-neutral-900/60"
                }`
              }
            >
              <item.icon size={16} weight="duotone" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-border space-y-2">
          <div className="px-2 py-1.5">
            <div className="mono-label">// signed in as</div>
            <div className="text-sm truncate mt-0.5" data-testid="user-email">{user?.email}</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full rounded-sm justify-start gap-2"
            onClick={async () => { await logout(); nav("/login"); }}
            data-testid="logout-button"
          >
            <SignOut size={14} /> Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-grid" data-testid="main-content">
        <Outlet />
      </main>
    </div>
  );
}
