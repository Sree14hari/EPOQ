'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Command } from '@tauri-apps/plugin-shell';
import { open } from '@tauri-apps/plugin-dialog';
import { resolveResource } from '@tauri-apps/api/path';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FolderOpen, Play, Square, Save, Activity, Terminal, CheckCircle, AlertCircle, BarChart2, Layers, Download, Cpu, Sun, Moon, Database } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import DependencyWizard from './components/DependencyWizard';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LogEntry {
  type: 'info' | 'error' | 'success';
  message: string;
  timestamp: string;
}

interface TrainingStatus {
  epoch: number;
  total_epochs: number;
  accuracy: string;
  loss: string;
  status: string;
  learning_rate?: string;
}

interface Preset {
  name: string;
  epochs: number;
  batchSize: number;
  model: string;
  learningRate: number;
}

const PRESETS: Preset[] = [
  { name: 'Quick Test', epochs: 2, batchSize: 16, model: 'resnet18', learningRate: 0.001 },
  { name: 'Standard', epochs: 10, batchSize: 32, model: 'resnet18', learningRate: 0.001 },
  { name: 'High Performance', epochs: 20, batchSize: 64, model: 'resnet50', learningRate: 0.0001 },
  { name: 'Deep Learning', epochs: 30, batchSize: 32, model: 'eva02', learningRate: 0.0001 },
];

interface EvalResult {
  status: string;
  report: Record<string, unknown>;
  confusion_matrix_path: string;
  total_epochs: number;
  test_size: number;
}

type TabularResult = {
  status: 'success' | 'error';
  message?: string;
  columns?: string[];
  data?: (string | number | null)[][];
  shape?: [number, number];
  dtypes?: Record<string, string>;
  missing?: Record<string, number>;
  loaded_path?: string;
};
type TabAction = 'load' | 'drop_missing' | 'fill_missing' | 'label_encode' | 'one_hot_encode';
type FillMethod = 'mean' | 'median' | 'mode' | 'zero';

