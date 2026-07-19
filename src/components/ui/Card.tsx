import type { HTMLAttributes } from "react";
import { cx } from "@/lib/cx";
import styles from "./Card.module.css";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export function Card({ padded = true, className, ...rest }: CardProps) {
  return <div className={cx(styles.card, padded && styles.padded, className)} {...rest} />;
}
