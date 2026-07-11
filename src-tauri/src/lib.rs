use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri_plugin_fs::FsExt;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PdfPathInfo {
    path: String,
    name: String,
    size: u64,
}

fn validate_pdf_path(path: &str) -> Result<PathBuf, String> {
    let candidate = PathBuf::from(path);
    let canonical = candidate
        .canonicalize()
        .map_err(|_| "No se encuentra el archivo PDF indicado.".to_string())?;

    if !canonical.is_file() {
        return Err("La ruta indicada no corresponde a un archivo.".to_string());
    }

    let is_pdf = canonical
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("pdf"))
        .unwrap_or(false);

    if !is_pdf {
        return Err("Solo se permite abrir archivos con extensión PDF.".to_string());
    }

    Ok(canonical)
}

#[tauri::command]
fn authorize_pdf_path(app: tauri::AppHandle, path: String) -> Result<PdfPathInfo, String> {
    let canonical = validate_pdf_path(&path)?;
    let metadata = canonical
        .metadata()
        .map_err(|_| "No se pudo consultar el archivo PDF.".to_string())?;

    let _ = app.fs_scope().allow_file(&canonical);

    let name = canonical
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("documento.pdf")
        .to_string();

    Ok(PdfPathInfo {
        path: canonical.to_string_lossy().into_owned(),
        name,
        size: metadata.len(),
    })
}

#[tauri::command]
fn startup_pdf_path() -> Option<String> {
    std::env::args_os().skip(1).find_map(|argument| {
        let path = Path::new(&argument);
        let is_pdf = path
            .extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| extension.eq_ignore_ascii_case("pdf"))
            .unwrap_or(false);

        if is_pdf && path.is_file() {
            Some(path.to_string_lossy().into_owned())
        } else {
            None
        }
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            authorize_pdf_path,
            startup_pdf_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
