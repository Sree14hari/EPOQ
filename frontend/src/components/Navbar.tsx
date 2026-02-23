"use client";

import { useState, useEffect } from 'react';
import { Github, ArrowRight, Search, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="fixed top-0 w-full z-[100] px-6 py-4 flex justify-center pointer-events-none">
      <nav 
        className={`
          pointer-events-auto relative
          flex items-center justify-between 
          transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]
          ${isScrolled 
            ? 'w-full max-w-4xl px-4 py-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]' 
            : 'w-full max-w-6xl px-6 py-4 bg-transparent border border-transparent rounded-none'
          }
        `}
      >
        {/* Left: Brand */}
        <div className="flex items-center gap-8">
          <a href="#" className="flex items-center gap-2.5 group relative">
            <div className="relative w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center bg-black">
  {/* Shine effect (optional – remove if you want ultra-minimal) */}
  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />

  <img 
    src="/logo.webp" 
    alt="EPOQ Logo"
    className="w-10 h-10 object-contain relative z-10"
  />
</div>
            <span className="text-lg font-bold tracking-tight text-white uppercase hidden sm:block">
              EPOQ
            </span>
          </a>

          {/* Desktop Nav: Center */}
          <div className="hidden md:flex items-center gap-1">
            {['Features', 'Stack', 'Docs'].map((item) => (
              <a 
                key={item}
                href={`#${item.toLowerCase()}`} 
                className="px-4 py-1.5 rounded-full text-[13px] font-medium text-white/50 hover:text-white hover:bg-white/5 transition-all duration-300"
              >
                {item}
              </a>
            ))}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Subtle Search / Cmd+K */}
          <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white/30 hover:border-white/20 transition-colors cursor-pointer group">
            <Search className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium">Search</span>
            <kbd className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded-md font-sans border border-white/10 group-hover:text-white/60 transition-colors">⌘K</kbd>
          </div>

          <div className="w-[1px] h-4 bg-white/10 hidden sm:block" />

          <a 
            href="https://github.com/Sree14hari/EPOQ" 
            target="_blank" 
            className="text-white/40 hover:text-white transition-colors p-2"
          >
            <Github className="w-4 h-4" />
          </a>

          <a 
            href="#download" 
            className="group relative inline-flex items-center gap-2 bg-white text-black px-5 py-2 rounded-xl text-[13px] font-bold overflow-hidden transition-all active:scale-95"
          >
            {/* Hover Fill Effect */}
            <div className="absolute inset-0 bg-orange-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            
            <span className="relative z-10 group-hover:text-white transition-colors duration-300">Get Started</span>
            <ArrowRight className="w-3.5 h-3.5 relative z-10 group-hover:text-white group-hover:translate-x-0.5 transition-all duration-300" />
          </a>

          {/* Mobile Menu Icon */}
          <button 
            className="md:hidden p-2 text-white/60 hover:text-white transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute top-full left-0 right-0 mt-2 p-4 bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl flex flex-col gap-2 md:hidden"
            >
              {['Features', 'Stack', 'Docs'].map((item) => (
                <a 
                  key={item}
                  href={`#${item.toLowerCase()}`} 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="px-4 py-3 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-all duration-300"
                >
                  {item}
                </a>
              ))}
              <div className="h-[1px] w-full bg-white/10 my-2" />
              <a 
                href="https://github.com/Sree14hari/EPOQ" 
                target="_blank" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-all duration-300"
              >
                <Github className="w-4 h-4" />
                GitHub
              </a>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </div>
  );
}