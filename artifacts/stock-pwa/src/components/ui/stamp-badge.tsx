import { cn } from "@/lib/utils";

const STAMP_ROTATIONS: Record<string, string> = {
  success: "-rotate-3",
  warning: "-rotate-2",
  danger: "rotate-2",
  info: "-rotate-1",
};

export function StampBadge({
  children,
  variant = "info",
  className,
}: {
  children: React.ReactNode;
  variant?: "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center px-3 py-1 font-display font-bold uppercase text-xs tracking-wider",
        "border-2 rounded-sm select-none",
        STAMP_ROTATIONS[variant],
        variant === "success" && "border-status-success text-status-success",
        variant === "warning" && "border-status-warning text-status-warning",
        variant === "danger" && "border-status-danger text-status-danger",
        variant === "info" && "border-status-info text-status-info",
        className
      )}
      style={{
        boxShadow: "inset 0 0 0 1px currentColor",
        opacity: 0.9,
      }}
    >
      {children}
    </span>
  );
}
