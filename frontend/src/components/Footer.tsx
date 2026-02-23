"use client";

import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { Github, Twitter, Linkedin, Youtube, ArrowUpRight, ShieldCheck, Heart, HandHeartIcon } from 'lucide-react';

export default function NextLevelFooter() {
    const footerRef = useRef<HTMLElement>(null);
    const textRef = useRef<HTMLDivElement>(null);

    const { scrollYProgress } = useScroll({
        target: footerRef,
        offset: ["start end", "end end"]
    });

    const textY = useTransform(scrollYProgress, [0, 1], [100, 0]);
    const springTextY = useSpring(textY, { stiffness: 50, damping: 20 });

    return (
        <footer 
            ref={footerRef}
            className="relative min-h-screen bg-[#050505] pt-24 overflow-hidden flex flex-col justify-between"
        >
            {/* Elegant Grid Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

            <div className="max-w-7xl mx-auto w-full px-6 z-20 relative">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start gap-12 pb-20 border-b border-white/5">
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg shadow-orange-600/20">
                            <img
                                src="/logo.webp"
                                alt="EPOQ Logo"
                                className="w-full h-full object-contain"
                            />
                            </div>
                            <span className="text-3xl font-bold text-white tracking-tighter italic">EPOQ</span>
                        </div>
                        <p className="text-white/40 max-w-xs text-sm leading-relaxed">
                            Redefining the boundaries of digital motion and brand identity through neural-driven design.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-12">
                        <FooterLinks title="Platform" links={["Universe", "Studio", "Assets", "Beta"]} />
                        <FooterLinks title="Resources" links={["Documentation", "API", "Community", "Support"]} />
                        <div className="flex flex-col gap-4">
                            <h4 className="text-white font-bold text-xs uppercase tracking-[0.2em]">Join the Wave</h4>
                            <div className="flex gap-3">
                                {[Github, Twitter, Linkedin].map((Icon, i) => (
                                    <a key={i} href="#" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white/50 hover:bg-white hover:text-black transition-all">
                                        <Icon size={18} />
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* THE INTERACTIVE TEXT SECTION */}
            <div className="relative flex-1 flex flex-col justify-end items-center px-4">
                <motion.div 
                    ref={textRef}
                    style={{ y: springTextY }}
                    className="relative group w-full flex justify-center"
                >
                    {/* The "Vapor" Background */}
                    <div className="z-[-1]  absolute inset-0 flex justify-center items-end select-none pointer-events-none pl-10 pt-10">
                        <span className="text-[28vw] font-black leading-none tracking-tighter text-orange-600 blur-xl opacity-0 group-hover:opacity-40 transition-opacity duration-500">
                            EPOQ
                        </span>
                    </div>

                    {/* The White Text */}
                    <h2 
                        className="text-[28vw] font-black leading-none tracking-tighter text-white select-none transition-all duration-75 "
                    >
                        EPOQ
                    </h2>
                </motion.div>

                {/* Bottom Bar */}
                <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center py-5 border-t border-white/5 z-30 bg-transparent">
                    <div className="flex items-center gap-6 text-[10px] uppercase tracking-widest text-white/30">
                        <p>© 2026 EPOQ STUDIOS</p>
                        <span className="w-1 h-1 bg-white/20 rounded-full" />
                        <p>All Rights Reserved</p>
                    </div>
                    
                    <div className="flex gap-8 mt-6 md:mt-0 items-center">
                        <div className="flex items-center gap-2 text-white/40 hover:text-white transition-colors cursor-pointer">
                            {/* <ShieldCheck size={14} className="text-orange-500" /> */}
                            <HandHeartIcon size={14} className="text-red-500" />
                            <span className="text-[10px] uppercase tracking-widest">sreehari R</span>
                        </div>
                        <a href="#top" className="group p-2 border border-white/10 rounded-full hover:border-orange-500 transition-colors">
                            <ArrowUpRight size={20} className="text-white group-hover:text-orange-500 transition-colors" />
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}

function FooterLinks({ title, links }: { title: string, links: string[] }) {
    return (
        <div className="space-y-4">
            <h4 className="text-white font-bold text-xs uppercase tracking-[0.2em]">{title}</h4>
            <ul className="space-y-2">
                {links.map(link => (
                    <li key={link}>
                        <a href="#" className="text-white/30 hover:text-white text-sm transition-colors decoration-orange-500/0 hover:decoration-orange-500/100 underline underline-offset-4 decoration-2">
                            {link}
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
}