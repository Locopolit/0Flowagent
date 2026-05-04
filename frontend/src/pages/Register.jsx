import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth";
import { formatApiError } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Shield, CheckCircle, Lightning, Database, Brain } from "@phosphor-icons/react";
import ParticleNetwork from "@/components/ParticleNetwork";
import SiriOrb from "@/components/SiriOrb";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await register(email, password, name);
      toast.success("Account created");
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
      <div className="relative hidden lg:flex flex-col bg-gradient-to-br from-neutral-950 via-neutral-900 to-indigo-950 overflow-hidden">
        <ParticleNetwork className="absolute inset-0 z-0" />
        <div className="absolute inset-0 z-[1] bg-gradient-to-t from-neutral-950/90 via-transparent to-neutral-950/50" />
        <div className="absolute inset-0 z-[1] dot-grid" />
        <div className="relative z-10 flex-1 flex flex-col justify-between p-10 lg:p-14">
          <div className="flex items-center gap-2.5">
            <SiriOrb size={28} active={true} />
            <span className="text-[15px] font-bold text-white tracking-tight">AgentForge</span>
          </div>

          <div className="max-w-lg">
            <h1 className="text-4xl lg:text-[42px] font-bold tracking-tight leading-[1.15] text-white">
              Build your first AI agent in under 5 minutes.
            </h1>
            <p className="mt-5 text-[15px] text-white/45 leading-relaxed max-w-md">
              No complex setup. Connect a vendor, pick a model, and start chatting with your infrastructure.
            </p>

            <div className="mt-10 space-y-4">
              {[
                { icon: Database, label: "Multi-vendor integration", desc: "Connect Commvault, Rubrik, NetApp, Dell and more.", gradient: "from-violet-500 to-indigo-400" },
                { icon: Brain, label: "Flexible LLM support", desc: "Use cloud APIs or run fully local with Ollama.", gradient: "from-fuchsia-500 to-pink-400" },
                { icon: Lightning, label: "Automated root cause analysis", desc: "AI traces failures across API chains in seconds.", gradient: "from-amber-500 to-orange-400" },
              ].map((feat) => (
                <div key={feat.label} className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-[10px] bg-gradient-to-br ${feat.gradient} flex items-center justify-center shadow-md shrink-0 mt-0.5`}>
                    <feat.icon size={15} weight="fill" className="text-white" />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-white/85">{feat.label}</div>
                    <div className="text-[12px] text-white/35 mt-0.5">{feat.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-6 text-[11px] text-white/20">
            <span className="flex items-center gap-1.5"><CheckCircle size={12} weight="fill" className="text-emerald-400/50" /> Free to self-host</span>
            <span className="flex items-center gap-1.5"><CheckCircle size={12} weight="fill" className="text-emerald-400/50" /> No usage limits</span>
            <span className="flex items-center gap-1.5"><CheckCircle size={12} weight="fill" className="text-emerald-400/50" /> Open source</span>
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

          <form onSubmit={submit} className="space-y-6" data-testid="register-form">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Create your account</h2>
              <p className="text-[13px] text-white/40 mt-1.5">
                Get started with AgentForge in seconds.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-[12px] font-medium text-white/50 mb-1.5 block">Full name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe"
                  className="h-11 bg-white/[0.04] border-white/[0.08] rounded-xl focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/20 placeholder:text-white/20 text-[14px]" data-testid="register-name-input" />
              </div>
              <div>
                <Label className="text-[12px] font-medium text-white/50 mb-1.5 block">Work email</Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"
                  className="h-11 bg-white/[0.04] border-white/[0.08] rounded-xl focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/20 placeholder:text-white/20 text-[14px]" data-testid="register-email-input" />
              </div>
              <div>
                <Label className="text-[12px] font-medium text-white/50 mb-1.5 block">Password</Label>
                <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters"
                  className="h-11 bg-white/[0.04] border-white/[0.08] rounded-xl focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/20 placeholder:text-white/20 text-[14px]" data-testid="register-password-input" />
              </div>
            </div>

            {err && <div className="text-sm text-red-400" data-testid="register-error">{err}</div>}

            <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 font-semibold text-[14px] shadow-lg shadow-blue-500/20 border-0" data-testid="register-submit-button">
              {loading ? "Creating account..." : "Create account"}
            </Button>

            <p className="text-[13px] text-center text-white/40">
              Already have an account?{" "}
              <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium" data-testid="link-login">Sign in</Link>
            </p>
          </form>

          <div className="mt-10 pt-6 border-t border-white/[0.06]">
            <div className="flex items-center gap-3 text-[11px] text-white/25">
              <Shield size={14} className="text-white/20" />
              <span>Your data never leaves your infrastructure</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
