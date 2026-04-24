import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth";
import { formatApiError } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

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
            <p className="mono-label text-white/60">// get started</p>
            <h1 className="mt-4 text-4xl lg:text-5xl font-semibold tracking-tight leading-tight max-w-md">
              Deploy agents across your stack in minutes.
            </h1>
          </div>
          <div className="font-mono text-[11px] text-white/40">v0.1</div>
        </div>
      </div>

      <div className="flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-md space-y-6" data-testid="register-form">
          <div>
            <p className="mono-label">// create account</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Register</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Already have an account?{" "}
              <Link to="/login" className="text-primary hover:underline" data-testid="link-login">Sign in</Link>
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="mono-label">name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 bg-neutral-900" data-testid="register-name-input" />
            </div>
            <div>
              <Label className="mono-label">email</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 bg-neutral-900" data-testid="register-email-input" />
            </div>
            <div>
              <Label className="mono-label">password</Label>
              <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 bg-neutral-900" data-testid="register-password-input" />
              <p className="text-xs text-muted-foreground mt-1">Minimum 6 characters.</p>
            </div>
          </div>
          {err && <div className="text-sm text-red-400 font-mono" data-testid="register-error">{err}</div>}
          <Button type="submit" disabled={loading} className="w-full rounded-sm" data-testid="register-submit-button">
            {loading ? "[ creating... ]" : "Create account"}
          </Button>
        </form>
      </div>
    </div>
  );
}
