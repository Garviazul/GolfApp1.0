import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { FfIcon } from "@/components/FfIcon";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "reset">("login");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Credenciales incorrectas");
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error("Error al enviar el email");
    } else {
      toast.success("Revisa tu correo para restablecer la contraseña");
      setMode("login");
    }
  };

  return (
    <div className="flex app-shell flex-col items-center justify-center bg-primary px-6">
      <div className="mb-8 text-center">
        <FfIcon name="flag-alt" className="mb-3 text-5xl text-primary-foreground" />
        <h1 className="text-3xl font-bold tracking-tight text-primary-foreground">Golf Tracker</h1>
        <p className="mt-1 text-sm text-primary-foreground/70">Método DECADE</p>
      </div>

      <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl">
        {mode === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : "Iniciar Sesión"}
            </Button>
            <button
              type="button"
              onClick={() => setMode("reset")}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <p className="text-sm text-muted-foreground">Introduce tu email para restablecer la contraseña.</p>
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : "Enviar enlace"}
            </Button>
            <button
              type="button"
              onClick={() => setMode("login")}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              Volver al login
            </button>
          </form>
        )}
      </div>

      <p className="mt-6 text-xs text-primary-foreground/50">Acceso solo por invitación</p>
    </div>
  );
};

export default Login;
