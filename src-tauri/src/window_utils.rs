use tauri::{AppHandle, Manager, Runtime};

pub fn logical_monitor_rect<R: Runtime>(app: &AppHandle<R>) -> Option<(f64, f64, f64, f64)> {
    let main_win = app.get_webview_window("main")?;
    let monitor = main_win.primary_monitor().ok()??;
    let scale = monitor.scale_factor();
    let w = monitor.size().width as f64 / scale;
    let h = monitor.size().height as f64 / scale;
    let x = monitor.position().x as f64 / scale;
    let y = monitor.position().y as f64 / scale;
    Some((x, y, w, h))
}

pub fn show_sidebar<R: Runtime>(app: &AppHandle<R>) {
    if let Some(win) = app.get_webview_window("sidebar") {
        let _ = win.show();
        let _ = win.set_focus();
    }
}

#[cfg(target_os = "windows")]
pub fn hide_overlay<R: Runtime>(app: &AppHandle<R>) {
    if let Some(win) = app.get_webview_window("capture-overlay") {
        let _ = win.hide();
    }
}
