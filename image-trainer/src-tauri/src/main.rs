// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use tauri_plugin_shell::ShellExt;

async fn run_python(
    app: &tauri::AppHandle,
    args: &[&str],
) -> Result<String, String> {
    // Try `python` first, then alternatives including the Windows Python Launcher `py`
    let cmds = ["python", "python3", "py"];
    let mut last_err = String::new();

    for cmd in cmds {
        match app
            .shell()
            .command(cmd)
            .args(args)
            .output()
            .await
        {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                
                // If it succeeds, immediately return the standard output
                if output.status.success() {
                    return Ok(stdout);
                } else {
                    // Record error to return if ALL commands fail
                    let msg = if !stderr.trim().is_empty() {
                        stderr
                    } else if !stdout.trim().is_empty() {
                        stdout
                    } else {
                        format!("Exited with code: {}", output.status.code().unwrap_or(-1))
                    };
                    last_err = msg;
                    continue;
                }
            }
            Err(e) => {
                last_err = e.to_string();
            }
        }
    }
    Err(last_err)
}

/// Runs tabular_processor.py with the given action, file, and optional params.
/// Returns the JSON string printed by the script.
#[tauri::command]
async fn run_tabular_processor(
    app: tauri::AppHandle,
    file: String,
    action: String,
    params: Option<String>,
    out: Option<String>,
) -> Result<String, String> {
    let script_path = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("python_backend")
        .join("tabular_processor.py");

    let script = script_path.to_string_lossy().to_string().replace("\\\\?\\", "");

    // Build args list
    let mut args: Vec<String> = vec![
        script,
        "--action".to_string(),
        action,
        "--file".to_string(),
        file,
    ];
    if let Some(p) = params {
        args.push("--params".to_string());
        args.push(p);
    }
    if let Some(o) = out {
        args.push("--out".to_string());
        args.push(o);
    }

    let args_ref: Vec<&str> = args.iter().map(String::as_str).collect();
    run_python(&app, &args_ref).await
}

/// Runs check_gpu.py and returns the stdout lines as a plain string.
#[tauri::command]
async fn run_check_gpu(app: tauri::AppHandle) -> Result<String, String> {
    let script_path = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("python_backend")
        .join("check_gpu.py");

    let script = script_path.to_string_lossy().to_string().replace("\\\\?\\", "");

    match run_python(&app, &[script.as_str()]).await {
        Ok(output) => Ok(output.trim().to_string()), // remove extra newline
        Err(e) => Err(format!("GPU detection failed: {}", e)),
    }
}
/// Runs system_info.py and returns structured JSON string.
#[tauri::command]
async fn get_system_info(app: tauri::AppHandle) -> Result<String, String> {
    let script_path = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("python_backend")
        .join("system_info.py");

    let script = script_path.to_string_lossy().to_string().replace("\\\\?\\", "");

    match run_python(&app, &[script.as_str()]).await {
        Ok(output) => Ok(output.trim().to_string()),
        Err(e) => Err(format!("System info failed: {}", e)),
    }
}

#[tauri::command]
async fn check_dependencies(app: tauri::AppHandle) -> Result<String, String> {
    println!("DEBUG: Running backend check_dependencies");
    let script = "import sys, json, importlib.util; p = lambda x: importlib.util.find_spec(x) is not None; print(json.dumps({'python': True, 'executable': sys.executable, 'version': sys.version.split()[0], 'pandas': p('pandas'), 'sklearn': p('sklearn'), 'torch': p('torch')}))";
    match run_python(&app, &["-c", script]).await {
        Ok(output) => {
            println!("DEBUG: Python stdout: {}", output);
            Ok(output.trim().to_string())
        },
        Err(e) => {
            println!("DEBUG: Python error: {}", e);
            let error_json = format!(
                "{{\"python\": false, \"version\": null, \"pandas\": false, \"sklearn\": false, \"torch\": false, \"error\": \"{}\"}}",
                e.replace("\"", "\\\"").replace("\n", " ")
            );
            Ok(error_json)
        }
    }
}

/// Return the main output file paths for a given save directory.
/// - This helper is intentionally lightweight: it does not attempt to read or
///   stream files, it only checks presence and returns absolute paths as JSON.
/// - The returned JSON keys map to common artifacts produced by the Python
///   training script (`script.py`) such as `best_model.pth`, confusion matrix
///   images, training curves, and a combined PDF report.
/// - Rationale: frontends (or the Tauri layer) can call this to decide which
///   artifacts are available and then either open them with the system shell
///   or stream/read them via platform APIs if needed.
/// Returns: JSON string mapping artifact keys to absolute path or null.
#[tauri::command]
async fn get_output_files(_app: tauri::AppHandle, save_dir: String) -> Result<String, String> {
    use std::path::PathBuf;
    use serde_json::json;

    let dir = PathBuf::from(save_dir);
    let files = [
        ("best_model", "best_model.pth"),
        ("confusion_matrix_png", "confusion_matrix.png"),
        ("confusion_matrix_jpg", "confusion_matrix.jpg"),
        ("training_curves_png", "training_curves.png"),
        ("training_curves_jpg", "training_curves.jpg"),
        ("report_pdf", "results_report.pdf"),
    ];

    let mut map = serde_json::Map::new();

    for (key, fname) in files.iter() {
        let p = dir.join(fname);
        if p.exists() {
            map.insert(key.to_string(), json!(p.to_string_lossy().to_string()));
        } else {
            map.insert(key.to_string(), serde_json::Value::Null);
        }
    }

    serde_json::to_string(&map).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            run_tabular_processor,
            run_check_gpu,
            get_system_info,
            check_dependencies,
            get_output_files
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            let icon = tauri::include_image!("icons/icon.png");
            window.set_icon(icon).unwrap();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
