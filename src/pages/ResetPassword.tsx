import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export default function ResetPassword() {
  const recoveryLink = useRef(new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery");
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (active && event === "PASSWORD_RECOVERY") {
        setReady(true);
        setChecking(false);
      }
    });
    supabase.auth.getUser().then(({ data, error: authError }) => {
      if (!active) return;
      if (recoveryLink.current && data.user && !authError) setReady(true);
      setChecking(false);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready || pending) return;
    if (password !== confirmation) { setError("As senhas não coincidem."); return; }
    setPending(true);
    setError("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSaved(true);
      await supabase.auth.signOut();
    } catch {
      setError("Não foi possível salvar a senha. Solicite um novo link e tente novamente.");
    } finally { setPending(false); }
  };

  return <main className="min-h-screen bg-background flex items-center justify-center px-4">
    <div className="w-full max-w-md space-y-6">
      <h1 className="font-display text-3xl font-bold text-foreground text-center">Fator R</h1>
      <h2 className="text-xl text-center font-semibold">Nova senha</h2>
      {checking ? <p role="status">Verificando link...</p> : saved ? <p role="status">Senha alterada com sucesso. Entre com sua nova senha.</p> : !ready ? <p role="alert">Link inválido ou expirado. Solicite outro em “Esqueci minha senha”.</p> :
        <form onSubmit={submit} className="space-y-5">
          <div><label htmlFor="new-password" className="block mb-2 text-sm">Nova senha</label>
            <input id="new-password" autoComplete="new-password" type="password" minLength={6} required value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-lg border border-input bg-background text-foreground px-4 py-3" /></div>
          <div><label htmlFor="confirm-password" className="block mb-2 text-sm">Confirmar nova senha</label>
            <input id="confirm-password" autoComplete="new-password" type="password" minLength={6} required value={confirmation} onChange={e => setConfirmation(e.target.value)} className="w-full rounded-lg border border-input bg-background text-foreground px-4 py-3" /></div>
          {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>{pending ? "Salvando..." : "Salvar nova senha"}</Button>
        </form>}
      <Button asChild variant="link" className="w-full"><Link to="/login">Voltar ao login</Link></Button>
    </div>
  </main>;
}