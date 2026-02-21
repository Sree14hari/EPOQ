
"use client";

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface GPUInfo {
  python_version?: string;
  pytorch_version?: string;
  cuda_available: boolean;
  cuda_version?: string;
  device_name?: string;
  total_memory_gb?: number;
  reason?: string;
  error?: string;
}

export default function GPUStatus() {
  const [gpuInfo, setGpuInfo] = useState<GPUInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGPU() {
      try {
        const result = await invoke<string>("run_check_gpu");
        const parsed = JSON.parse(result);
        setGpuInfo(parsed);
      } catch (error) {
        setGpuInfo({
          cuda_available: false,
          error: "Failed to detect GPU"
        });
      } finally {
        setLoading(false);
      }
    }

    fetchGPU();
  }, []);

  if (loading) {
    return (
      <div className="p-3 rounded bg-gray-100 text-gray-600">
        Detecting hardware...
      </div>
    );
  }

  if (!gpuInfo?.cuda_available) {
    return (
      <div className="p-3 rounded bg-red-100 text-red-700">
        <strong>CPU Mode</strong>
        <br />
        {gpuInfo?.reason || gpuInfo?.error}
      </div>
    );
  }

  return (
    <div className="p-3 rounded bg-green-100 text-green-700">
      <strong>GPU Detected</strong>
      <br />
      {gpuInfo.device_name}
      <br />
      CUDA: {gpuInfo.cuda_version}
      <br />
      Memory: {gpuInfo.total_memory_gb} GB
    </div>
  );
}
