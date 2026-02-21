import torch
import sys
import json

def get_gpu_info():
    try:
        gpu_available = torch.cuda.is_available()

        base_info = {
            "python_version": sys.version,
            "pytorch_version": torch.__version__,
            "cuda_available": gpu_available
        }

        if gpu_available:
            device_index = torch.cuda.current_device()
            props = torch.cuda.get_device_properties(device_index)

            base_info.update({
                "cuda_version": torch.version.cuda,
                "device_count": torch.cuda.device_count(),
                "current_device": device_index,
                "device_name": props.name,
                "total_memory_gb": round(props.total_memory / (1024**3), 2)
            })
        else:
            base_info.update({
                "reason": "CUDA not available. Likely CPU-only PyTorch installed."
            })

        return base_info

    except Exception as e:
        return {
            "cuda_available": False,
            "error": str(e)
        }

if __name__ == "__main__":
    print(json.dumps(get_gpu_info()))
