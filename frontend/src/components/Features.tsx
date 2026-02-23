"use client";

import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowUpRight, Zap, Database, Terminal, Cpu } from 'lucide-react';
import { useRef } from 'react';
import BatteryChargingIcon from './ui/battery-charging-icon';
import CpuIcon from './ui/cpu-icon';
import FileDescriptionIcon from './ui/file-description-icon';
import Cloud3Icon from './ui/cloud-3-icon';
import ShieldCheck from './ui/shield-check';
import TerminalIcon from './ui/terminal-icon';
export default function Features() {
  return (
    <section id="features" className="py-32 px-6 relative bg-black overflow-hidden">
      {/* Dynamic Background Noise/Glow */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-1/4 -left-10 w-96 h-96 bg-orange-600 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 -right-10 w-96 h-96 bg-blue-600 rounded-full blur-[120px] opacity-30" />
      </div>

      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.7 }}
          className="mb-32 text-center"
        >
          <p className="text-orange-400/80 text-sm font-semibold uppercase tracking-[0.2em] mb-4">Everything you need</p>
          <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tight text-white">Power in your hands.</h2>
          <p className="text-white/40 text-lg max-w-xl mx-auto leading-relaxed">Batteries-included deep learning environment designed for productivity and performance.</p>
        </motion.div>

        <div className="space-y-40">
          <FeatureBlock 
            title="Real-time Analytics"
            description="Monitor training loss, accuracy, and system metrics with zero latency. Interactive charts give you instant feedback on model convergence."
            icon={<BatteryChargingIcon className="text-orange-500 w-5 h-5" />}
            visual={<LiveChartVisual />}
          />

        <FeatureBlock 
          title="Native Rust Core"
          description="Built on Tauri v2. Blazing fast performance with minimal memory overhead compared to traditional Electron apps."
          icon={<CpuIcon className="text-orange-500 w-5 h-5" />}
          visual={<RustCoreVisual />}
          reverse
        />

        <FeatureBlock 
          title="Smart Datasets"
          description="Auto-split folders, validation sets, and one-click ZIP exports. Drag & drop simplicity for complex data pipelines."
          icon={<Cloud3Icon className="text-orange-500 w-5 h-5" />}
          visual={<DatasetVisual />}
        />

        <FeatureBlock 
          title="Zero-Config UI"
          description="Configure hyper-parameters via a sleek, intuitive UI. No more fighting with YAML files or command-line arguments."
          icon={<TerminalIcon className="text-orange-500 w-5 h-5" />}
          visual={<TerminalVisual />}
          reverse
        />
        </div>
      </div>
    </section>
  );
}

// --- Reusable Feature Layout Component ---
function FeatureBlock({ title, description, visual, icon, reverse = false }: any) {
  return (
    <div className={`flex flex-col ${reverse ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-16 md:gap-24`}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
        className="flex-1 space-y-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl border border-white/10">{icon}</div>
          <span className="text-orange-500 font-mono text-sm tracking-widest uppercase">Performance</span>
        </div>
        <h3 className="text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
          {title}
        </h3>
        <p className="text-neutral-400 text-lg leading-relaxed">
          {description}
        </p>
        <button className="bg-white text-black rounded-full px-5 py-2.5 flex items-center gap-2 font-medium hover:bg-neutral-200 transition-colors w-fit mt-4">
          Discover How 
          <div className="bg-black text-white rounded-full p-1 flex items-center justify-center">
            <ArrowUpRight className="w-3 h-3" />
          </div>
        </button>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
        className="flex-1 w-full flex justify-center items-center"
      >
        {visual}
      </motion.div>
    </div>
  );
}

