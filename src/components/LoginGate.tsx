import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isSignedIn, signIn } from "@/lib/passport-store";
import logo from "@/assets/haxhi-logo.png.asset.json";

export function useAuthed() {
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setAuthed(isSignedIn());
    setReady(true);
  }, []);
  return { authed, ready, setAuthed };
}

export function LoginGate({
  children,
  authed,
  ready,
  onAuthed,
}: {
  children: ReactNode;
  authed: boolean;
  ready: boolean;
  onAuthed: (v: boolean) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  if (!ready) return null;
  if (authed) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-secondary to-background px-4">
      <Card className="w-full max-w-sm shadow-[var(--shadow-panel)]">
        <CardHeader className="items-center text-center">
          <img src={logo.url} alt="Logo HAXHI.app" className="mx-auto size-20 object-contain" />
          <CardTitle className="pt-2 text-xl">HAXHI.app</CardTitle>
          <p className="text-xs text-muted-foreground">Kyçuni për të vazhduar</p>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (signIn(username, password)) onAuthed(true);
              else setError(true);
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="u">Përdoruesi</Label>
              <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p">Fjalëkalimi</Label>
              <Input
                id="p"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">Kredenciale të gabuara.</p>}
            <Button type="submit" className="w-full">
              Hyr
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Fillimisht: admin / haxhi — ndryshojini te Cilësimet.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