export default function Home() {
  const [datasetPath, setDatasetPath] = useState('');
  const [savePath, setSavePath] = useState('');
  const [epochs, setEpochs] = useState(5);
  const [batchSize, setBatchSize] = useState(32);
  const [numWorkers, setNumWorkers] = useState(-1);
  const [model, setModel] = useState('resnet18');
  const [learningRate, setLearningRate] = useState(0.001);
  const [zipDataset, setZipDataset] = useState(false);
  const [onlyZip, setOnlyZip] = useState(false);
  const [patience, setPatience] = useState(5);
  const [resumePath, setResumePath] = useState('');
  const [gpuAvailable, setGpuAvailable] = useState<boolean | null>(null);
  const [condaEnvs, setCondaEnvs] = useState<{name: string, isGpu: boolean | null}[]>([]);
  const [selectedEnv, setSelectedEnv] = useState<string>('system');
  const [scanningEnvs, setScanningEnvs] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showExperiments, setShowExperiments] = useState(false);
  const [isLightMode, setIsLightMode] = useState(true);
  const [recentExperiments, setRecentExperiments] = useState<{id: string; date: string; accuracy: string; model: string}[]>([]);
  const finalAccuracyRef = useRef<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [_pid, setPid] = useState<number | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [chartData, setChartData] = useState<Array<Record<string, unknown>>>([]);
  const [progress, setProgress] = useState(0);
  const [currentStatus, setCurrentStatus] = useState<TrainingStatus | null>(null);
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [matrixImageUrl, setMatrixImageUrl] = useState<string | null>(null);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [activeTab, setActiveTab] = useState<'logs' | 'charts' | 'results' | 'data' | 'system'>('logs');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  // Tabular / GPU state
  const [tabFile, setTabFile] = useState('');
  const [tabAction, setTabAction] = useState<TabAction>('load');
  const [fillMethod, setFillMethod] = useState<FillMethod>('mean');
  const [encodeColumns, setEncodeColumns] = useState('');
  const [tabOutPath, setTabOutPath] = useState('');
  const [tabLoading, setTabLoading] = useState(false);
  const [tabResult, setTabResult] = useState<TabularResult | null>(null);
  const [systemInfo, setSystemInfo] = useState<Record<string, unknown> | null>(null);
  const [systemLoading, setSystemLoading] = useState(false);
  const [systemError, setSystemError] = useState<string | null>(null);
  const [depsChecked, setDepsChecked] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const commandRef = useRef<Command<string> | null>(null);
  const childRef = useRef<any>(null);
  // Check GPU availability
  useEffect(() => {
    async function checkGpu() {
      setGpuAvailable(null);
      try {
        let cmdName: string;
        let args: string[];

        if (selectedEnv.startsWith('conda:')) {
          const envName = selectedEnv.replace('conda:', '');
          cmdName = 'conda';
          args = ['run', '-n', envName, 'python', '-c', 'import torch; print(torch.cuda.is_available())'];
        } else {
          cmdName = await resolvePythonInterpreter();
          args = ['-c', 'import torch; print(torch.cuda.is_available())'];
        }
        
        const cmd = Command.create(cmdName, args);
        const res = await cmd.execute();
        setGpuAvailable(res.code === 0 && res.stdout.trim() === 'True');
      } catch {
        setGpuAvailable(false);
      }
    }
    checkGpu();
  }, [selectedEnv]);

  const pickTabFile = useCallback(async () => {
    const selected = await open({ multiple: false, filters: [{ name: 'Data Files', extensions: ['csv', 'xlsx', 'xls'] }] });
    if (typeof selected === 'string') setTabFile(selected);
  }, []);

  const runTabular = useCallback(async () => {
    if (!tabFile) return;
    setTabLoading(true);
    setTabResult(null);
    try {
      const isProcess = tabAction !== 'load';
      let paramsJson: string | undefined;
      if (isProcess) {
        const p: Record<string, unknown> = { operation: tabAction };
        if (tabAction === 'fill_missing') p.method = fillMethod;
        if (tabAction === 'label_encode' || tabAction === 'one_hot_encode')
          p.columns = encodeColumns.split(',').map(s => s.trim()).filter(Boolean);
        paramsJson = JSON.stringify(p);
      }
      const raw: string = await invoke('run_tabular_processor', {
        file: tabFile, action: isProcess ? 'process' : 'load',
        params: paramsJson, out: tabOutPath || undefined,
      });
      setTabResult(JSON.parse(raw));
    } catch (err) {
      setTabResult({ status: 'error', message: String(err) });
    } finally {
      setTabLoading(false);
    }
  }, [tabFile, tabAction, fillMethod, encodeColumns, tabOutPath]);

  const scanCondaEnvs = async () => {
    setScanningEnvs(true);
    addLog('Scanning Conda environments...', 'info');
    try {
      const cmd = Command.create('conda', ['env', 'list', '--json']);
      const output = await cmd.execute();
      if (output.code === 0) {
        const data = JSON.parse(output.stdout);
        const envs = data.envs as string[];
        const detected = [];
        for (const envPath of envs) {
           const name = envPath === envs[0] ? 'base' : envPath.split(/[\\/]/).pop() || 'unknown';
           detected.push({ name, isGpu: null });
        }
        setCondaEnvs(detected);
        addLog(`Found ${detected.length} Conda environments. Testing for PyTorch GPU...`, 'info');
        
        const tested = [];
        for (const env of detected) {
           try {
             const testCmd = Command.create('conda', ['run', '-n', env.name, 'python', '-c', 'import torch; print(torch.cuda.is_available())']);
             const res = await testCmd.execute();
             const isGpu = res.stdout.trim() === 'True';
             tested.push({ ...env, isGpu });
             addLog(`Env '${env.name}' - PyTorch GPU: ${isGpu}`, isGpu ? 'success' : 'info');
           } catch {
             tested.push({ ...env, isGpu: false });
           }
        }
        setCondaEnvs(tested);
        
        const gpuEnv = tested.find(e => e.isGpu);
        if (gpuEnv && !gpuAvailable) {
          setSelectedEnv(`conda:${gpuEnv.name}`);
          addLog(`Auto-selected GPU environment: ${gpuEnv.name}`, 'success');
        }
      } else {
         addLog('Conda not found or failed to list envs.', 'error');
      }
    } catch (e) {
       addLog(`Failed to scan Conda envs: ${e}`, 'error');
    }
    setScanningEnvs(false);
  };
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'Enter' && !isRunning && datasetPath) {
          startTraining();
        } else if (e.key === 'p') {
          e.preventDefault();
          setShowPresets(!showPresets);
          setShowExperiments(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRunning, datasetPath, showPresets, showExperiments]);

  const applyPreset = (preset: Preset) => {
    setEpochs(preset.epochs);
    setBatchSize(preset.batchSize);
    setModel(preset.model);
    setLearningRate(preset.learningRate);
    setShowPresets(false);
    addLog(`Applied preset: ${preset.name}`, 'info');
  }; // To store child handle for killing

  useEffect(() => {
    if (activeTab === 'logs') {
      // Use block: 'nearest' to prevent the entire browser window from scrolling
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [logs, activeTab]);
 
useEffect(() => {
  if (activeTab !== "system") return;

  // First load → show spinner
  fetchSystemInfo(true);

  const interval = setInterval(() => {
    fetchSystemInfo(false); // silent refresh
  }, 3000);

  return () => clearInterval(interval);

}, [activeTab]);

  useEffect(() => {
    async function loadMatrixImage() {
      if (evalResult?.confusion_matrix_path) {
        try {
          const { readFile } = await import('@tauri-apps/plugin-fs');
          const fileContents = await readFile(evalResult.confusion_matrix_path);
          const blob = new Blob([fileContents], { type: 'image/png' });
          const url = URL.createObjectURL(blob);
          
          setMatrixImageUrl(url);
          setImageLoadError(false);
          addLog(`Loaded confusion matrix via Blob URL: ${url}`, 'info');
        } catch (err) {
          addLog(`Failed to load matrix image file: ${err}`, 'error');
           try {
             // Fallback
             const normalizedPath = evalResult.confusion_matrix_path.replace(/\\/g, '/');
             const assetUrl = convertFileSrc(normalizedPath);
             setMatrixImageUrl(assetUrl);
             addLog(`Attempting fallback to asset URL: ${assetUrl}`, 'info');
           } catch (e) {
             console.error(e);
           }
        }
      }
    }
    loadMatrixImage();
  }, [evalResult]);
  useEffect(() => {
  let interval: NodeJS.Timeout;

  if (isRunning) {
    interval = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
  }

  return () => {
    if (interval) clearInterval(interval);
  };
}, [isRunning]);

  const addLog = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [...prev, { type, message, timestamp }]);
  };

  const handlePickDataset = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Dataset Directory'
      });
      if (selected && typeof selected === 'string') {
        setDatasetPath(selected);
        if (!savePath) setSavePath(selected);
      }
    } catch (err) {
      console.error(err);
      addLog(`Failed to open dialog: ${err}`, 'error');
    }
  };

  const handlePickSavePath = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Save Directory'
      });
      if (selected && typeof selected === 'string') {
        setSavePath(selected);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePickResumePath = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'PyTorch Checkpoint', extensions: ['pth'] }],
        title: 'Select Checkpoint File to Resume From'
      });
      if (selected && typeof selected === 'string') {
        setResumePath(selected);
      }
    } catch (err) {
      console.error(err);
    }
  };
  async function resolvePythonInterpreter(): Promise<string> {
  const candidates = ['python', 'python3', 'py'];

  for (const cmd of candidates) {
    try {
      await Command.create(cmd, ['--version']).execute();
      return cmd;
    } catch {}
  }

  throw new Error('No Python interpreter found.');
}
  const startTraining = async () => {
    setElapsedSeconds(0);
  let experimentId = '';

  if (!datasetPath) {
    addLog('Please select a dataset path first.', 'error');
    return;
  }

  setIsRunning(true);
  setLogs([]);
  setChartData([]);
  setEvalResult(null);
  setProgress(0);
  setActiveTab('logs');
  setShowPresets(false);
  setShowExperiments(false);
  finalAccuracyRef.current = null;

  try {

    const scriptPath = await resolveResource('python_backend/script.py');
    if (!scriptPath) {
      throw new Error('Failed to resolve backend script path.');
    }

    addLog(`Resolved script path: ${scriptPath}`, 'info');

    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
    experimentId = `exp_${timestamp}`;

    addLog(`Experiment ID: ${experimentId}`, 'info');

      const args = [
        scriptPath,
        '--path', datasetPath,
        '--epochs', epochs.toString(),
        '--batch_size', batchSize.toString(),
        '--model', model,
        '--learning_rate', learningRate.toString()
      ];
      args.push('--experiment_id', experimentId);
      if (savePath) args.push('--save_path', savePath);
      args.push('--num_workers', numWorkers.toString());
      if (zipDataset) args.push('--zip_dataset');
      if (onlyZip) args.push('--only_zip');
      args.push('--patience', patience.toString());
      if (resumePath) args.push('--resume', resumePath);

      let finalCmd: string;
      let finalArgs = args;

      if (selectedEnv.startsWith('conda:')) {
        const envName = selectedEnv.replace('conda:', '');
        finalCmd = 'conda';
        finalArgs = ['run', '-n', envName, '--no-capture-output', 'python', ...args];
      } else {
        finalCmd = await resolvePythonInterpreter();
      }

      addLog(`Starting command: ${finalCmd} ${finalArgs.join(' ')}`, 'info');

      const cmd = Command.create(finalCmd, finalArgs);
      commandRef.current = cmd;

      cmd.on('close', (data) => {
        addLog(`Process finished with code ${data.code}`, data.code === 0 ? 'success' : 'error');
        setIsRunning(false);
        setPid(null);
        if (data.code === 0) {
            addLog('Training/Task Complete successfully.', 'success');
            // Save to recent experiments
            // const expId = `exp_${Date.now()}`;
            setRecentExperiments(prev => [
              { id: experimentId, date: new Date().toLocaleDateString(), accuracy: finalAccuracyRef.current || 'N/A', model },
              ...prev.slice(0, 4)
            ]);
        }
      });

      cmd.on('error', (error) => {
        addLog(`Command error: ${error}`, 'error');
        setIsRunning(false);
      });

      cmd.stdout.on('data', (line) => {
        try {
          const data = JSON.parse(line);
          
          if (data.status === 'training') {
          setCurrentStatus(data);
          setChartData(prev => [
            ...prev,
            {
              epoch: data.epoch,
              accuracy: parseFloat(data.accuracy),
              loss: parseFloat(data.loss),
            }
          ]);
          finalAccuracyRef.current = data.accuracy;
            const prog = (data.epoch / data.total_epochs) * 100;
            setProgress(prog);
            if (activeTab === 'logs' && data.epoch === 1) setActiveTab('charts');
          } 
          else if (data.status === 'checkpoint') {
            addLog(`Checkpoint saved: ${data.message} at ${data.path}`, 'success');
          }
          else if (data.status === 'evaluation_complete') {
            setEvalResult(data);
            setActiveTab('results');
            addLog('Evaluation complete. Results available.', 'success');
          }
           else if (data.status === 'dataset_zip') {
             addLog(`Dataset zipped at: ${data.path}`, 'success');
           }
          else if (data.status === 'stopped_early') {
            addLog(`⏹ Early stopping triggered at epoch ${data.epoch}: ${data.message}`, 'success');
            setProgress(100);
          }
          else if (data.status === 'resumed') {
            addLog(`▶ Resumed from epoch ${data.message.replace('Resumed from epoch ', '')} (best acc so far: ${data.best_acc})`, 'info');
          }
          else if (data.status === 'error') {
            addLog(`Error from script: ${data.message}`, 'error');
          }
          else {
             addLog(line, 'info');
          }
        } catch (e) {
          addLog(line, 'info');
        }
      });

      cmd.stderr.on('data', (line) => {
        addLog(line, 'error');
      });

      const child = await cmd.spawn();
    childRef.current = child;
    setPid(child.pid);
    addLog(`Process started with PID: ${child.pid}`, 'info');

  } catch (err) {
    addLog(`Failed to spawn process: ${err}`, 'error');
    setIsRunning(false);
  }
};
const formatTime = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return [
    hrs > 0 ? String(hrs).padStart(2, '0') : null,
    String(mins).padStart(2, '0'),
    String(secs).padStart(2, '0')
  ].filter(Boolean).join(':');
};
const exportAsJson = async () => {
  try {
    console.log("Export triggered");

    if (!chartData.length) {
      addLog("No training data to export.", "error");
      return;
    }

    const payload = {
      metadata: {
        exported_at: new Date().toISOString(),
        dataset_path: datasetPath,
        model,
        epochs,
        batch_size: batchSize,
        learning_rate: learningRate,
        num_workers: numWorkers,
        environment: selectedEnv,
        elapsed_seconds: elapsedSeconds
      },
      training_metrics: chartData,
      final_status: currentStatus,
      evaluation: evalResult,
      logs
    };

    const filePath = await save({
      filters: [{ name: "JSON", extensions: ["json"] }]
    });

    if (!filePath) {
      addLog("Export cancelled.", "info");
      return;
    }

    console.log("Saving to:", filePath);

    await writeTextFile(filePath, JSON.stringify(payload, null, 2));

    addLog("Experiment exported successfully.", "success");

  } catch (err) {
    console.error("EXPORT ERROR:", err);
    addLog(`Export failed: ${err}`, "error");
  }
};
const fetchSystemInfo = async (initial = false) => {
  try {
    if (initial) setSystemLoading(true);

    const raw = await invoke("get_system_info");
    const parsed = JSON.parse(raw as string);

    setSystemInfo(parsed);
    setSystemError(null);
  } catch (err) {
    setSystemError("Failed to load system information");
  } finally {
    if (initial) setSystemLoading(false);
  }
};

  return (
    <>
      {!depsChecked && <DependencyWizard onComplete={() => setDepsChecked(true)} />}
      <div data-theme={isLightMode ? 'light' : 'dark'} className={`min-h-screen font-sans bg-black text-zinc-100 theme-transition ${!depsChecked ? 'h-screen overflow-hidden' : ''}`}>
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between bg-black/80 backdrop-blur-md border-b border-zinc-800/50 px-8 py-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-zinc-900 rounded-full border border-zinc-800 overflow-hidden shrink-0">
             {/* eslint-disable-next-line @next/next/no-img-element */}
             <img src="/epoq2.png" alt="EPOQ Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              EPOQ
            </h1>
            <p className="text-sm text-zinc-500 font-mono">v0.1.0-beta</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* GPU Status Indicator */}
          <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900/50 border border-zinc-800 rounded-full">
            <Cpu className={`w-4 h-4 ${gpuAvailable ? 'text-emerald-400' : 'text-zinc-500'}`} />
            <span className="text-xs font-medium">
              {gpuAvailable === null ? 'Checking...' : gpuAvailable ? 'GPU Available' : 'CPU Only'}
            </span>
          </div>
          {/* Recent Experiments Button */}
          <div className="relative">
            <button 
              onClick={() => {
                setShowExperiments(!showExperiments);
                setShowPresets(false);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-full text-sm text-zinc-300 transition-colors"
            >
              <Activity className="w-4 h-4" /> Recent
            </button>
            {showExperiments && (
              <div className="absolute right-0 mt-2 w-72 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden">
                {recentExperiments.length > 0 ? (
                  <div className="max-h-64 overflow-y-auto">
                    {recentExperiments.map((exp) => (
                      <div key={exp.id} className="p-3 border-b last:border-b-0 border-zinc-800/50 hover:bg-zinc-800 transition-colors">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="text-sm text-zinc-300 font-medium">{exp.model}</div>
                            <div className="text-xs text-zinc-500">{exp.date}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-mono text-emerald-400">{exp.accuracy !== 'N/A' ? `${(parseFloat(exp.accuracy)*100).toFixed(2)}%` : exp.accuracy}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-sm text-zinc-500">No recent experiments</div>
                )}
              </div>
            )}
          </div>

          {/* Presets Button */}
          <div className="relative">
            <button 
              onClick={() => {
                setShowPresets(!showPresets);
                setShowExperiments(false);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-full text-sm text-zinc-300 transition-colors"
            >
              <Layers className="w-4 h-4" /> Presets
            </button>
            {showPresets && (
              <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden">
                {PRESETS.map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => applyPreset(preset)}
                    className="w-full px-4 py-3 text-left text-sm text-zinc-300 hover:bg-zinc-800 transition-colors flex justify-between items-center"
                  >
                    <span>{preset.name}</span>
                    <span className="text-xs text-zinc-500 font-mono">{preset.epochs}ep/{preset.batchSize}bs</span>
                  </button>
                ))}
              </div>
            )}
          </div>

            {/* Theme Toggle */}
            <button
              onClick={() => setIsLightMode(!isLightMode)}
              className="flex items-center justify-center w-[38px] h-[38px] bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors ml-2"
              aria-label="Toggle theme"
            >
              {isLightMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

          {/* Keyboard Shortcut Hint */}
          <span className="text-xs text-zinc-600 hidden lg:inline ml-2">Ctrl+Enter to start</span>
           
           {isRunning ? (
             <button 
               onClick={() => {
                   childRef.current?.kill();
                   addLog('Process killed by user.', 'error');
                   setIsRunning(false);
               }}
               className="flex items-center gap-2 px-6 py-2.5 bg-red-900/20 hover:bg-red-900/30 text-red-200 border border-red-900/30 rounded-full transition-all text-sm font-medium"
             >
               <Square className="w-4 h-4 fill-current" /> Stop Process
             </button>
           ) : (
             <button 
               onClick={startTraining}
               className="flex items-center gap-2 px-6 py-2.5 bg-white text-black hover:bg-zinc-200 rounded-full transition-all text-sm font-medium shadow-lg shadow-white/5"
             >
               <Play className="w-4 h-4 fill-current" /> Start Training
             </button>
           )}
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-8 pb-8">
        {/* Left Panel: Configuration */}
        <section className="lg:col-span-4 space-y-8">
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6">
              <Layers className="w-5 h-5 text-zinc-400" />
              <h2 className="text-lg font-semibold tracking-tight">Configuration</h2>
            </div>

            <div className="space-y-6">
              {/* Environment Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                   <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Python Environment</label>
                   <button 
                     onClick={scanCondaEnvs}
                     disabled={scanningEnvs}
                     className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
                   >
                     {scanningEnvs ? 'Scanning...' : 'Detect Conda GPU Env'}
                   </button>
                </div>
                <div className="relative">
                  <select 
                    value={selectedEnv}
                    onChange={(e) => setSelectedEnv(e.target.value)}
                    className="w-full appearance-none bg-black border border-zinc-800 rounded-lg py-2.5 px-3 text-sm text-zinc-300 focus:border-zinc-600 focus:outline-none transition-colors"
                  >
                    <option value="system">System Default (python)</option>
                    {condaEnvs.map((env) => (
                      <option key={env.name} value={`conda:${env.name}`}>
                        Conda: {env.name} {env.isGpu ? '(GPU Available)' : '(CPU Only)'}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>

              {/* Dataset Path */}
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Dataset Location</label>
                <div className="flex gap-2">
                  <div className="relative flex-1 group">
                    <input 
                      type="text" 
                      value={datasetPath}
                      readOnly
                      placeholder="No directory selected"
                      className="w-full bg-black border border-zinc-800 rounded-lg py-2.5 px-3 text-sm text-zinc-300 focus:border-zinc-600 focus:outline-none transition-colors font-mono"
                    />
                  </div>
                  <button 
                     onClick={handlePickDataset}
                     className="p-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                  >
                    <FolderOpen className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Model Selection */}
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Model Architecture</label>
                <div className="relative">
                  <select 
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full appearance-none bg-black border border-zinc-800 rounded-lg py-2.5 px-3 text-sm text-zinc-300 focus:border-zinc-600 focus:outline-none transition-colors"
                  >
                    <option value="resnet18">ResNet-18 (Standard)</option>
                    <option value="resnet50">ResNet-50 (Deep)</option>
                    <option value="efficientnet_b0">EfficientNet-B0 (Efficient)</option>
                    <option value="dcn">DeepCrossNetwork (DCN)</option>
                    <option value="eva02">EVA-02 (Transformer)</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>

              {/* Parameters Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Epochs</label>
                  <input 
                    type="number" 
                    value={epochs}
                    onChange={(e) => setEpochs(parseInt(e.target.value) || 1)}
                    className="w-full bg-black border border-zinc-800 rounded-lg py-2.5 px-3 text-sm text-zinc-300 focus:border-zinc-600 focus:outline-none transition-colors font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Batch Size</label>
                  <input 
                    type="number" 
                    value={batchSize}
                    onChange={(e) => setBatchSize(parseInt(e.target.value) || 1)}
                    className="w-full bg-black border border-zinc-800 rounded-lg py-2.5 px-3 text-sm text-zinc-300 focus:border-zinc-600 focus:outline-none transition-colors font-mono"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold flex items-center justify-between">
                    <span>DataLoader Workers</span>
                    <span className="text-zinc-600 normal-case font-normal">{numWorkers === -1 ? 'auto-detect' : numWorkers === 0 ? 'disabled (sync)' : `${numWorkers} workers`}</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={-1}
                      max={8}
                      step={1}
                      value={numWorkers}
                      onChange={(e) => setNumWorkers(parseInt(e.target.value))}
                      className="flex-1 accent-white h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer"
                    />
                    <input
                      type="number"
                      min={-1}
                      max={16}
                      value={numWorkers}
                      onChange={(e) => setNumWorkers(parseInt(e.target.value))}
                      className="w-16 bg-black border border-zinc-800 rounded-lg py-2.5 px-3 text-sm text-zinc-300 focus:border-zinc-600 focus:outline-none transition-colors font-mono text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Learning Rate */}
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Learning Rate</label>
                <input 
                  type="number" 
                  step="0.0001"
                  min="0.00001"
                  value={learningRate}
                  onChange={(e) => setLearningRate(parseFloat(e.target.value) || 0.001)}
                  className="w-full bg-black border border-zinc-800 rounded-lg py-2.5 px-3 text-sm text-zinc-300 focus:border-zinc-600 focus:outline-none transition-colors font-mono"
                />
                <div className="flex gap-2 mt-2">
                  {[0.01, 0.001, 0.0001, 0.00001].map((lr) => (
                    <button
                      key={lr}
                      onClick={() => setLearningRate(lr)}
                      className={`text-xs px-2 py-1 rounded border transition-colors ${
                        learningRate === lr 
                          ? 'bg-white text-black border-white' 
                          : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-zinc-500'
                      }`}
                    >
                      {lr}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save Path */}
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Checkpoints Output</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={savePath}
                    readOnly
                    placeholder="Defaults to dataset dir..."
                    className="w-full bg-black border border-zinc-800 rounded-lg py-2.5 px-3 text-sm text-zinc-300 focus:border-zinc-600 focus:outline-none transition-colors font-mono"
                  />
                  <button 
                     onClick={handlePickSavePath}
                     className="p-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                  >
                    <Save className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Early Stopping & Resume */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold flex items-center justify-between">
                    <span>Early-Stop Patience</span>
                    <span className="text-zinc-600 normal-case font-normal">{patience} ep</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={patience}
                    onChange={(e) => setPatience(parseInt(e.target.value) || 1)}
                    className="w-full bg-black border border-zinc-800 rounded-lg py-2.5 px-3 text-sm text-zinc-300 focus:border-zinc-600 focus:outline-none transition-colors font-mono"
                  />
                </div>
                <div className="space-y-2 flex flex-col justify-end">
                  <span className="text-xs text-zinc-600">Stops if val loss doesn't improve</span>
                </div>
              </div>

              {/* Resume Checkpoint */}
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Resume from Checkpoint</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={resumePath}
                    readOnly
                    placeholder="Optional: select a .pth checkpoint..."
                    className="w-full bg-black border border-zinc-800 rounded-lg py-2.5 px-3 text-sm text-zinc-300 focus:border-zinc-600 focus:outline-none transition-colors font-mono"
                  />
                  <button
                    onClick={handlePickResumePath}
                    title="Pick checkpoint file"
                    className="p-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                  >
                    <FolderOpen className="w-5 h-5" />
                  </button>
                  {resumePath && (
                    <button
                      onClick={() => setResumePath('')}
                      title="Clear"
                      className="p-2.5 bg-zinc-900 hover:bg-red-900/30 border border-zinc-800 rounded-lg text-zinc-500 hover:text-red-400 transition-colors text-xs font-mono"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Toggles */}
              <div className="pt-6 border-t border-zinc-800/50 space-y-4">
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors">Generate Dataset Archive</span>
                  <div className={cn("w-10 h-6 rounded-full border flex items-center px-1 transition-all", zipDataset ? "bg-white border-white justify-end" : "bg-zinc-900 border-zinc-700 justify-start")}>
                    <input type="checkbox" className="hidden" checked={zipDataset} onChange={e => setZipDataset(e.target.checked)} />
                    <div className={cn("w-3.5 h-3.5 rounded-full transition-colors", zipDataset ? "bg-black" : "bg-zinc-500")} />
                  </div>
                </label>

                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors">Archive Only Mode</span>
                  <div className={cn("w-10 h-6 rounded-full border flex items-center px-1 transition-all", onlyZip ? "bg-white border-white justify-end" : "bg-zinc-900 border-zinc-700 justify-start")}>
                    <input type="checkbox" className="hidden" checked={onlyZip} onChange={e => setOnlyZip(e.target.checked)} />
                    <div className={cn("w-3.5 h-3.5 rounded-full transition-colors", onlyZip ? "bg-black" : "bg-zinc-500")} />
                  </div>
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* Right Panel: Output */}
        <section className="lg:col-span-8 flex flex-col gap-6">
            
           {/* Progress Widget */}
           {(isRunning || progress > 0) && (
             <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-6 backdrop-blur-sm">
                <div className="flex justify-between items-end mb-4">
                    <div>
                        <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-widest">Training Progress</h3>
                        <p className="text-2xl font-light text-white mt-1">
                           {isRunning ? `Epoch ${currentStatus?.epoch || 0} / ${currentStatus?.total_epochs || epochs}` : "Complete"}
                        </p>
                        <p className="text-xs text-zinc-500 mt-2 font-mono">
                          Elapsed: {formatTime(elapsedSeconds)}
                        </p>
                        {currentStatus?.learning_rate && (
                          <p className="text-xs text-zinc-500 mt-1">Learning Rate: {currentStatus.learning_rate}</p>
                        )}
                    </div>
                    <div className="text-right flex flex-col items-end">
   <div className="text-3xl font-bold font-mono text-white tracking-tighter">
     {currentStatus?.accuracy ? `${(parseFloat(currentStatus.accuracy)*100).toFixed(2)}%` : "0.00%"}
   </div>
   <div className="text-xs text-zinc-500 uppercase tracking-wider mt-1">
     Accuracy
   </div>

   {!isRunning && chartData.length > 0 && (
     <button
       onClick={exportAsJson}
       className="mt-3 flex items-center gap-2 px-4 py-2 bg-white text-black hover:bg-zinc-200 text-xs font-semibold rounded-full transition-all shadow"
     >
       <Download className="w-3 h-3" />
       Export JSON
     </button>
   )}</div> 
                </div>
                <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-white transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
                </div>
             </div>
           )}

           {/* Content Tabs */}
           <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl flex-1 flex flex-col overflow-hidden min-h-[500px] max-h-[80vh] h-[75vh] backdrop-blur-sm">
              <div className="flex border-b border-zinc-800/50 px-2 flex-none">
                 <button 
                   onClick={() => setActiveTab('logs')}
                   className={cn("px-6 py-4 text-sm font-medium border-b-2 transition-all flex items-center gap-2", activeTab === 'logs' ? "border-white text-white" : "border-transparent text-zinc-500 hover:text-zinc-300")}
                 >
                   <Terminal className="w-4 h-4" /> Logs
                 </button>
                 <button 
                   onClick={() => setActiveTab('charts')}
                   className={cn("px-6 py-4 text-sm font-medium border-b-2 transition-all flex items-center gap-2", activeTab === 'charts' ? "border-white text-white" : "border-transparent text-zinc-500 hover:text-zinc-300")}
                 >
                   <BarChart2 className="w-4 h-4" /> Metrics
                 </button>
                 <button 
                   onClick={() => setActiveTab('results')}
                   className={cn("px-6 py-4 text-sm font-medium border-b-2 transition-all flex items-center gap-2", activeTab === 'results' ? "border-white text-white" : "border-transparent text-zinc-500 hover:text-zinc-300")}
                 >
                   <CheckCircle className="w-4 h-4" /> Results
                 </button>
                 <button id="tab-data"
                   onClick={() => setActiveTab('data')}
                   className={cn("px-6 py-4 text-sm font-medium border-b-2 transition-all flex items-center gap-2", activeTab === 'data' ? "border-white text-white" : "border-transparent text-zinc-500 hover:text-zinc-300")}
                 >
                   <Database className="w-4 h-4" /> Data
                 </button>
                 <button 
                onClick={() => setActiveTab('system')}
                className={cn(
                  "px-6 py-4 text-sm font-medium border-b-2 transition-all flex items-center gap-2",
                  activeTab === 'system'
                    ? "border-white text-white"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                )}
              >
                <Cpu className="w-4 h-4" /> System
              </button>
              </div>

              <div className="flex-1 overflow-y-auto bg-black/50 scrollbar-thin">
                 {activeTab === 'logs' && (
                   <div className="p-6 font-mono text-xs space-y-1.5 h-full">
                      {logs.length === 0 && <div className="text-zinc-600 italic text-center mt-20">Waiting for process logs...</div>}
                      {logs.map((log, i) => (
                        <div key={i} className="flex gap-3 text-zinc-300 border-l-2 border-transparent hover:bg-zinc-900/50 pl-2 -ml-2 py-0.5 rounded transition-colors group">
                           <span className="text-zinc-600 select-none w-20 shrink-0 group-hover:text-zinc-500 transition-colors">{log.timestamp}</span>
                           <span className={cn(
                             "break-all",
                             log.type === 'error' ? 'text-red-400' : 
                             log.type === 'success' ? 'text-emerald-400' : 'text-zinc-300'
                           )}>
                             {log.type === 'error' && <span className="mr-2 text-red-500 font-bold">ERR</span>}
                             {log.message}
                           </span>
                        </div>
                      ))}
                      <div ref={logsEndRef} />
                   </div>
                 )}

                 {activeTab === 'charts' && (
                    <div className="p-8 h-full flex flex-col gap-10">
                       {chartData.length > 0 ? (
                         <>
                           <div className="h-[250px] w-full">
                              <div className="flex justify-between mb-4">
                                <h4 className="text-sm font-medium text-zinc-400 uppercase tracking-widest">Model Accuracy</h4>
                                <span className="text-xs text-zinc-600 font-mono">HIGHEST: {Math.max(...chartData.map(d => d.accuracy)).toFixed(4)}</span>
                              </div>
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke={isLightMode ? '#e4e4e7' : '#52525b'} vertical={false} />
                                  <XAxis dataKey="epoch" stroke={isLightMode ? '#52525b' : '#a1a1aa'} tick={{fontSize: 12}} tickLine={false} axisLine={false} dy={10} />
                                  <YAxis stroke={isLightMode ? '#52525b' : '#a1a1aa'} tick={{fontSize: 12}} tickLine={false} axisLine={false} dx={-10} domain={[0, 1]} />
                                  <Tooltip 
                                    contentStyle={{ backgroundColor: isLightMode ? '#fff' : '#09090b', borderColor: isLightMode ? '#e4e4e7' : '#27272a', borderRadius: '8px', color: isLightMode ? '#000' : '#fff' }} 
                                    itemStyle={{ color: isLightMode ? '#000' : '#fff' }}
                                  />
                                  <Line type="monotone" dataKey="accuracy" stroke={isLightMode ? '#000' : '#fff'} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: isLightMode ? '#000' : '#fff' }} />
                                </LineChart>
                              </ResponsiveContainer>
                           </div>
                           <div className="h-[250px] w-full">
                              <div className="flex justify-between mb-4">
                                <h4 className="text-sm font-medium text-zinc-400 uppercase tracking-widest">Loss Function</h4>
                                <span className="text-xs text-zinc-600 font-mono">LOWEST: {Math.min(...chartData.map(d => d.loss)).toFixed(4)}</span>
                              </div>
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke={isLightMode ? '#e4e4e7' : '#52525b'} vertical={false} />
                                  <XAxis dataKey="epoch" stroke={isLightMode ? '#52525b' : '#a1a1aa'} tick={{fontSize: 12}} tickLine={false} axisLine={false} dy={10} />
                                  <YAxis stroke={isLightMode ? '#52525b' : '#a1a1aa'} tick={{fontSize: 12}} tickLine={false} axisLine={false} dx={-10} />
                                  <Tooltip 
                                    contentStyle={{ backgroundColor: isLightMode ? '#fff' : '#09090b', borderColor: isLightMode ? '#e4e4e7' : '#27272a', borderRadius: '8px', color: isLightMode ? '#000' : '#fff' }} 
                                    itemStyle={{ color: isLightMode ? '#000' : '#fff' }}
                                  />
                                  <Line type="monotone" dataKey="loss" stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#ef4444' }} />
                                </LineChart>
                              </ResponsiveContainer>
                           </div>
                         </>
                       ) : (
                         <div className="h-full flex flex-col items-center justify-center text-zinc-600">
                            <BarChart2 className="w-16 h-16 mb-4 opacity-10" />
                            <p className="font-light">Awaiting training metrics...</p>
                         </div>
                       )}
                    </div>
                 )}

                 {activeTab === 'results' && (
                    <div className="p-8">
                       {evalResult ? (
                         <div className="space-y-10">
                            {/* Summary Stats */}
                            <div>
                              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-widest mb-6">Performance Summary</h3>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                 {/* Stat Cards */}
                                 {[
                                   { label: "Total Epochs", value: evalResult.total_epochs },
                                   { label: "Test Set Size", value: evalResult.test_size },
                                   { label: "Precision (Avg)", value: evalResult.report['weighted avg']?.precision.toFixed(4) ?? 'N/A', color: 'text-zinc-100' },
                                   { label: "Recall (Avg)", value: evalResult.report['weighted avg']?.recall.toFixed(4) ?? 'N/A', color: 'text-zinc-100' },
                                 ].map((stat, i) => (
                                   <div key={i} className="p-5 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                                      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">{stat.label}</div>
                                      <div className={cn("text-2xl font-bold font-mono", stat.color || "text-white")}>{stat.value}</div>
                                   </div>
                                 ))}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                              {/* Left: CM */}
                              <div>
                                 <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-widest mb-6">Confusion Matrix</h3>
                                 {evalResult && evalResult.confusion_matrix_path && (
                                    <div className="rounded-xl border border-zinc-800 bg-black p-4">
                                       {matrixImageUrl && !imageLoadError ? (
                                         <div className="bg-white/5 rounded-lg overflow-hidden border border-white/5 mb-4">
                                            <img 
                                              src={matrixImageUrl} 
                                              alt="Confusion Matrix" 
                                              className="w-full h-auto object-contain mix-blend-screen" // Blend helpful for black bg if image has black bg
                                              onError={(e) => {
                                                 console.error('Failed to load confusion matrix:', evalResult.confusion_matrix_path);
                                                 setImageLoadError(true);
                                              }}
                                            />
                                         </div>
                                       ) : imageLoadError ? (
                                         <div className="flex flex-col items-center justify-center p-12 bg-zinc-900 rounded-lg border border-zinc-800 text-zinc-500 mb-4">
                                            <AlertCircle className="w-8 h-8 mb-3 opacity-50" />
                                            <p className="text-sm">Image load failed</p>
                                         </div>
                                       ) : null}
                                       
                                       <div className="flex items-center justify-between gap-4">
                                          <p className="text-xs text-zinc-600 font-mono truncate flex-1" title={evalResult.confusion_matrix_path}>
                                            {evalResult.confusion_matrix_path.split(/[\\/]/).pop()}
                                          </p>
                                          <button
                                            onClick={() => {
                                              if (matrixImageUrl) {
                                                const link = document.createElement('a');
                                                link.href = matrixImageUrl;
                                                link.download = `confusion_matrix_${evalResult.total_epochs}_epochs.png`;
                                                document.body.appendChild(link);
                                                link.click();
                                                document.body.removeChild(link);
                                                addLog('Downloading image...', 'success');
                                              } else {
                                                addLog('Image URL not available', 'error');
                                              }
                                            }}
                                            className="px-4 py-2 bg-white text-black hover:bg-zinc-200 text-xs font-semibold rounded-lg transition-all flex items-center gap-2"
                                          >
                                            <Download className="w-3 h-3" /> Download
                                          </button>
                                       </div>
                                    </div>
                                 )}
                              </div>

                              {/* Right: Detailed Report */}
                              <div>
                                <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-widest mb-6">Classification Report</h3>
                                <div className="overflow-auto max-h-[500px] rounded-xl border border-zinc-800 bg-zinc-900/20 scrollbar-thin">
                                   <table className="w-full min-w-[600px] text-sm text-left relative border-collapse">
                                      <thead className="sticky top-0 z-10 bg-black/90 backdrop-blur-md shadow-sm">
                                         <tr>
                                            <th className="px-5 py-4 whitespace-nowrap text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">Class</th>
                                            <th className="px-5 py-4 whitespace-nowrap text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800 text-right">Precision</th>
                                            <th className="px-5 py-4 whitespace-nowrap text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800 text-right">Recall</th>
                                            <th className="px-5 py-4 whitespace-nowrap text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800 text-right">F1-Score</th>
                                            <th className="px-5 py-4 whitespace-nowrap text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800 text-right">Support</th>
                                         </tr>
                                      </thead>
                                      <tbody className="divide-y divide-zinc-800/50">
                                          {Object.entries(evalResult.report).map(([key, val]: [string, unknown]) => {
                                             if (typeof val !== 'object') return null;
                                             return (
                                               <tr key={key} className="group hover:bg-white/5 transition-colors">
                                                  <td className="px-5 py-3 font-mono text-zinc-300 font-medium whitespace-nowrap group-hover:text-white border-r border-dashed border-zinc-800/30">{key}</td>
                                                  <td className="px-5 py-3 whitespace-nowrap text-right font-mono text-zinc-400">{val.precision?.toFixed(4)}</td>
                                                  <td className="px-5 py-3 whitespace-nowrap text-right font-mono text-zinc-400">{val.recall?.toFixed(4)}</td>
                                                  <td className="px-5 py-3 whitespace-nowrap text-right font-mono text-zinc-300 font-semibold">{val.f1_score?.toFixed(4) ?? val['f1-score']?.toFixed(4)}</td>
                                                  <td className="px-5 py-3 whitespace-nowrap text-right font-mono text-zinc-500">{val.support}</td>
                                               </tr>
                                             );
                                          })}
                                      </tbody>
                                   </table>
                                </div>
                              </div>
                             </div>
                         </div>
                       ) : (
                         <div className="h-full flex flex-col items-center justify-center text-zinc-600">
                            <p className="font-light">Train a model to see evaluation metrics.</p>
                         </div>
                       )}
                    </div>
                 )}

                 {activeTab === 'data' && (
                   <div className="p-6 overflow-y-auto space-y-4">
                     <div>
                       <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-widest mb-2">Tabular Data Processor</h3>
                       <p className="text-xs text-zinc-500 mb-4">Load or transform CSV / Excel files via <code className="bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-300">tabular_processor.py</code></p>
                     </div>
                     <div className="flex gap-2">
                       <input id="data-file-path" type="text" value={tabFile} onChange={e => setTabFile(e.target.value)}
                         placeholder="Select CSV / Excel file…"
                         className="flex-1 bg-black border border-zinc-800 rounded-lg py-2.5 px-3 text-sm text-zinc-300 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none font-mono"
                       />
                       <button id="data-pick-file" onClick={pickTabFile}
                         className="p-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                       ><FolderOpen className="w-5 h-5" /></button>
                     </div>
                     <div className="relative">
                       <select id="data-action" value={tabAction} onChange={e => setTabAction(e.target.value as TabAction)}
                         className="w-full appearance-none bg-black border border-zinc-800 rounded-lg py-2.5 px-3 text-sm text-zinc-300 focus:border-zinc-500 focus:outline-none"
                       >
                         <option value="load">Load &amp; Preview</option>
                         <option value="drop_missing">Drop Missing Rows</option>
                         <option value="fill_missing">Fill Missing Values</option>
                         <option value="label_encode">Label Encode</option>
                         <option value="one_hot_encode">One-Hot Encode</option>
                       </select>
                       <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"><svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg></div>
                     </div>
                     {tabAction === 'fill_missing' && (
                       <div className="relative">
                         <select id="data-fill-method" value={fillMethod} onChange={e => setFillMethod(e.target.value as FillMethod)}
                           className="w-full appearance-none bg-black border border-zinc-800 rounded-lg py-2.5 px-3 text-sm text-zinc-300 focus:border-zinc-500 focus:outline-none"
                         >
                           <option value="mean">Mean</option>
                           <option value="median">Median</option>
                           <option value="mode">Mode</option>
                           <option value="zero">Zero</option>
                         </select>
                         <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"><svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg></div>
                       </div>
                     )}
                     {(tabAction === 'label_encode' || tabAction === 'one_hot_encode') && (
                       <input id="data-encode-columns" type="text" value={encodeColumns} onChange={e => setEncodeColumns(e.target.value)}
                         placeholder="Columns to encode (comma-separated)"
                         className="w-full bg-black border border-zinc-800 rounded-lg py-2.5 px-3 text-sm text-zinc-300 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
                       />
                     )}
                     {tabAction !== 'load' && (
                       <input id="data-out-path" type="text" value={tabOutPath} onChange={e => setTabOutPath(e.target.value)}
                         placeholder="Save output to… (optional)"
                         className="w-full bg-black border border-zinc-800 rounded-lg py-2.5 px-3 text-sm text-zinc-300 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none font-mono"
                       />
                     )}
                     <button id="data-run-btn" onClick={runTabular} disabled={!tabFile || tabLoading}
                       className="flex items-center justify-center gap-2 w-full py-2.5 bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-semibold transition-all"
                     >
                       {tabLoading ? <><span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Processing…</> : 'Run'}
                     </button>
                     {tabResult && (
                       <div>
                         {tabResult.status === 'error' ? (
                           <div className="rounded-xl border border-red-900/30 bg-red-900/20 p-3 text-red-400 text-xs"><strong>Error:</strong> {tabResult.message}</div>
                         ) : (
                           <div className="space-y-3">
                             <div className="flex flex-wrap gap-2 text-xs">
                               {tabResult.shape && <span className="rounded-full bg-blue-500/10 border border-blue-500/30 px-3 py-1 text-blue-400">Shape: {tabResult.shape[0]} × {tabResult.shape[1]}</span>}
                               {tabResult.message && <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-emerald-400">{tabResult.message}</span>}
                             </div>
                             {tabResult.columns && tabResult.data && (
                               <div className="overflow-x-auto rounded-xl border border-zinc-800">
                                 <table className="min-w-full text-xs">
                                   <thead className="bg-zinc-900"><tr>
                                     {tabResult.columns.map(col => (
                                       <th key={col} className="px-3 py-2 text-left font-semibold text-zinc-300 whitespace-nowrap border-b border-zinc-800">
                                         <div>{col}</div>
                                         {tabResult.dtypes && <div className="font-normal text-zinc-500">{tabResult.dtypes[col]}</div>}
                                       </th>
                                     ))}
                                   </tr></thead>
                                   <tbody className="divide-y divide-zinc-800">
                                     {tabResult.data.map((row, ri) => (
                                       <tr key={ri} className="hover:bg-zinc-900/50 transition-colors">
                                         {row.map((cell, ci) => (
                                           <td key={ci} className={`px-3 py-2 whitespace-nowrap ${cell === null ? 'text-zinc-500 italic' : 'text-zinc-100'}`}>
                                             {cell === null ? 'null' : String(cell)}
                                           </td>
                                         ))}
                                       </tr>
                                     ))}
                                   </tbody>
                                 </table>
                               </div>
                             )}
                           </div>
                         )}
                       </div>
                     )}
                   </div>
                 )}
{activeTab === 'system' && (
  <div className="p-8 space-y-8 animate-in fade-in duration-500">
    {systemLoading && (
      <div className="flex items-center justify-center p-12">
        <span className="inline-block w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )}

    {systemError && (
      <div className="p-6 bg-red-900/10 border border-red-900/30 rounded-xl text-red-400">
        <div className="flex items-center gap-3 mb-2 text-lg font-semibold">
          <AlertCircle className="w-5 h-5" /> Error Loading System Info
        </div>
        <p className="text-sm opacity-80">{systemError}</p>
      </div>
    )}

    {systemInfo && (
      <div className="space-y-8">
         {/* ================= LIVE PERFORMANCE STRIP ================= */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

     <div
  className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 shadow-sm">
  <div className="flex justify-between items-center mb-4">
    <span
      className={cn(
        "text-xs uppercase tracking-wider",
        isLightMode ? "text-zinc-500" : "text-zinc-400"
      )}
    >
      CPU Usage
    </span>
    <span className="text-2xl font-bold">
      {systemInfo.hardware?.cpu_usage_percent ?? 0}%
    </span>
  </div>

  <div
    className={cn(
      "w-full h-2 rounded-full overflow-hidden",
      isLightMode ? "bg-zinc-200" : "bg-zinc-800"
    )}
  >
    <div
      className="h-full bg-emerald-500 transition-all duration-500"
      style={{ width: `${systemInfo.hardware?.cpu_usage_percent ?? 0}%` }}
    />
  </div>

  <div
    className={cn(
      "text-xs mt-3",
      isLightMode ? "text-zinc-500" : "text-zinc-400"
    )}
  >
    {systemInfo.hardware?.cpu_freq_mhz ?? "-"} MHz
  </div>
</div>

      {/* RAM CARD */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 shadow-sm">
  <div className="flex justify-between items-center mb-4">
    <span className="text-xs uppercase tracking-wider text-zinc-500">
      RAM Usage
    </span>
    <span className="text-2xl font-bold">
      {systemInfo.hardware?.ram_used_percent ?? 0}%
    </span>
  </div>

  <div className="w-full h-2 rounded-full overflow-hidden bg-zinc-300 dark:bg-zinc-800">
    <div
      className="h-full bg-blue-500 transition-all duration-500"
      style={{ width: `${systemInfo.hardware?.ram_used_percent ?? 0}%` }}
    />
  </div>

  <div className="text-xs text-zinc-500 mt-3 space-y-1">
    <div>
      {systemInfo.hardware?.ram_used_gb} GB / {systemInfo.hardware?.ram_total_gb} GB
    </div>
    <div>
      Available: {systemInfo.hardware?.ram_available_gb} GB
    </div>
  </div>
</div>

      {/* DISK CARD */}
       <div
  className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs uppercase tracking-wider text-zinc-500">
            Disk Usage
          </span>
          <span className="text-2xl font-bold">
            {systemInfo.hardware?.disk_used_percent ?? 0}%
          </span>
        </div>

        <div className="text-xs text-zinc-500 mt-3 space-y-1">
    <div>
      Free: {systemInfo.hardware?.disk_free_gb} GB
    </div>
    <div>
      Total: {systemInfo.hardware?.disk_total_gb} GB
    </div>
  </div>
      </div>
    </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Hardware Card */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Cpu className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-zinc-100">Hardware Overview</h3>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800/50 pb-3">
              <span className="text-zinc-500 text-sm">Processor</span>
              <span className="text-zinc-300 text-sm break-words text-right max-w-[60%] font-medium">{systemInfo.hardware?.cpu || 'Unknown'}</span>
            </div>
            <div className="flex justify-between items-center border-b border-zinc-800/50 pb-3">
              <span className="text-zinc-500 text-sm">Logical Cores</span>
              <span className="text-zinc-300 text-sm font-medium">{systemInfo.hardware?.cores}</span>
            </div>
            <div className="flex justify-between items-center border-b border-zinc-800/50 pb-3">
              <span className="text-zinc-500 text-sm">Total Memory</span>
              <span className="text-zinc-300 text-sm font-medium">{systemInfo.hardware?.ram_total_gb} GB</span>
            </div>
            <div className="flex justify-between items-center pb-1">
              <span className="text-zinc-500 text-sm">Available Memory</span>
              <span className="text-zinc-300 text-sm font-medium">{systemInfo.hardware?.ram_available_gb} GB</span>
            </div>
          </div>
        </div>

        {/* AI & Compute Card */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Activity className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-zinc-100">AI Compute & Python</h3>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800/50 pb-3">
              <span className="text-zinc-500 text-sm">PyTorch Version</span>
              <span className="text-zinc-300 text-sm font-medium">{systemInfo.torch?.version}</span>
            </div>
            <div className="flex justify-between items-center border-b border-zinc-800/50 pb-3">
              <span className="text-zinc-500 text-sm">CUDA Support</span>
              <span className="text-zinc-300 text-sm font-medium">
                {systemInfo.torch?.cuda_available ? (
                  <span className="text-emerald-400 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> Available ({systemInfo.torch.cuda_version})</span>
                ) : (
                  <span className="text-zinc-500">Not Available</span>
                )}
              </span>
            </div>
            <div className="flex justify-between items-center border-b border-zinc-800/50 pb-3">
              <span className="text-zinc-500 text-sm">Active GPU</span>
              <span className="text-zinc-300 text-sm font-medium max-w-[60%] text-right">{systemInfo.torch?.gpu_name || 'CPU Only'}</span>
            </div>
            <div className="flex justify-between items-center pb-1">
              <span className="text-zinc-500 text-sm">Python Runtime</span>
              <span className="text-zinc-300 text-sm font-medium">v{systemInfo.python?.version}</span>
            </div>
          </div>
        </div>

        {/* Platform Card */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 md:col-span-2 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Terminal className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-zinc-100">Platform Architecture</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <div className="p-4 bg-zinc-800/20 rounded-xl border border-zinc-800/50">
               <div className="text-zinc-500 text-xs mb-1 uppercase tracking-wider">Operating System</div>
               <div className="text-zinc-300 text-sm font-medium">{systemInfo.platform?.os} {systemInfo.platform?.release}</div>
             </div>
             <div className="p-4 bg-zinc-800/20 rounded-xl border border-zinc-800/50">
               <div className="text-zinc-500 text-xs mb-1 uppercase tracking-wider">Architecture</div>
               <div className="text-zinc-300 text-sm font-medium">{systemInfo.hardware?.architecture}</div>
             </div>
             <div className="p-4 bg-zinc-800/20 rounded-xl border border-zinc-800/50 md:col-span-2 overflow-hidden flex flex-col justify-center">
               <div className="text-zinc-500 text-xs mb-1 uppercase tracking-wider">Python Executable Path</div>
               <div className="text-zinc-400 text-xs font-mono break-all line-clamp-2" title={systemInfo.python?.executable}>{systemInfo.python?.executable}</div>
             </div>
          </div>
        </div>
      </div>
      </div>
    )}
  </div>
)}
              </div>
           </div>
        </section>
      </main>


    </div>
    </>
  );
}
