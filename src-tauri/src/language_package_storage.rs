use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const LANGUAGE_ROOT_DIRECTORY: &str = "languages";
const INTEGRATED_LANGUAGE_CODE: &str = "es";
const SUPPORTED_EXTERNAL_CODES: [&str; 9] = ["cn", "de", "en", "fr", "it", "jp", "nl", "pt", "ru"];

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LanguagePackageManifest {
    pub schema_version: u32,
    pub kind: String,
    pub code: String,
    pub language_tag: String,
    pub locale: String,
    pub name: String,
    pub native_name: String,
    pub version: String,
    pub translations_file: String,
    pub translations_sha256: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LanguagePackagePayload {
    pub manifest: LanguagePackageManifest,
    pub translations: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledLanguagePackage {
    pub code: String,
    pub version: String,
    pub manifest: LanguagePackageManifest,
}

fn validate_code(code: &str) -> Result<(), String> {
    if code == INTEGRATED_LANGUAGE_CODE {
        return Err("El español está integrado y no admite paquetes externos.".to_string());
    }

    if !SUPPORTED_EXTERNAL_CODES.contains(&code) {
        return Err(format!("Código de idioma no permitido: {code}"));
    }

    Ok(())
}

fn validate_version(version: &str) -> Result<(), String> {
    if version.is_empty()
        || version.len() > 80
        || version.contains("..")
        || version.contains('/')
        || version.contains('\\')
        || !version
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || ".-+".contains(character))
    {
        return Err("Versión de paquete no válida.".to_string());
    }

    Ok(())
}

fn language_root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join(LANGUAGE_ROOT_DIRECTORY))
        .map_err(|error| format!("No se pudo resolver AppData: {error}"))
}

fn package_directory(app: &AppHandle, code: &str, version: &str) -> Result<PathBuf, String> {
    validate_code(code)?;
    validate_version(version)?;

    Ok(language_root(app)?.join(code).join(version))
}

fn write_json_atomic(path: &Path, value: &impl Serialize) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "La ruta de destino no tiene directorio padre.".to_string())?;

    fs::create_dir_all(parent)
        .map_err(|error| format!("No se pudo crear el directorio del paquete: {error}"))?;

    let temporary = path.with_extension("json.tmp");
    let json = serde_json::to_vec_pretty(value)
        .map_err(|error| format!("No se pudo serializar el paquete: {error}"))?;

    fs::write(&temporary, json)
        .map_err(|error| format!("No se pudo escribir el archivo temporal: {error}"))?;

    if path.exists() {
        fs::remove_file(path)
            .map_err(|error| format!("No se pudo reemplazar el archivo existente: {error}"))?;
    }

    fs::rename(&temporary, path)
        .map_err(|error| format!("No se pudo confirmar el archivo del paquete: {error}"))
}

#[tauri::command]
pub fn save_language_package(
    app: AppHandle,
    package: LanguagePackagePayload,
) -> Result<InstalledLanguagePackage, String> {
    validate_code(&package.manifest.code)?;
    validate_version(&package.manifest.version)?;

    if package.manifest.schema_version != 1 {
        return Err("Versión de esquema de paquete no compatible.".to_string());
    }

    if package.manifest.kind != "pdfprivado-pro-ui-language" {
        return Err("Tipo de paquete de idioma no compatible.".to_string());
    }

    if package.manifest.translations_file != "translations.json" {
        return Err("El paquete debe usar translations.json.".to_string());
    }

    if !package.translations.is_object() {
        return Err("Las traducciones deben ser un objeto JSON.".to_string());
    }

    let directory = package_directory(&app, &package.manifest.code, &package.manifest.version)?;

    write_json_atomic(&directory.join("translations.json"), &package.translations)?;
    write_json_atomic(&directory.join("manifest.json"), &package.manifest)?;

    Ok(InstalledLanguagePackage {
        code: package.manifest.code.clone(),
        version: package.manifest.version.clone(),
        manifest: package.manifest,
    })
}

