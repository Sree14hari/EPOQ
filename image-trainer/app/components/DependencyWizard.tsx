"use client";

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type DependencyStatus = {
  python: boolean;
  version: string | null;
  pandas: boolean;
  sklearn: boolean;
  torch: boolean;
  error?: string;
};

export default function DependencyWizard({ onComplete }: { onComplete: () => void }) {
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState<DependencyStatus | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [slideUp, setSlideUp] = useState(false);

  useEffect(() => {
    console.log("DependencyWizard mounted, starting checkDeps()");
    async function checkDeps() {
        try {
            const raw: string = await invoke("check_dependencies");
            let parsed: DependencyStatus;
            try {
                parsed = JSON.parse(raw);
            } catch (e) {
                parsed = { python: false, version: null, pandas: false, sklearn: false, torch: false, error: raw };
            }
            
            console.log("check_dependencies result:", parsed);
            setStatus(parsed);
            
            if (parsed.python && parsed.pandas && parsed.sklearn && parsed.torch) {
                // All good, wait briefly and trigger the slide up effect
                setTimeout(() => {
                    setChecking(false);
                    setTimeout(() => {
                        setSlideUp(true);
                        setTimeout(() => onComplete(), 700); // Wait for the 700ms animation
                    }, 1000); // Briefly show "Environment Ready" before sliding up
                }, 1000); // Buffer after loading to show check
            } else {
                setChecking(false);
            }
        } catch (e) {
            console.error("Failed to invoke check_dependencies", e);
            setStatus({ python: false, version: null, pandas: false, sklearn: false, torch: false, error: String(e) });
            setChecking(false);
        }
    }
    
    // Show splash screen for 2.5 seconds, then perform dependency checks
    const splashTimer = setTimeout(() => {
        setShowSplash(false);
        checkDeps();
    }, 2500);
    
    return () => clearTimeout(splashTimer);
  }, [onComplete]);

  let content = null;

  if (showSplash) {
    content = (
      <div className="flex flex-col items-center justify-center gap-8 w-full h-full bg-white">
        <div className="w-32 h-32 md:w-48 md:h-48 rounded-full overflow-hidden border border-zinc-200 shadow-[0_0_80px_rgba(0,0,0,0.05)] bg-zinc-50 flex items-center justify-center">
          <img src="/epoq2.png" alt="EPOQ Logo" className="w-[85%] h-[85%] object-cover rounded-full" />
        </div>
        <div className="flex flex-col items-center">
          <h1 className="text-4xl md:text-6xl font-black tracking-[0.2em] text-black">EPOQ</h1>
          <p className="text-zinc-500 tracking-[0.3em] uppercase text-xs mt-3">Image Trainer</p>
        </div>
      </div>
    );
  } else if (!status && checking) {
    content = (
      <div className="flex items-center justify-center w-full h-full bg-white backdrop-blur-md">
        <div className="flex flex-col items-center gap-4 text-center p-8">
            <span className="inline-block w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <h2 className="text-xl font-semibold text-black">Initializing EPOQ</h2>
            <p className="text-zinc-500">Verifying environment dependencies...</p>
        </div>
      </div>
    );
  } else if (status && status.python && status.pandas && status.sklearn && status.torch) {
    content = (
      <div className="flex items-center justify-center w-full h-full bg-white backdrop-blur-md">
        <div className="flex flex-col items-center gap-4 text-center transform scale-100 transition-transform duration-500">
            <div className="w-16 h-16 rounded-full bg-green-500/20 text-green-600 flex items-center justify-center text-3xl mb-2">
                ✓
            </div>
            <h2 className="text-2xl font-bold text-black">Environment Ready</h2>
            <p className="text-zinc-500">Python {status.version || "detected"} with all required libraries.</p>
        </div>
      </div>
    );
  } else {
      const isPythonMissing = !status?.python;
      const missingLibs = [];
      if (status && !status.pandas) missingLibs.push("pandas");
      if (status && !status.sklearn) missingLibs.push("scikit-learn");
      if (status && !status.torch) missingLibs.push("torch");
      const pipCommand = `pip install ${missingLibs.join(" ")}`;

      content = (
        <div className="flex flex-col items-center justify-start w-full h-full bg-zinc-950 p-6 overflow-y-auto">
          <div className="w-full max-w-2xl bg-zinc-900 border border-red-900/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col mt-8 shrink-0">
            <div className="p-8 border-b border-zinc-800 bg-red-950/20">
                <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                    <span className="text-red-500 text-4xl leading-none">⚠️</span>
                    Missing Dependencies
                </h1>
                <p className="text-zinc-400 mt-3 text-lg">
                    EPOQ requires Python and specific AI libraries to run background tasks. We detected some missing components on your system.
                </p>
            </div>

            <div className="p-8 space-y-8 flex-1">
                <div className="space-y-4">
                    <div className={`p-4 rounded-xl border flex items-center gap-4 ${status?.python ? 'bg-green-500/10 border-green-500/20 text-green-100' : 'bg-red-500/10 border-red-500/20 text-red-100'}`}>
                        <div className="text-2xl">{status?.python ? '✅' : '❌'}</div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-lg">Python Runtime</h3>
                            <p className={`text-sm ${status?.python ? 'text-green-400/80' : 'text-red-400/80'}`}>
                                {status?.python ? `Version ${status.version || 'unknown'} installed and in PATH.` : "Python not found in PATH."}
                            </p>
                        </div>
                    </div>

                    <div className={`p-4 rounded-xl border flex items-center gap-4 ${missingLibs.length === 0 ? 'bg-green-500/10 border-green-500/20 text-green-100' : 'bg-amber-500/10 border-amber-500/20 text-amber-100'}`}>
                        <div className="text-2xl">{missingLibs.length === 0 ? '✅' : '⚠️'}</div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-lg">AI Libraries</h3>
                            <p className={`text-sm ${missingLibs.length === 0 ? 'text-green-400/80' : 'text-amber-400/80'}`}>
                                {missingLibs.length === 0 ? "All required libraries installed." : `Missing: ${missingLibs.join(", ")}`}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <h3 className="text-xl font-semibold text-white border-b border-zinc-800 pb-2">How to Fix</h3>
                    
                    {isPythonMissing ? (
                        <div className="space-y-4">
                            <p className="text-zinc-300">
                                1. Download and install Python from the <a href="https://www.python.org/downloads/" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">official website</a>.
                            </p>
                            <p className="text-zinc-300">
                                2. <strong>Important:</strong> During installation, make sure to check the box that says <strong>&quot;Add python.exe to PATH&quot;</strong>.
                            </p>
                            <p className="text-zinc-300">
                                3. Restart EPOQ completely for the changes to take effect.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-zinc-300">
                                We found Python, but you are missing some required libraries. Run the following command in your terminal or command prompt:
                            </p>
                            <div className="bg-black/50 p-4 rounded-xl border border-zinc-800 flex items-center justify-between group">
                                <code className="text-blue-400 text-lg font-mono">{pipCommand}</code>
                                <button 
                                    onClick={() => navigator.clipboard.writeText(pipCommand)}
                                    className="text-zinc-500 hover:text-white transition-colors p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg opacity-0 group-hover:opacity-100"
                                    title="Copy to clipboard"
                                >
                                    📋
                                </button>
                            </div>
                            <p className="text-sm text-zinc-500 italic mt-2">
                                After installing, click the refresh button below.
                            </p>
                        </div>
                    )}
                </div>

                {status?.error && (
                    <details className="text-sm text-zinc-500">
                        <summary className="cursor-pointer hover:text-zinc-400">View detailed error log</summary>
                        <pre className="mt-2 p-4 bg-black/40 rounded-lg overflow-x-auto border border-zinc-800 whitespace-pre-wrap">
                            {status.error}
                        </pre>
                    </details>
                )}
            </div>

            <div className="p-6 border-t border-zinc-800 bg-zinc-800/20 flex justify-end gap-3">
                <button 
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 rounded-xl bg-white text-black font-semibold hover:bg-zinc-200 transition-colors"
                >
                    Refresh
                </button>
            </div>
          </div>
        </div>
      );
  }

  return (
    <div className={`fixed inset-0 z-[100] transition-transform duration-[800ms] ease-[cubic-bezier(0.76,0,0.24,1)] ${slideUp ? '-translate-y-full' : 'translate-y-0'}`}>
      {content}
    </div>
  );
}
