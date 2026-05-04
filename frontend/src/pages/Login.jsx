import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth";
import { formatApiError } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Shield } from "@phosphor-icons/react";
import ParticleNetwork from "@/components/ParticleNetwork";
import SiriOrb from "@/components/SiriOrb";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Signed in");
      nav("/");
    } catch (e) {
      const m = formatApiError(e);
      setErr(m);
      toast.error(m);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_480px] bg-background text-foreground">
      {/* Left — Hero */}
      <div className="relative hidden lg:flex flex-col bg-gradient-to-br from-neutral-950 via-neutral-900 to-blue-950 overflow-hidden">
        <ParticleNetwork className="absolute inset-0 z-0" />
        <div className="absolute inset-0 z-[1] bg-gradient-to-t from-neutral-950/90 via-transparent to-neutral-950/50" />
        <div className="absolute inset-0 z-[1] dot-grid" />
        <div className="relative z-10 flex-1 flex flex-col justify-between p-10 lg:p-14">
          <div className="flex items-center gap-2.5">
            <SiriOrb size={28} active={true} />
            <span className="text-[15px] font-bold text-white tracking-tight">AgentForge</span>
          </div>

          <div className="max-w-lg">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">AI-Powered Operations</span>
            </div>
            <h1 className="text-4xl lg:text-[42px] font-bold tracking-tight leading-[1.15] text-white">
              Intelligent automation for your infrastructure.
            </h1>
            <p className="mt-5 text-[15px] text-white/45 leading-relaxed max-w-md">
              Connect vendor APIs, deploy AI agents, and let them handle root cause analysis, monitoring, and orchestration.
            </p>

            <div className="mt-10 grid grid-cols-3 gap-6">
              {[
                { num: "12+", label: "API Endpoints", sub: "Per vendor" },
                { num: "24h", label: "Job Monitoring", sub: "Automated" },
                { num: "<30s", label: "RCA Results", sub: "End to end" },
              ].map((s) => (
                <div key={s.label}>
                  <div className="text-2xl font-bold text-white">{s.num}</div>
                  <div className="text-[12px] text-white/50 font-medium mt-1">{s.label}</div>
                  <div className="text-[10px] text-white/25 mt-0.5">{s.sub}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {["Commvault", "Rubrik", "NetApp", "Dell"].map((v) => (
                <span key={v} className="text-[10px] font-medium text-white/20 uppercase tracking-wider border border-white/[0.06] rounded-full px-3 py-1">{v}</span>
              ))}
            </div>
            <div className="text-[11px] text-white/20">v0.1</div>
          </div>
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex flex-col justify-center p-8 lg:p-12 border-l border-white/[0.06] bg-[hsl(225,15%,5%)]">
        <div className="w-full max-w-sm mx-auto">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <SiriOrb size={24} active={true} />
            <span className="text-[14px] font-bold text-white">AgentForge</span>
          </div>

          <form onSubmit={submit} className="space-y-6" data-testid="login-form">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Welcome back</h2>
              <p className="text-[13px] text-white/40 mt-1.5">
                Sign in to your account to continue.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-[12px] font-medium text-white/50 mb-1.5 block">Email address</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="h-11 bg-white/[0.04] border-white/[0.08] rounded-xl focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/20 placeholder:text-white/20 text-[14px]" data-testid="login-email-input" />
              </div>
              <div>
                <Label htmlFor="password" className="text-[12px] font-medium text-white/50 mb-1.5 block">Password</Label>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 bg-white/[0.04] border-white/[0.08] rounded-xl focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/20 placeholder:text-white/20 text-[14px]" data-testid="login-password-input" />
              </div>
            </div>

            {err && <div className="text-sm text-red-400" data-testid="login-error">{err}</div>}

            <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 font-semibold text-[14px] shadow-lg shadow-blue-500/20 border-0" data-testid="login-submit-button">
              {loading ? "Signing in..." : "Sign in"}
            </Button>

            <p className="text-[13px] text-center text-white/40">
              Don't have an account?{" "}
              <Link to="/register" className="text-blue-400 hover:text-blue-300 font-medium" data-testid="link-register">Create one</Link>
            </p>
          </form>

          <div className="mt-10 pt-6 border-t border-white/[0.06]">
            <div className="flex items-center gap-3 text-[11px] text-white/25">
              <Shield size={14} className="text-white/20" />
              <span>Self-hosted · Your data stays on your servers</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
