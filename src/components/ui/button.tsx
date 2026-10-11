import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[background-color,color,box-shadow,opacity] duration-[var(--motion-quick)] ease-[var(--ease-out)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-elevated disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg shadow-[var(--shadow-press)] hover:bg-primary-strong",
        secondary:
          "border border-border bg-bg-elevated text-fg hover:bg-bg-well hover:border-muted",
        ghost: "bg-transparent text-muted hover:bg-bg-well hover:text-fg",
        danger: "bg-danger/15 text-danger hover:bg-danger/25",
      },
      size: {
        sm: "h-11 rounded-sm px-3 text-sm",
        md: "h-11 rounded-sm px-4 text-sm",
        lg: "h-12 rounded-sm px-5 text-base",
        icon: "size-11 rounded-sm",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";
