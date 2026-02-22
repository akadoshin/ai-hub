import { type ReactNode, useRef, useId } from "react";
import { motion } from "framer-motion";
import { cn } from "./utils";

interface MovingBorderProps {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  borderColor?: string;
  duration?: number;
}

export function MovingBorder({
  children,
  className,
  containerClassName,
  borderColor = "#00ff88",
  duration = 3,
}: MovingBorderProps) {
  const id = useId();

  return (
    <div className={cn("relative rounded-xl p-[1px] overflow-hidden", containerClassName)}>
      <div className="absolute inset-0">
        <svg className="absolute h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`grad-${id}`}>
              <stop offset="0%" stopColor={borderColor} stopOpacity="0" />
              <stop offset="50%" stopColor={borderColor} stopOpacity="1" />
              <stop offset="100%" stopColor={borderColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          <motion.rect
            x="0" y="0" width="100" height="100"
            fill="none"
            stroke={`url(#grad-${id})`}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            rx="12"
            strokeDasharray="120 280"
            animate={{ strokeDashoffset: [0, -400] }}
            transition={{ duration, repeat: Infinity, ease: "linear" }}
          />
        </svg>
      </div>
      <div className={cn("relative rounded-xl", className)}>
        {children}
      </div>
    </div>
  );
}
