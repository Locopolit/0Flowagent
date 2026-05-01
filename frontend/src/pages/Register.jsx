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
              Deploy agents across your stack in minutes.
            </h1>
            <p className="mt-4 text-[14px] text-white/50 max-w-sm leading-relaxed">
              Set up once — your agents will handle the rest.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-4">
              {[
                ["12+", "API endpoints"],
                ["24h", "Job monitoring"],
                ["4", "LLM providers"],
                ["∞", "Conversations"],
              ].map(([num, label]) => (
                <div key={label} className="border border-white/[0.06] rounded-xl p-3 bg-white/[0.02]">
                  <div className="text-xl font-semibold text-white">{num}</div>
                  <div className="text-[11px] text-white/40 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-[11px] text-white/25">Free to self-host · No usage limits</div>
        </div>
      </div>

      <div className="flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm space-y-6" data-testid="register-form">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Create account</h2>
            <p className="text-sm text-white/50 mt-1">
              Already have an account?{" "}
              <Link to="/login" className="text-blue-400 hover:text-blue-300" data-testid="link-login">Sign in</Link>
            </p>
          </div>
          <div className="space-y-4">
            <div>
              <Label className="text-[12px] font-medium text-white/60 mb-1.5 block">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="bg-white/[0.04] border-white/[0.08] rounded-lg focus:border-blue-400/50 placeholder:text-white/25" data-testid="register-name-input" />
            </div>
            <div>
              <Label className="text-[12px] font-medium text-white/60 mb-1.5 block">Email</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="bg-white/[0.04] border-white/[0.08] rounded-lg focus:border-blue-400/50 placeholder:text-white/25" data-testid="register-email-input" />
            </div>
            <div>
              <Label className="text-[12px] font-medium text-white/60 mb-1.5 block">Password</Label>
              <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" className="bg-white/[0.04] border-white/[0.08] rounded-lg focus:border-blue-400/50 placeholder:text-white/25" data-testid="register-password-input" />
            </div>
          </div>
          {err && <div className="text-sm text-red-400" data-testid="register-error">{err}</div>}
          <Button type="submit" disabled={loading} className="w-full rounded-lg bg-blue-500 hover:bg-blue-600 font-medium" data-testid="register-submit-button">
            {loading ? "Creating..." : "Create account"}
          </Button>
        </form>
      </div>
    </div>
  );
}
