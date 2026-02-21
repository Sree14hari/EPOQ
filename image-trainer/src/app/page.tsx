"use client";

import Image from "next/image";
import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import GPUStatus from "./components/GPUStatus";
import DependencyWizard from "./components/DependencyWizard";

// The UI supports desktop-specific features via Tauri (opening files with the
// host OS, reading binary files for previews). To keep this module safe for
// Next.js server-side rendering we avoid top-level imports of Tauri APIs and
// instead dynamically import them at runtime where needed. See `openPath`
// and `loadPreviewFromPath` below for the dynamic-load pattern.

// ─── Types ────────────────────────────────────────────────────────────────────

type TabularResult = {
  status: "success" | "error";
  message?: string;
  columns?: string[];
  data?: (string | number | null)[][];
  shape?: [number, number];
  dtypes?: Record<string, string>;
  missing?: Record<string, number>;
  loaded_path?: string;
  file_path?: string;
};

type Action = "load" | "drop_missing" | "fill_missing" | "label_encode" | "one_hot_encode";
type FillMethod = "mean" | "median" | "mode" | "zero";

// ─── GPU Modal ────────────────────────────────────────────────────────────────

function GpuModal({ output, onClose }: { output: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-700 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="text-green-400">⬡</span> GPU / Environment Info
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <pre className="whitespace-pre-wrap font-mono text-sm text-green-300 bg-black/40 rounded-lg p-4 max-h-72 overflow-y-auto">
          {output || "No output received."}
        </pre>
      </div>
    </div>
  );
}

// ─── Preview Table ─────────────────────────────────────────────────────────────

