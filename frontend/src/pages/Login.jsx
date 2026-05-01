import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth";
import { formatApiError } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
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
    <div className="min-h-screen grid lg:grid-cols-2 bg-background text-foreground">
      <div className="relative hidden lg:block bg-gradient-to-br from-neutral-950 via-neutral-900 to-blue-950 overflow-hidden">
        <ParticleNetwork className="absolute inset-0 z-0" />
        <div className="absolute inset-0 z-[1] bg-gradient-to-t from-neutral-950/80 via-transparent to-neutral-950/40" />
        <div className="relative z-10 h-full flex flex-col justify-between p-12">
          <div className="flex items-center gap-2.5">
            <SiriOrb size={28} active={true} />
            <span className="text-[14px] font-semibold text-white tracking-tight">AgentForge</span>
          </div>
          <div>
            <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight leading-tight max-w-sm text-white">
              One platform for every vendor API.
            </h1>
            <p className="mt-4 text-[14px] text-white/50 max-w-sm leading-relaxed">
              Connect your backup and storage infrastructure to AI agents that understand your APIs.
            </p>
            <div className="mt-8 space-y-4">
              {[
                ["Multi-vendor", "Commvault, Rubrik, NetApp, Dell PowerMax and more in one place."],
                ["Bring your own LLM", "OpenAI, Anthropic, Gemini, or run local with Ollama."],
                ["Root Cause Analysis", "Automated job failure analysis across your entire backup estate."],
              ].map(([title, desc]) => (
                <div key={title} className="flex gap-3">
                  <div className="w-1 rounded-full bg-blue-400/40 shrink-0 mt-1" style={{height: 32}} />
                  <div>
                    <div className="text-[13px] font-medium text-white/90">{title}</div>
                    <div className="text-[12px] text-white/40 mt-0.5">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-[11px] text-white/25">v0.1 · Built for IT operations teams</div>
        </div>
      </div>

      <div className="flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm space-y-6" data-testid="login-form">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
            <p className="text-sm text-white/50 mt-1">
              Don't have an account?{" "}
              <Link to="/register" className="text-blue-400 hover:text-blue-300" data-testid="link-register">Create one</Link>
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-[12px] font-medium text-white/60 mb-1.5 block">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="bg-white/[0.04] border-white/[0.08] rounded-lg focus:border-blue-400/50 placeholder:text-white/25" data-testid="login-email-input" />
            </div>
            <div>
              <Label htmlFor="password" className="text-[12px] font-medium text-white/60 mb-1.5 block">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-white/[0.04] border-white/[0.08] rounded-lg focus:border-blue-400/50 placeholder:text-white/25" data-testid="login-password-input" />
            </div>
          </div>

          {err && <div className="text-sm text-red-400" data-testid="login-error">{err}</div>}

          <Button type="submit" disabled={loading} className="w-full rounded-lg bg-blue-500 hover:bg-blue-600 font-medium" data-testid="login-submit-button">
            {loading ? "Signing in..." : "Sign in"}
          </Button>

          <div className="pt-4 border-t border-white/[0.06]">
            <p className="text-[11px] text-white/30 text-center">Supports Commvault, Rubrik, NetApp, Dell &amp; more</p>
          </div>
        </form>
      </div>
    </div>
  );
}
