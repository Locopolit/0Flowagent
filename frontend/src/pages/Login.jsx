import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth";
import { formatApiError } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

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
      <div className="relative hidden lg:block">
        <img
          src="https://images.pexels.com/photos/4508751/pexels-photo-4508751.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
          alt="Data center"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/80" />
        <div className="relative z-10 h-full flex flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border border-white/30 flex items-center justify-center">
              <span className="font-mono text-xs">AF</span>
            </div>
            <span className="font-mono text-xs tracking-[0.2em] uppercase text-white/80">AgentForge</span>
          </div>
          <div>
            <p className="mono-label text-white/60">// orchestration layer</p>
            <h1 className="mt-4 text-4xl lg:text-5xl font-semibold tracking-tight leading-tight max-w-md">
              One command plane for every vendor API.
            </h1>
            <p className="mt-5 text-sm text-white/60 max-w-md leading-relaxed">
              Register Commvault, Rubrik, NetApp, Dell PowerMax and more. Bring your own LLM.
              Let agents execute the right API at the right moment.
            </p>
          </div>
          <div className="font-mono text-[11px] text-white/40">
            v0.1 · built for storage & backup engineers
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-md space-y-6" data-testid="login-form">
          <div>
            <p className="mono-label">// sign in</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Access AgentForge</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Don't have an account?{" "}
              <Link to="/register" className="text-primary hover:underline" data-testid="link-register">Register</Link>
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="email" className="mono-label">email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 bg-neutral-900 border-border" data-testid="login-email-input" />
            </div>
            <div>
              <Label htmlFor="password" className="mono-label">password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-1 bg-neutral-900 border-border" data-testid="login-password-input" />
            </div>
          </div>

          {err && <div className="text-sm text-red-400 font-mono" data-testid="login-error">{err}</div>}

          <Button type="submit" disabled={loading} className="w-full rounded-sm" data-testid="login-submit-button">
            {loading ? "[ authenticating... ]" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
