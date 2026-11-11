import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const Login = () => {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRecovery) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setRecoverySent(true);
      } else if (isSignUp) {
        await signUp(email, password, displayName);
        toast.success("Conta criada com sucesso!");
        navigate("/");
      } else {
        await signIn(email, password);
        navigate("/");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao processar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">Fator R</h1>
          <p className="text-muted-foreground text-sm">
            {isRecovery ? "Recuperar senha" : isSignUp ? "Crie sua conta" : "Acesse sua conta para continuar"}
          </p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-8 shadow-lg">
          {recoverySent ? <p role="status" className="text-sm text-foreground">Se o e-mail estiver cadastrado, você receberá um link para definir uma nova senha. Confira também o spam.</p> : <form onSubmit={handleSubmit} className="space-y-5">
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Nome</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  placeholder="Seu nome"
                />
              </div>
            )}
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-muted-foreground mb-2">E-mail</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                placeholder="seu@email.com"
              />
            </div>
            {!isRecovery && <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                placeholder="••••••••"
              />
            </div>}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "Processando..." : isRecovery ? "Enviar link de recuperação" : isSignUp ? "Criar conta" : "Entrar"}
            </Button>
          </form>}
          {!isSignUp && <Button variant="link" className="w-full mt-3" disabled={loading} onClick={() => { setIsRecovery(!isRecovery); setRecoverySent(false); }}>{isRecovery ? "Voltar ao login" : "Esqueci minha senha"}</Button>}
          {!isRecovery &&
          <p className="text-center text-sm text-muted-foreground mt-4">
            {isSignUp ? "Já tem conta?" : "Não tem conta?"}{" "}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-primary font-medium hover:underline"
            >
              {isSignUp ? "Fazer login" : "Criar conta"}
            </button>
          </p>}
        </div>
      </div>
    </div>
  );
};

export default Login;
