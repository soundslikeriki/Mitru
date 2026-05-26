use std::{
    fs,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::Manager;
use tauri_plugin_shell::ShellExt;

#[tauri::command]
#[allow(dead_code)]
async fn open_print_preview(
    app: tauri::AppHandle,
    html_content: String,
    title: String,
) -> Result<(), String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let file_name = format!("mitru_print_preview_{timestamp}.html");
    let file_path = std::env::temp_dir().join(file_name);

    fs::write(&file_path, html_content).map_err(|error| error.to_string())?;

    let url = tauri::Url::from_file_path(&file_path)
        .map_err(|_| "印刷プレビュー用HTMLのURL作成に失敗しました".to_string())?;
    let label = format!("print-preview-{timestamp}");

    tauri::WebviewWindowBuilder::new(&app, label, tauri::WebviewUrl::External(url))
        .title(title)
        .inner_size(900.0, 1120.0)
        .min_inner_size(720.0, 840.0)
        .resizable(true)
        .center()
        .build()
        .map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
async fn close_print_preview(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
) -> Result<(), String> {
    let current_label = window.label();
    if current_label == "print-preview"
        || current_label.starts_with("print-preview")
        || current_label.starts_with("preview")
    {
        return window.close().map_err(|error| error.to_string());
    }

    let mut closed_any = false;
    for (label, preview_window) in app.webview_windows() {
        if label == "print-preview" || label.starts_with("print-preview") || label.starts_with("preview") {
            preview_window
                .close()
                .map_err(|error| error.to_string())?;
            closed_any = true;
        }
    }

    if closed_any {
        Ok(())
    } else {
        Err("current window is not a print preview".to_string())
    }
}

#[tauri::command]
async fn close_current_window(window: tauri::WebviewWindow) -> Result<(), String> {
    let label = window.label();
    if label == "print-preview" || label.starts_with("print-preview") || label.starts_with("preview") {
        return window.close().map_err(|error| error.to_string());
    }

    Err("current window is not a print preview".to_string())
}

#[tauri::command]
#[allow(deprecated)]
fn open_web_search(app: tauri::AppHandle, query: String) -> Result<(), String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Err("検索キーワードが空です".to_string());
    }

    let url = format!("https://www.google.com/search?q={}", encode_query(trimmed));
    app.shell()
        .open(url, None)
        .map_err(|error| error.to_string())
}

fn encode_query(input: &str) -> String {
    let mut encoded = String::new();

    for byte in input.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char);
            }
            b' ' => encoded.push('+'),
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }

    encoded
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            open_print_preview,
            close_print_preview,
            close_current_window,
            open_web_search
        ])
        .run(tauri::generate_context!())
        .expect("error while running Mitru");
}
