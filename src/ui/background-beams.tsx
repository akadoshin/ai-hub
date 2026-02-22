import { cn } from "./utils";

interface BackgroundBeamsProps {
  className?: string;
}

export function BackgroundBeams({ className }: BackgroundBeamsProps) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <svg
        className="absolute h-full w-full opacity-[0.03]"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
      >
        {[...Array(6)].map((_, i) => (
          <line
            key={i}
            x1={150 + i * 150}
            y1="0"
            x2={50 + i * 120}
            y2="1000"
            stroke="#00ff88"
            strokeWidth="1"
          >
            <animate
              attributeName="opacity"
              values="0;0.6;0"
              dur={`${3 + i * 0.7}s`}
              begin={`${i * 0.5}s`}
              repeatCount="indefinite"
            />
          </line>
        ))}
      </svg>
    </div>
  );
}
