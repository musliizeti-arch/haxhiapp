import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ListChecks, MessageCircle, Plane, ScanLine, Settings, Syringe, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import logo from "@/assets/haxhi-logo.png.asset.json";

const NAV = [
  { to: "/", label: "Pasaportat", icon: ScanLine },
  { to: "/lista", label: "Lista e emrave", icon: ListChecks },
  { to: "/grupet", label: "Grupe / Fluturime", icon: Plane },
  { to: "/vaksinat", label: "Vaksinat", icon: Syringe },
  { to: "/udheheqesit", label: "Udhëheqësit fetarë", icon: Users },
] as const;

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background font-sans">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border/60 bg-card lg:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <img src={logo.url} alt="Logo HAXHI.app" className="size-11 object-contain" />
          <div>
            <p className="text-base font-bold tracking-tight">HAXHI.app</p>
            <p className="text-[11px] text-muted-foreground">Muftinia e BFI Gostivar</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-primary/10 font-semibold text-primary hover:bg-primary/10" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-1 border-t border-border/60 p-3">
          <a
            href="https://web.whatsapp.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <MessageCircle className="size-4 text-primary" /> WhatsApp Web
          </a>
          <Link
            to="/settings"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Settings className="size-4" /> Cilësimet
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 lg:px-8">
            <div className="flex items-center gap-3">
              <img src={logo.url} alt="" className="size-9 object-contain lg:hidden" />
              <div>
                <h1 className="text-lg font-bold tracking-tight">{title}</h1>
                {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden">
            {NAV.map((item) => (
              <Button key={item.to} variant="ghost" size="sm" className="shrink-0 rounded-full" asChild>
                <Link
                  to={item.to}
                  activeProps={{ className: "bg-primary/10 text-primary" }}
                  activeOptions={{ exact: item.to === "/" }}
                >
                  <item.icon className="size-4" /> {item.label}
                </Link>
              </Button>
            ))}
            <Button variant="ghost" size="sm" className="shrink-0 rounded-full" asChild>
              <a href="https://web.whatsapp.com" target="_blank" rel="noreferrer">
                <MessageCircle className="size-4" /> WhatsApp
              </a>
            </Button>
            <Button variant="ghost" size="sm" className="shrink-0 rounded-full" asChild>
              <Link to="/settings">
                <Settings className="size-4" />
              </Link>
            </Button>
          </nav>
        </header>
        <main className={cn("flex-1 px-5 py-6 lg:px-8")}>{children}</main>
      </div>
    </div>
  );
}
