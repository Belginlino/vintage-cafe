import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Delete } from "lucide-react";
import { toast } from "sonner";
import hero from "@/assets/login-hero.jpg";
import { Wordmark } from "@/components/pos/Wordmark";
import { firstAllowedPath } from "@/components/pos/AppShell";
import { login } from "@/lib/pos/store";
import { errMsg } from "@/lib/pos/csv";
import { meta } from "@/lib/pos/meta";

export const Route = createFileRoute("/")({
  head: () => meta("Staff Sign In", "Sign in to the VINTAGE Cafe point-of-sale terminal."),
  component: Login,
});

function Login() {
  const [pin, setPin] = useState("");
  const navigate = useNavigate();
  const submit = (p = pin) => {
    try {
      const s = login(p);
      toast.success(`Welcome, ${s.name}`);
      navigate({ to: firstAllowedPath(s.role) });
    } catch (e) {
      toast.error(errMsg(e));
      setPin("");
    }
  };
  const press = (k: string) => {
    const next = (pin + k).slice(0, 6);
    setPin(next);
  };
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <img src={hero} alt="VINTAGE Cafe interior" className="absolute inset-0 h-full w-full object-cover" width={1024} height={1280} />
        <div className="absolute inset-0 bg-mahogany/40" />
      </div>
      <div className="flex items-center justify-center bg-royal p-8">
        <div className="w-full max-w-sm rounded-xl border border-gold/50 bg-card p-8 shadow-card">
          <Wordmark size="lg" />
          <p className="mt-6 text-center text-sm text-muted-foreground">Enter your staff PIN</p>
          <div className="my-4 flex justify-center gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={i} className={`h-3 w-3 rounded-full border border-gold ${i < pin.length ? "bg-primary" : ""}`} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
              <Key key={k} onClick={() => press(k)}>{k}</Key>
            ))}
            <Key onClick={() => setPin(pin.slice(0, -1))} aria-label="Delete"><Delete className="mx-auto h-5 w-5" /></Key>
            <Key onClick={() => press("0")}>0</Key>
            <button onClick={() => submit()} disabled={pin.length < 4} className="rounded-md bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-40">
              Enter
            </button>
          </div>
          <div className="mt-6 rounded-md bg-muted p-3 text-xs text-muted-foreground">
            <div className="font-semibold text-foreground">Demo PINs</div>
            Admin 1111 · Manager 2222 · Cashier 3333 · Kitchen 4444
          </div>
        </div>
      </div>
    </div>
  );
}
function Key(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className="rounded-md border border-border bg-secondary py-3 text-lg font-semibold text-secondary-foreground hover:border-gold" />;
}
