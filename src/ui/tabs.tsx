import { useState, useRef, useEffect, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "./utils";

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface AnimatedTabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function AnimatedTabs({ tabs, activeTab, onChange, className }: AnimatedTabsProps) {
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const idx = tabs.findIndex((t) => t.id === activeTab);
    const el = tabsRef.current[idx];
    if (el) {
      setIndicatorStyle({ left: el.offsetLeft, width: el.offsetWidth });
    }
  }, [activeTab, tabs]);

  return (
    <div className={cn("relative flex items-center gap-0.5 rounded-lg bg-[#0a0a10] p-1", className)}>
      <motion.div
        className="absolute top-1 bottom-1 rounded-md bg-[#00ff8815] border border-[#00ff8830]"
        animate={indicatorStyle}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      />
      {tabs.map((tab, i) => (
        <button
          key={tab.id}
          ref={(el) => { tabsRef.current[i] = el; }}
          onClick={() => onChange(tab.id)}
          className={cn(
            "relative z-10 flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-md transition-colors cursor-pointer border-none bg-transparent",
            activeTab === tab.id ? "text-[#00ff88]" : "text-[#555] hover:text-[#888]"
          )}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
