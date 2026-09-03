import { cn } from "@/lib/utils";

export function Copyright({ className, fixed = false }: { className?: string; fixed?: boolean }) {
  return (
    <p
      className={cn(
        "text-[10px] tracking-wide text-muted-foreground/80 select-none",
        fixed && "fixed right-4 bottom-3 z-40",
        className,
      )}
    >
      © Musli Izeti
    </p>
  );
}
