import type { ButtonHTMLAttributes } from "react";
import { cx } from "@/lib/cx";
import styles from "./Button.module.css";

type Variant = "primary" | "accent" | "outline" | "ghost" | "destructive";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "md" | "sm";
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cx(
        styles.button,
        styles[variant],
        size === "sm" && styles.sm,
        fullWidth && styles.fullWidth,
        className,
      )}
      {...rest}
    />
  );
}