#[tauri::command]
pub fn read_language_package(
    app: AppHandle,
    code: String,
    version: String,
) -> Result<LanguagePackagePayload, String> {
    let directory = package_directory(&app, &code, &version)?;

    let manifest_bytes = fs::read(directory.join("manifest.json"))
        .map_err(|error| format!("No se pudo leer el manifiesto: {error}"))?;
    let translation_bytes = fs::read(directory.join("translations.json"))
        .map_err(|error| format!("No se pudieron leer las traducciones: {error}"))?;

    let manifest: LanguagePackageManifest = serde_json::from_slice(&manifest_bytes)
        .map_err(|error| format!("El manifiesto instalado no es válido: {error}"))?;
    let translations: Value = serde_json::from_slice(&translation_bytes)
        .map_err(|error| format!("Las traducciones instaladas no son válidas: {error}"))?;

    if manifest.code != code || manifest.version != version {
        return Err("La identidad del paquete instalado no coincide con su ruta.".to_string());
    }

    Ok(LanguagePackagePayload {
        manifest,
        translations,
    })
}

#[tauri::command]
pub fn list_language_packages(app: AppHandle) -> Result<Vec<InstalledLanguagePackage>, String> {
    let root = language_root(&app)?;

    if !root.exists() {
        return Ok(Vec::new());
    }

    let mut installed = Vec::new();

    for code_entry in fs::read_dir(&root)
        .map_err(|error| format!("No se pudo listar el almacén de idiomas: {error}"))?
    {
        let code_entry = code_entry
            .map_err(|error| format!("No se pudo leer una entrada de idioma: {error}"))?;

        if !code_entry
            .file_type()
            .map_err(|error| format!("No se pudo consultar una entrada de idioma: {error}"))?
            .is_dir()
        {
            continue;
        }

        let code = code_entry.file_name().to_string_lossy().into_owned();

        if validate_code(&code).is_err() {
            continue;
        }

        for version_entry in fs::read_dir(code_entry.path())
            .map_err(|error| format!("No se pudieron listar las versiones de {code}: {error}"))?
        {
            let version_entry = version_entry
                .map_err(|error| format!("No se pudo leer una versión de {code}: {error}"))?;

            if !version_entry
                .file_type()
                .map_err(|error| format!("No se pudo consultar una versión de {code}: {error}"))?
                .is_dir()
            {
                continue;
            }

            let version = version_entry.file_name().to_string_lossy().into_owned();

            if validate_version(&version).is_err() {
                continue;
            }

            let manifest_path = version_entry.path().join("manifest.json");

            let manifest = match fs::read(&manifest_path)
                .ok()
                .and_then(|bytes| serde_json::from_slice::<LanguagePackageManifest>(&bytes).ok())
            {
                Some(manifest) if manifest.code == code && manifest.version == version => manifest,
                _ => continue,
            };

            installed.push(InstalledLanguagePackage {
                code: code.clone(),
                version,
                manifest,
            });
        }
    }

    installed.sort_by(|left, right| {
        left.code
            .cmp(&right.code)
            .then_with(|| left.version.cmp(&right.version))
    });

    Ok(installed)
}

#[tauri::command]
pub fn delete_language_package(
    app: AppHandle,
    code: String,
    version: String,
) -> Result<bool, String> {
    let directory = package_directory(&app, &code, &version)?;

    if !directory.exists() {
        return Ok(false);
    }

    fs::remove_dir_all(&directory)
        .map_err(|error| format!("No se pudo eliminar el paquete: {error}"))?;

    if let Some(code_directory) = directory.parent() {
        if code_directory
            .read_dir()
            .map(|mut entries| entries.next().is_none())
            .unwrap_or(false)
        {
            let _ = fs::remove_dir(code_directory);
        }
    }

    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::{validate_code, validate_version};

    #[test]
    fn integrated_spanish_is_protected() {
        assert!(validate_code("es").is_err());
    }

    #[test]
    fn supported_external_codes_are_accepted() {
        assert!(validate_code("en").is_ok());
        assert!(validate_code("jp").is_ok());
        assert!(validate_code("cn").is_ok());
    }

    #[test]
    fn unsafe_versions_are_rejected() {
        assert!(validate_version("../1.0.0").is_err());
        assert!(validate_version("1/0/0").is_err());
        assert!(validate_version("1.0.0").is_ok());
    }
}
