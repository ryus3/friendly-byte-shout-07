import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-slate-500/80 text-slate-50 hover:bg-slate-500",
        primary: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-red-500/80 text-destructive-foreground hover:bg-red-500",
        warning: "border-transparent bg-yellow-500/80 text-yellow-50 hover:bg-yellow-500",
        success: "border-transparent bg-green-500/80 text-green-50 hover:bg-green-500",
        info: "border-transparent bg-sky-500/80 text-sky-50 hover:bg-sky-500",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }