"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Github } from "lucide-react";

interface Contributor {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
  type: string;
}

const REPO_OWNER = "Sree14hari";
const REPO_NAME = "EPOQ";
const MAX_SHOWN = 5;

export default function ContributorsBadge() {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contributors?per_page=30`
    )
      .then((r) => r.json())
      .then((data: Contributor[]) => {
        const humans = data.filter((c) => c.type !== "Bot");
        setContributors(humans.slice(0, MAX_SHOWN));
        setTotal(humans.length);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.a
      href={`https://github.com/${REPO_OWNER}/${REPO_NAME}`}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.5 }}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      className="inline-flex items-center gap-3 bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 hover:border-orange-500/30 backdrop-blur-md rounded-full pl-1 pr-5 py-1 transition-all duration-300 cursor-pointer group"
    >
      {/* Overlapping avatars */}
      <div className="flex items-center">
        {loading
          ? // Skeleton
            Array.from({ length: MAX_SHOWN }).map((_, i) => (
              <div
                key={i}
                className="w-9 h-9 rounded-full bg-white/10 animate-pulse border-2 border-[#0a0a0a] ring-0"
                style={{ marginLeft: i === 0 ? 0 : -10, zIndex: MAX_SHOWN - i }}
              />
            ))
          : contributors.map((c, i) => (
              <motion.div
                key={c.id}
                className="relative"
                style={{ marginLeft: i === 0 ? 0 : -10, zIndex: i === hovered ? 99 : MAX_SHOWN - i }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                whileHover={{ y: -4, scale: 1.18 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              >
                {/* Tooltip */}
                {hovered === i && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute -top-9 left-1/2 -translate-x-1/2 bg-[#111] border border-white/10 text-white text-[10px] font-semibold px-2 py-1 rounded-lg whitespace-nowrap pointer-events-none shadow-xl z-[100]"
                  >
                    {c.login}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#111] border-r border-b border-white/10 rotate-45" />
                  </motion.div>
                )}
                <img
                  src={c.avatar_url}
                  alt={c.login}
                  className="w-9 h-9 rounded-full border-2 border-[#0a0a0a] object-cover shadow-md"
                />
              </motion.div>
            ))}
      </div>

      {/* Text */}
      <div className="flex flex-col leading-tight">
        <span className="text-white text-xs font-bold">
          {loading ? "…" : `${total}+ Contributors`}
        </span>
        <span className="text-white/30 text-[10px] flex items-center gap-1">
          <Github size={9} />
          Open Source
        </span>
      </div>
    </motion.a>
  );
}