// --- Visual: Animated Bar Chart ---
function LiveChartVisual() {
  const bars = [40, 70, 45, 90, 65, 80, 50, 95, 60];
  return (
    <div className="relative w-full aspect-square max-w-md bg-white/[0.02] border border-white/10 rounded-3xl overflow-hidden p-8 flex flex-col justify-end">
      <div className="absolute inset-0 bg-gradient-to-t from-orange-500/5 to-transparent" />
      <div className="flex items-end justify-between h-48 gap-2 relative z-10">
        {bars.map((h, i) => (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            whileInView={{ height: `${h}%` }}
            transition={{ 
              duration: 1.5, 
              delay: i * 0.1, 
              ease: [0.22, 1, 0.36, 1],
              repeat: Infinity,
              repeatType: "reverse",
              repeatDelay: 1
            }}
            className={`w-full rounded-t-lg relative group ${i === 7 ? 'bg-orange-500' : 'bg-white/10'}`}
          >
            {i === 7 && (
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-orange-500 text-[10px] font-bold px-2 py-1 rounded text-white shadow-[0_0_20px_rgba(234,88,12,0.5)]">
                PEAK
              </div>
            )}
          </motion.div>
        ))}
      </div>
      <div className="mt-8 border-t border-white/10 pt-4 flex justify-between text-[10px] font-mono text-white/20">
        <span>00:00:01</span>
        <span>LATENCY: 2ms</span>
        <span>STABLE</span>
      </div>
    </div>
  );
}

// --- Visual: Pulsing Rust Nodes ---
function RustCoreVisual() {
  return (
    <div className="relative w-full aspect-square max-w-md flex items-center justify-center">
      <div className="grid grid-cols-3 gap-4 relative z-10">
        {[...Array(9)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0.2, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatType: "mirror",
              delay: i * 0.2
            }}
            className={`w-20 h-20 rounded-2xl border ${i === 4 ? 'border-orange-500 bg-orange-500/20' : 'border-white/10 bg-white/5'} flex items-center justify-center`}
          >
             {i === 4 && <div className="w-4 h-4 rounded-full bg-orange-500 animate-ping" />}
             {i !== 4 && <div className="w-1 h-1 rounded-full bg-white/20" />}
          </motion.div>
        ))}
      </div>
      {/* Geometric Lines connecting nodes could be added here */}
    </div>
  );
}

// --- Visual: Smart Dataset Interface ---
function DatasetVisual() {
  return (
    <div className="w-full aspect-square max-w-md bg-[#080808] border border-white/10 rounded-2xl shadow-2xl p-6 relative overflow-hidden group">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
        <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
      </div>
      
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <motion.div 
            key={i}
            whileHover={{ x: 10, backgroundColor: "rgba(255,255,255,0.05)" }}
            className="p-4 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                <FileDescriptionIcon className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <div className="text-white text-sm font-medium">dataset_v0{i}.zip</div>
                <div className="text-white/30 text-[10px]">Added 2m ago • 45.2 MB</div>
              </div>
            </div>
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
          </motion.div>
        ))}
      </div>

      <motion.div 
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 4, repeat: Infinity }}
        className="absolute bottom-6 right-6 bg-orange-600 p-4 rounded-2xl shadow-2xl border border-orange-400/50"
      >
        <ShieldCheck className="text-white" fill="white" />
      </motion.div>
    </div>
  );
}

// --- Visual: Futuristic Terminal ---
function TerminalVisual() {
  return (
    <div className="w-full aspect-square max-w-md bg-black border border-white/10 rounded-xl p-6 font-mono text-xs overflow-hidden relative group">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-50" />
      
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-green-500">➜</span>
          <span className="text-white">epoq train --model ultra-v4</span>
        </div>
        <div className="text-white/40 leading-relaxed">
          [1/50] Loss: 0.842 <br />
          [2/50] Loss: 0.612 <br />
          [3/50] Loss: 0.455 <br />
          <span className="text-orange-500 animate-pulse">● System: GPU Overclocked (82°C)</span>
        </div>

        <div className="pt-4 mt-4 border-t border-white/5 space-y-3">
          <div className="flex justify-between text-[10px] text-white/60">
            <span>EPOCH PROGRESS</span>
            <span>88%</span>
          </div>
          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
            <motion.div 
              initial={{ width: 0 }}
              whileInView={{ width: "88%" }}
              transition={{ duration: 2 }}
              className="h-full bg-orange-500 shadow-[0_0_15px_rgba(234,88,12,0.8)]" 
            />
          </div>
        </div>
      </div>

      {/* Glass overlay that glimmers on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
    </div>
  );
}