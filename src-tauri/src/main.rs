#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
mod install;

fn external_link(url: &tauri::Url) -> bool {
    matches!(url.scheme(), "http" | "https")
        && url.host_str().is_some()
        && url.username().is_empty()
        && url.password().is_none()
}

fn local_link(url: &tauri::Url) -> bool {
    (url.scheme() == "tauri" && url.host_str() == Some("localhost"))
        || (matches!(url.scheme(), "http" | "https") && url.host_str() == Some("tauri.localhost"))
}

fn main() {
    // A mounted installer must not hold the installed app's single-instance lock.
    let mounted_installer = install::is_installer_launch();
    let mut builder = tauri::Builder::default();
    if !mounted_installer {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }));
    }
    builder
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title(app.config().product_name.clone().unwrap_or_else(|| "App Studio".into()))
                .inner_size(1440.0, 950.0)
                .min_inner_size(360.0, 500.0)
                .visible(true)
                .on_navigation(|url| {
                    if local_link(url) { return true; }
                    if external_link(url) { let _ = open::that_detached(url.as_str()); }
                    false
                })
                .on_new_window(|url, _| {
                    if external_link(&url) { let _ = open::that_detached(url.as_str()); }
                    tauri::webview::NewWindowResponse::Deny
                })
                .build()?;
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                match install::prepare_launch(handle.clone()) {
                    Ok(install::LaunchDecision::Relaunched) => handle.exit(0),
                    result => {
                        if let Err(error) = result {
                            handle.dialog().message(format!("Installation could not finish. Your current app and installer were kept.\n\n{error}"))
                                .title("Installation needs attention")
                                .kind(MessageDialogKind::Error)
                                .blocking_show();
                        }
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Could not start the desktop app");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn navigation_preserves_local_models_without_remote_privileges() {
        assert!(local_link(
            &tauri::Url::parse("tauri://localhost/index.html?model=oscillator").unwrap()
        ));
        assert!(local_link(
            &tauri::Url::parse("http://tauri.localhost/index.html").unwrap()
        ));
        assert!(!local_link(
            &tauri::Url::parse("https://example.org").unwrap()
        ));
        assert!(external_link(
            &tauri::Url::parse("https://github.com/KadenCSmith").unwrap()
        ));
        for input in [
            "file:///etc/passwd",
            "javascript:alert(1)",
            "https://user:pass@example.org",
        ] {
            assert!(!external_link(&tauri::Url::parse(input).unwrap()));
        }
    }
}