function PreviewTable({ result }: { result: TabularResult }) {
  if (result.status === "error") {
    return (
      <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-400 text-sm">
        <strong>Error:</strong> {result.message}
      </div>
    );
  }

  if (!result.columns || !result.data) return null;

  return (
    <div className="mt-4 space-y-4">
      {/* Meta info */}
      <div className="flex flex-wrap gap-3 text-xs">
        {result.shape && (
          <span className="rounded-full bg-blue-500/10 border border-blue-500/30 px-3 py-1 text-blue-300">
            Shape: {result.shape[0]} × {result.shape[1]}
          </span>
        )}
        {result.loaded_path && (
          <span className="rounded-full bg-zinc-700 px-3 py-1 text-zinc-300 truncate max-w-xs">
            {result.loaded_path.split(/[\\/]/).pop()}
          </span>
        )}
        {result.message && (
          <span className="rounded-full bg-green-500/10 border border-green-500/30 px-3 py-1 text-green-300">
            {result.message}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-700">
        <table className="min-w-full text-xs">
          <thead className="bg-zinc-800/80">
            <tr>
              {result.columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left font-semibold text-zinc-300 whitespace-nowrap border-b border-zinc-700"
                >
                  <div>{col}</div>
                  {result.dtypes && (
                    <div className="font-normal text-zinc-500">{result.dtypes[col]}</div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {result.data.map((row, ri) => (
              <tr key={ri} className="hover:bg-zinc-800/40 transition-colors">
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`px-3 py-2 whitespace-nowrap ${cell === null ? "text-zinc-600 italic" : "text-zinc-200"}`}
                  >
                    {cell === null ? "null" : String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Missing values summary */}
      {result.missing && Object.values(result.missing).some((v) => v > 0) && (
        <details className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <summary className="cursor-pointer text-xs text-amber-300 font-medium">
            Missing Values
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-1">
            {Object.entries(result.missing)
              .filter(([, v]) => v > 0)
              .map(([col, count]) => (
                <div key={col} className="flex justify-between text-xs text-zinc-400 px-1">
                  <span>{col}</span>
                  <span className="text-amber-400">{count}</span>
                </div>
              ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ─── Data Tab ──────────────────────────────────────────────────────────────────

function DataTab() {
  const [filePath, setFilePath] = useState("");
  const [action, setAction] = useState<Action>("load");
  const [fillMethod, setFillMethod] = useState<FillMethod>("mean");
  const [encodeColumns, setEncodeColumns] = useState("");
  const [outPath, setOutPath] = useState("");
  const [dropFirst, setDropFirst] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TabularResult | null>(null);

  const pickFile = useCallback(async () => {
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: "Data Files", extensions: ["csv", "xlsx", "xls"] }],
    });
    if (typeof selected === "string") setFilePath(selected);
  }, []);

  const runProcessor = useCallback(async () => {
    if (!filePath) return;
    setLoading(true);
    setResult(null);

    try {
      let paramsJson: string | undefined;
      const isProcess = action !== "load";

      if (isProcess) {
        const paramsObj: Record<string, unknown> = { operation: action };
        if (action === "fill_missing") paramsObj.method = fillMethod;
        if (action === "label_encode" || action === "one_hot_encode") {
          paramsObj.columns = encodeColumns
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }
        if (action === "one_hot_encode") paramsObj.drop_first = dropFirst;
        paramsJson = JSON.stringify(paramsObj);
      }

      const raw: string = await invoke("run_tabular_processor", {
        file: filePath,
        action: isProcess ? "process" : "load",
        params: paramsJson,
        out: outPath || undefined,
      });
      const parsed: TabularResult = JSON.parse(raw);
      setResult(parsed);
    } catch (err: unknown) {
      setResult({ status: "error", message: String(err) });
    } finally {
      setLoading(false);
    }
  }, [filePath, action, fillMethod, encodeColumns, outPath, dropFirst]);

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* File picker */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          Data File
        </label>
        <div className="flex gap-2">
          <input
            id="data-file-path"
            type="text"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            placeholder="Select or paste a CSV / Excel path…"
            className="flex-1 rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
          <button
            id="data-pick-file"
            onClick={pickFile}
            className="rounded-xl bg-zinc-700 hover:bg-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors whitespace-nowrap"
          >
            Browse
          </button>
        </div>
      </div>

      {/* Action */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          Operation
        </label>
        <select
          id="data-action"
          value={action}
          onChange={(e) => setAction(e.target.value as Action)}
          className="rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          <option value="load">Load &amp; Preview</option>
          <option value="drop_missing">Drop Missing Rows</option>
          <option value="fill_missing">Fill Missing Values</option>
          <option value="label_encode">Label Encode</option>
          <option value="one_hot_encode">One-Hot Encode</option>
        </select>
      </div>

      {/* Conditional options */}
      {action === "fill_missing" && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Fill Method
          </label>
          <select
            id="data-fill-method"
            value={fillMethod}
            onChange={(e) => setFillMethod(e.target.value as FillMethod)}
            className="rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="mean">Mean</option>
            <option value="median">Median</option>
            <option value="mode">Mode</option>
            <option value="zero">Zero</option>
          </select>
        </div>
      )}

      {(action === "label_encode" || action === "one_hot_encode") && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Columns (comma-separated)
          </label>
          <input
            id="data-encode-columns"
            type="text"
            value={encodeColumns}
            onChange={(e) => setEncodeColumns(e.target.value)}
            placeholder="e.g. category, color"
            className="rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>
      )}

      {action === "one_hot_encode" && (
        <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            checked={dropFirst}
            onChange={(e) => setDropFirst(e.target.checked)}
            className="accent-blue-500"
          />
          Drop first dummy column
        </label>
      )}

      {action !== "load" && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Save Output To (optional)
          </label>
          <input
            id="data-out-path"
            type="text"
            value={outPath}
            onChange={(e) => setOutPath(e.target.value)}
            placeholder="Leave blank to overwrite input file"
            className="rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>
      )}

      {/* Run */}
      <button
        id="data-run-btn"
        onClick={runProcessor}
        disabled={!filePath || loading}
        className="rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed px-6 py-3 text-sm font-semibold text-white transition-all flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Processing…
          </>
        ) : (
          "Run"
        )}
      </button>

      {/* Result */}
      {result && <PreviewTable result={result} />}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [activeTab, setActiveTab] = useState<"trainer" | "data">("trainer");
  const [gpuOutput, setGpuOutput] = useState<string | null>(null);
  const [gpuLoading, setGpuLoading] = useState(false);
  const [depsChecked, setDepsChecked] = useState(false);
  const [saveDir, setSaveDir] = useState<string>("");
  const [outputs, setOutputs] = useState<Record<string, string | null> | null>(null);
  const [outputsLoading, setOutputsLoading] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string | null>>({});

  const checkGpu = useCallback(async () => {
    setGpuLoading(true);
    try {
      const output: string = await invoke("run_check_gpu");
      setGpuOutput(output);
    } catch (err: unknown) {
      setGpuOutput(`Error: ${String(err)}`);
    } finally {
      setGpuLoading(false);
    }
  }, []);

  const fetchOutputs = useCallback(async () => {
    if (!saveDir) return;
    setOutputsLoading(true);
    setOutputs(null);
    try {
      const raw: string = await invoke("get_output_files", { save_dir: saveDir });
      const parsed = JSON.parse(raw) as Record<string, string | null>;
      setOutputs(parsed);
    } catch (err: unknown) {
      setOutputs({ error: String(err) });
    } finally {
      setOutputsLoading(false);
    }
  }, [saveDir]);

  const openPath = useCallback(async (p: string | null) => {
    if (!p) return;
    try {
      // Dynamic-load the Tauri shell API at call-time so the module does not
      // fail when imported on the server. This keeps the function testable in
      // browser-only and SSR environments while enabling the desktop behavior
      // when the app runs as a Tauri client. The shell.open call will use the
      // OS default handler to open the file (PDF, image, model file, etc.).
      const shell = await import("@tauri-apps/api/shell");
      await shell.open(p);
    } catch (e) {
      console.error("Failed to open path", e);
    }
  }, []);

  // Load image previews (confusion matrix / training curves) using Tauri fs.
  // Programmer notes:
  // - We dynamic-import the `@tauri-apps/api/fs` module at runtime to prevent
  //   server-side builds from attempting to resolve Tauri-native APIs.
  // - The function reads the binary file, creates an object URL and stores it
  //   in `previews` for use as an <img> src. Consumers should revoke object
  //   URLs when no longer needed (the effect cleanup below handles that).
  const loadPreviewFromPath = useCallback(async (key: string, p: string | null) => {
    if (!p) {
      setPreviews((s) => ({ ...s, [key]: null }));
      return;
    }
    try {
      const fp = p.startsWith("file://") ? p.replace("file://", "") : p;
      // dynamic import to avoid SSR/build-time errors
      const fs = await import("@tauri-apps/api/fs");
      const data = await fs.readBinaryFile(fp);
      const arr = new Uint8Array(data as Uint8Array);
      const lower = fp.toLowerCase();
      let mime = "application/octet-stream";
      if (lower.endsWith(".png")) mime = "image/png";
      else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) mime = "image/jpeg";

      const blob = new Blob([arr.buffer], { type: mime });
      const url = URL.createObjectURL(blob);
      setPreviews((s) => ({ ...s, [key]: url }));
    } catch (e) {
      console.warn("Preview load failed", e);
      setPreviews((s) => ({ ...s, [key]: null }));
    }
  }, []);

  // When outputs change, load previews for known image keys
  useEffect(() => {
    if (!outputs) return;
    const keys = ["confusion_matrix_png", "confusion_matrix_jpg", "training_curves_png", "training_curves_jpg"];
    keys.forEach((k) => {
      // @ts-ignore
      const p = outputs[k];
      // @ts-ignore
      loadPreviewFromPath(k, p ?? null);
    });

    return () => {
      Object.values(previews).forEach((u) => {
        if (u) URL.revokeObjectURL(u);
      });
      setPreviews({});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outputs]);

  return (
    <>
      {!depsChecked && <DependencyWizard onComplete={() => setDepsChecked(true)} />}
      <div className={`flex min-h-screen items-center justify-center bg-zinc-950 font-sans ${!depsChecked ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100 transition-opacity duration-1000'}`}>
        <main className="flex min-h-screen w-full max-w-3xl flex-col py-12 px-8">
        {/* ── Header ── */}
        <header className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <Image
              className="invert"
              src="/next.svg"
              alt="EPOQ logo"
              width={80}
              height={16}
              priority
            />
            <span className="text-zinc-500 text-sm font-medium">EPOQ</span>
          </div>

          <button
            id="gpu-check-btn"
            onClick={checkGpu}
            disabled={gpuLoading}
            className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors"
          >
            {gpuLoading ? (
              <span className="inline-block w-3.5 h-3.5 border-2 border-zinc-400/30 border-t-zinc-400 rounded-full animate-spin" />
            ) : (
              <span>⬡</span>
            )}
            Check GPU
          </button>
        </header>

        {/* ── Tabs ── */}
        <div className="flex gap-1 mb-8 rounded-xl bg-zinc-900 p-1 border border-zinc-800">
          {(["trainer", "data"] as const).map((tab) => (
            <button
              key={tab}
              id={`tab-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-zinc-700 text-white shadow"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab === "trainer" ? "Image Trainer" : "Data"}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        {activeTab === "trainer" && (
          <div className="flex flex-col items-start gap-6">
            <div>
              <h1 className="text-3xl font-semibold text-white tracking-tight">
                Image Trainer
              </h1>
              <p className="mt-2 text-zinc-400 leading-7">
                Train and evaluate deep learning models on image datasets.
                Configure your experiment, select a dataset, and start training
                directly from this interface.
              </p>
            </div>

            <GPUStatus/>

            {/* Report / Model download section */}
            <div className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <label className="block text-xs text-zinc-400 mb-2">Save directory (where training outputs are written)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={saveDir}
                  onChange={(e) => setSaveDir(e.target.value)}
                  placeholder="/path/to/save_dir"
                  className="flex-1 rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-2.5 text-sm text-zinc-200"
                />
                <button
                  onClick={fetchOutputs}
                  className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-sm font-medium text-white"
                  disabled={!saveDir || outputsLoading}
                >
                  {outputsLoading ? 'Loading…' : 'List Outputs'}
                </button>
              </div>

              {outputs && (
                <div className="mt-3 grid grid-cols-1 gap-3">
                  {Object.entries(outputs).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {/* thumbnail if available */}
                        {previews[k] ? (
                          <img src={previews[k] ?? undefined} alt={k} className="w-28 h-auto rounded-md border border-zinc-800" />
                        ) : (
                          <div className="w-28 h-20 rounded-md bg-zinc-800 flex items-center justify-center text-xs text-zinc-500">No preview</div>
                        )}
                        <div className="text-sm text-zinc-300 truncate">{k}</div>
                      </div>
                      {v ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => openPath(v)} className="rounded-md bg-zinc-700 px-3 py-1 text-xs text-white">Open</button>
                          <a href={`file://${v}`} className="rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-300" target="_blank" rel="noreferrer">Open (fallback)</a>
                        </div>
                      ) : (
                        <div className="text-xs text-zinc-500 italic">not found</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <a
                href="https://vercel.com/new"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-medium text-black transition-colors hover:bg-zinc-200"
              >
                <Image
                  className=""
                  src="/vercel.svg"
                  alt="Vercel"
                  width={14}
                  height={14}
                />
                Deploy
              </a>
              <a
                href="https://nextjs.org/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 items-center justify-center rounded-full border border-zinc-700 px-5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
              >
                Documentation
              </a>
            </div>
          </div>
        )}

        {activeTab === "data" && (
          <div className="flex flex-col gap-2">
            <div className="mb-2">
              <h1 className="text-2xl font-semibold text-white tracking-tight">
                Data Processor
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Load, clean, and encode CSV / Excel files using{" "}
                <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">
                  tabular_processor.py
                </code>
                .
              </p>
            </div>
            <DataTab />
          </div>
        )}
      </main>

      {/* ── GPU Modal ── */}
      {gpuOutput !== null && (
        <GpuModal output={gpuOutput} onClose={() => setGpuOutput(null)} />
      )}
      </div>
    </>
  );
}
