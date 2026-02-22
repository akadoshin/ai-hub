import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "./utils";

interface TextGenerateProps {
  text: string;
  className?: string;
  duration?: number;
}

export function TextGenerate({ text, className, duration = 0.3 }: TextGenerateProps) {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    setDisplayedText("");
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayedText(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
      }
    }, (duration * 1000) / text.length);
    return () => clearInterval(interval);
  }, [text, duration]);

  return (
    <motion.span
      className={cn("inline-block", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {displayedText}
      {displayedText.length < text.length && (
        <span className="animate-pulse text-[#00ff88]">▊</span>
      )}
    </motion.span>
  );
}
