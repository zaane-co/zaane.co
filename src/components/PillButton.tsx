import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

type PillButtonProps = {
  href: string;
  children: ReactNode;
  size?: "sm" | "lg";
  className?: string;
};

export default function PillButton({ href, children, size = "sm", className = "" }: PillButtonProps) {
  const isLg = size === "lg";

  return (
    <a
      href={href}
      className={`inline-flex items-center gap-3 rounded-full bg-foreground font-medium text-background transition-opacity hover:opacity-90 ${
        isLg ? "py-1.5 pl-6 text-base" : "py-1.5 pl-5 text-sm"
      } pr-1.5 ${className}`}
    >
      {children}
      <span
        className={`flex shrink-0 items-center justify-center rounded-full bg-background text-foreground ${
          isLg ? "h-10 w-10" : "h-8 w-8"
        }`}
      >
        <ArrowUpRight size={isLg ? 18 : 16} />
      </span>
    </a>
  );
}
