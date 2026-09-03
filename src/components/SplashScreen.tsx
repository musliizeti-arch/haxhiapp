import { useEffect, useState } from "react";
import logo from "@/assets/haxhi-logo.png.asset.json";
import { Copyright } from "@/components/Copyright";

const SPLASH_KEY = "haxhi-splash-shown";

export function SplashScreen() {
  // Start hidden (SSR-safe); show only once per browser session.
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(SPLASH_KEY)) return;
    window.sessionStorage.setItem(SPLASH_KEY, "1");
    setVisible(true);
    const a = setTimeout(() => setFading(true), 1500);
    const b = setTimeout(() => setVisible(false), 2100);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-100 flex flex-col items-center justify-center gap-6 bg-background transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      <img
        src={logo.url}
        alt="Logo e Muftinisë së BFI Gostivar"
        className="size-40 animate-in fade-in zoom-in-95 object-contain duration-700"
      />
      <div className="text-center">
        <p className="text-2xl font-bold tracking-tight text-primary">HAXHI.app</p>
        <p className="mt-1 text-xs text-muted-foreground">Muftinia e BFI Gostivar</p>
      </div>
      <Copyright fixed />
    </div>
  );
}
