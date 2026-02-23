"use client";


import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ArrowRight, Github } from "lucide-react";
import EnergyBeam from "./components/ui/energy-beam";
import Footer from "./components/Footer";
import Navbar from "./components/Navbar";
import Features from "./components/Features";
import { AuroraText } from "./components/ui/aurora-text";
import { Terminal, TypingAnimation, AnimatedSpan } from "./components/ui/terminal";
import { IconCloud } from "./components/ui/icon-cloud"
import ContributorsBadge from "./components/Contributors";

function App() {
  const heroRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const imageScale = useTransform(
    scrollYProgress,
    [0, 0.4, 0.8, 1],
    [1, 1.15, 1, 1]
  );

  const imageY = useTransform(
    scrollYProgress,
    [0, 0.4, 0.8, 1],
    [0, 50, 0, 0]
  );

  const techStacks = [
    { name: "Next.js", src: "/nextdotjs.svg" },
    { name: "Rust", src: "/rust.svg" },
    { name: "Tauri", src: "/tauri.svg" },
    { name: "PyTorch", src: "/pytorch.svg" },
    { name: "React", src: "/react.svg" },
    { name: "Python", src: "/python.svg" },
  ];
  const cloudImages = [
  "/nextdotjs.svg",
  "/rust.svg",
  "/tauri.svg",
  "/pytorch.svg",
  "/react.svg",
  "/python.svg",
]

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-orange-500/30 selection:text-orange-200 overflow-x-hidden">
      <Navbar />

      {/* Hero Section */}
      <section
        ref={heroRef}
        className="relative z-10 pt-32 pb-20 px-6 w-full flex flex-col items-center text-center overflow-hidden min-h-[150vh] justify-start"
      >
        <div className="absolute inset-0 z-0 pointer-events-none">
          <EnergyBeam className="opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black z-10" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-orange-900/20 via-black/0 to-black/0 z-10" />
        </div>

        <div className="relative z-20 max-w-7xl mx-auto flex flex-col items-center">
          {/* Release Pill */}
          <motion.a
            href="https://github.com/Sree14hari/EPOQ/releases/tag/V0.2.0-beta"
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            whileHover={{ scale: 1.05 }}
            className="group inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 hover:border-orange-500/60 text-orange-300 text-xs font-semibold tracking-wide transition-all duration-300 cursor-pointer shadow-[0_0_20px_rgba(234,88,12,0.15)] hover:shadow-[0_0_30px_rgba(234,88,12,0.3)]"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse shrink-0" />
            <span className="text-orange-400/70">New release</span>
            <span className="text-white/30 select-none">·</span>
            <span>v0.2.0-beta is available</span>
            <ArrowRight className="w-3 h-3 opacity-60 group-hover:translate-x-0.5 group-hover:opacity-100 transition-all duration-300" />
          </motion.a>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-6xl md:text-8xl font-black tracking-tighter mb-8 leading-[0.9]"
          >
            Train Models.
            <br />
            <AuroraText className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-200 to-orange-400">
              On Your Metal.
            </AuroraText>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-white/60 max-w-2xl mb-8"
          >
            A high-performance desktop GUI for training PyTorch Image
            Classification models. No cloud bills. No CLI scripts. Just pure
            local power.
          </motion.p>

          {/* Contributors Badge */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-12"
          >
            <ContributorsBadge />
          </motion.div>

          <motion.div
            style={{ scale: imageScale, y: imageY }}
            className="mt-24 w-full max-w-5xl perspective-1000 sticky top-32 z-30"
          >
            <div className="relative rounded-xl border border-white/10 bg-[#0a0a0a] backdrop-blur-xl shadow-[0_0_50px_rgba(234,88,12,0.1)] overflow-hidden flex flex-col m-10 items-center">
              <div className="h-10 w-full bg-white/[0.02] border-b border-white/10 flex items-center px-4 gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="relative aspect-video w-full bg-black">
                <img
                  src="/screen.webp"
                  alt="EPOQ Interface"
                  className="w-full h-full object-cover object-top"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <Features />

      {/* Tech Stack Section */}
      <section
        id="stack"
        className="py-24 border-y border-white/5 bg-neutral-950/50"
      >
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-white/40 uppercase tracking-widest text-sm font-bold mb-12">
            Powered by modern technologies
          </p>

          <div className="flex flex-wrap justify-center gap-16 sm:gap-24">
            {techStacks.map((tech) => (
              <motion.div
                key={tech.name}
                whileHover={{ y: -6 }}
                className="group flex flex-col items-center gap-4 cursor-pointer"
              >
                <img
                  src={tech.src}
                  alt={tech.name}
                  className="h-12 w-auto brightness-0 invert opacity-70 transition-all duration-300 group-hover:opacity-100"
                />
                <span className="text-sm text-white/40 group-hover:text-white transition-colors">
                  {tech.name}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
     <section
  id="docs"
  className="py-28 bg-[#070707] border-t border-white/5 relative overflow-hidden"
>
  {/* glow background */}
  <div className="absolute inset-0 opacity-20 pointer-events-none">
    <div className="absolute top-0 right-0 w-96 h-96 bg-orange-600/10 blur-[120px]" />
    <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/10 blur-[120px]" />
  </div>

  <div className="max-w-7xl mx-auto px-6 relative z-10">
    <div className="grid lg:grid-cols-2 gap-20 items-center">

      {/* LEFT COLUMN */}
      <div>
        <div className="mb-20">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
            Ready to Start?
          </h2>
          <p className="text-white/40 text-lg">
            Follow these simple steps to run EPOQ locally.
          </p>
        </div>

        <div className="space-y-16">

          {/* STEP 1 */}
          <div className="space-y-6">
            <h3 className="text-white font-bold text-lg flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-sm font-bold">
                1
              </span>
              Clone Repository
            </h3>

            <Terminal className="bg-black border-white/10" sequence={false}>
              <AnimatedSpan>
                <TypingAnimation className="text-green-400">
                  git clone https://github.com/Sree14hari/EPOQ.git
                </TypingAnimation>
              </AnimatedSpan>
              <AnimatedSpan>
                <TypingAnimation className="text-green-400">
                  cd EPOQ
                </TypingAnimation>
              </AnimatedSpan>
            </Terminal>
          </div>

          {/* STEP 2 */}
          <div className="space-y-6">
            <h3 className="text-white font-bold text-lg flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-sm font-bold">
                2
              </span>
              Install Dependencies
            </h3>

            <Terminal className="bg-black border-white/10" sequence={false}>
              <AnimatedSpan>
                <TypingAnimation className="text-green-400">
                  cd image-trainer
                </TypingAnimation>
              </AnimatedSpan>
              <AnimatedSpan>
                <TypingAnimation className="text-green-400">
                  npm install
                </TypingAnimation>
              </AnimatedSpan>
            </Terminal>
          </div>

          {/* STEP 3 */}
          <div className="space-y-6">
            <h3 className="text-white font-bold text-lg flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-sm font-bold">
                3
              </span>
              Start Development
            </h3>

            <Terminal className="bg-black border-white/10" sequence={false}>
              <AnimatedSpan>
                <TypingAnimation className="text-green-400">
                  npm run tauri dev
                </TypingAnimation>
              </AnimatedSpan>
            </Terminal>
          </div>

        </div>
      </div>

      {/* RIGHT COLUMN */}
     <div className="flex justify-center items-start pt-32">
  <IconCloud images={cloudImages} />
</div>

    </div>
  </div>
</section>
      {/* Download Section */}
      <section
        id="download"
        className="relative py-32 overflow-hidden border-t border-white/5"
      >
        {/* Background glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-600/10 blur-[140px] rounded-full" />
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400 text-xs font-semibold tracking-widest uppercase"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
            V0.2.0-beta · Now Available
          </motion.div>

          {/* Heading */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-5 leading-[0.95]"
          >
            Download EPOQ.
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.25 }}
            className="text-white/50 text-lg max-w-xl mx-auto mb-10"
          >
            Train PyTorch image classifiers locally — no cloud, no CLI. Just install and run.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.35 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            {/* Primary Download */}
            <a
              href="https://github.com/Sree14hari/EPOQ/releases/tag/V0.2.0-beta"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative inline-flex items-center gap-3 bg-orange-500 hover:bg-orange-400 text-white px-8 py-3.5 rounded-2xl text-sm font-bold overflow-hidden transition-all duration-300 active:scale-95 shadow-[0_0_30px_rgba(234,88,12,0.4)] hover:shadow-[0_0_45px_rgba(234,88,12,0.6)]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download for Windows
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
            </a>

            {/* Secondary: View Release */}
            <a
              href="https://github.com/Sree14hari/EPOQ/releases/tag/V0.2.0-beta"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl border border-white/10 bg-white/5 text-white/70 hover:text-white hover:border-white/20 hover:bg-white/10 text-sm font-medium transition-all duration-300"
            >
              <Github className="w-4 h-4" />
              View Release Notes
            </a>
          </motion.div>

          {/* Version meta */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="mt-8 text-white/20 text-xs"
          >
            EPOQ V0.2.0-beta · Open Source · MIT License
          </motion.p>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default App;