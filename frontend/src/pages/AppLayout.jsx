import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  HouseSimple, Database, Brain, Robot, SignOut, TreeStructure, ChatsCircle,
} from "@phosphor-icons/react";
import SiriOrb from "@/components/SiriOrb";

const NAV_SECTIONS = [
  {
    label: "General",
    items: [
      { to: "/", label: "Dashboard", icon: HouseSimple, end: true, testid: "nav-dashboard", color: "bg-blue-500" },
    ],
  },
  {
    label: "Configure",
    items: [
      { to: "/assets", label: "Assets", icon: Database, testid: "nav-assets", color: "bg-indigo-500" },
      { to: "/llm", label: "LLM Providers", icon: Brain, testid: "nav-llm", color: "bg-purple-500" },
    ],
  },
  {
    label: "Interact",
    items: [
      { to: "/workspaces", label: "Workspaces", icon: Robot, testid: "nav-workspaces", color: "bg-teal-500" },
    ],
  },
  {
    label: "Automate",
    items: [
      { to: "/flows", label: "Flows", icon: TreeStructure, testid: "nav-flows", color: "bg-orange-500" },
    ],
  },
];

function navClass({ isActive }) {
  return `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
    isActive
      ? "bg-white/[0.08] text-white shadow-sm shadow-black/20"
      : "text-white/60 hover:text-white hover:bg-white/[0.05]"
  }`;
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <div className="h-screen w-screen flex bg-background text-foreground overflow-hidden">
      <aside className="w-[260px] glass border-r border-white/[0.06] flex flex-col shrink-0" data-testid="sidebar">
        {/* Brand */}
        <div className="px-5 py-5 flex items-center gap-3">
          <div className="relative">
            <SiriOrb size={34} active={true} />
          </div>
          <div>
            <div className="text-[15px] font-semibold tracking-tight text-white">AgentForge</div>
            <div className="text-[11px] text-white/40 font-medium">
              AI Orchestrator
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 pb-3 overflow-y-auto">
          {NAV_SECTIONS.map((section, i) => (
            <div key={section.label} className={i > 0 ? "mt-6" : "mt-2"}>
              <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/30">{section.label}</div>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    data-testid={item.testid}
                    className={navClass}
                  >
                    <div className={`ios-icon ${item.color} rounded-lg w-7 h-7 flex items-center justify-center shadow-sm`}>
                      <item.icon size={15} weight="fill" className="text-white" />
                    </div>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.04]">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[11px] font-bold text-white shadow-sm">
              {user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-white/80 truncate" data-testid="user-email">
                {user?.email}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 rounded-lg hover:bg-white/10 text-white/40 hover:text-white"
              onClick={async () => { await logout(); nav("/login"); }}
              data-testid="logout-button"
            >
              <SignOut size={14} />
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto" data-testid="main-content">
        <Outlet />
      </main>
    </div>
  );
}
