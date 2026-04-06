use base64::Engine;
use image::DynamicImage;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};

pub struct CaptureState {
    pub image: Mutex<Option<DynamicImage>>,
}

impl Default for CaptureState {
    fn default() -> Self {
        Self {
            image: Mutex::new(None),
        }
    }
}

fn img_to_base64_png(img: &DynamicImage) -> String {
    let mut buf = std::io::Cursor::new(Vec::new());
    img.write_to(&mut buf, image::ImageFormat::Png)
        .expect("Failed to encode PNG");
    base64::engine::general_purpose::STANDARD.encode(buf.into_inner())
}

// ---- Commands ----

/// Return the stored full screenshot as base64 PNG.
#[tauri::command]
pub fn capture_get_screenshot(state: tauri::State<'_, CaptureState>) -> Result<String, String> {
    let guard = state.image.lock().map_err(|e| e.to_string())?;
    match guard.as_ref() {
        Some(img) => Ok(img_to_base64_png(img)),
        None => Err("No screenshot available".into()),
    }
}

/// Crop a region from the stored screenshot, return as base64 PNG.
/// Consumes the stored image.
#[tauri::command]
pub fn capture_crop_region(
    state: tauri::State<'_, CaptureState>,
    x: u32,
    y: u32,
    w: u32,
    h: u32,
) -> Result<String, String> {
    let mut guard = state.image.lock().map_err(|e| e.to_string())?;
    let img = guard.take().ok_or("No screenshot available")?;

    let iw = img.width();
    let ih = img.height();
    let cx = x.min(iw.saturating_sub(1));
    let cy = y.min(ih.saturating_sub(1));
    let cw = w.min(iw - cx);
    let ch = h.min(ih - cy);

    let cropped = image::imageops::crop(&img, cx, cy, cw, ch).to_image();
    let result = DynamicImage::ImageRgba8(cropped);
    Ok(img_to_base64_png(&result))
}

/// Capture the window at the given screen coordinates, return as base64 PNG.
/// xcap returns windows in z-order (topmost first); we skip our own windows.
#[tauri::command]
pub fn capture_window_at_point(
    state: tauri::State<'_, CaptureState>,
    x: i32,
    y: i32,
) -> Result<String, String> {
    {
        let mut guard = state.image.lock().map_err(|e| e.to_string())?;
        *guard = None;
    }

    let windows = xcap::Window::all().map_err(|e| e.to_string())?;
    let our_titles = ["Desktop Teacher"];

    for win in &windows {
        let title = win.title().unwrap_or_default();
        if our_titles.iter().any(|t| title.contains(t)) {
            continue;
        }

        let pos = match win.position() {
            Ok(p) => p,
            Err(_) => continue,
        };
        let size = match win.size() {
            Ok(s) => s,
            Err(_) => continue,
        };

        let wx: i32 = pos.x;
        let wy: i32 = pos.y;
        let ww: i32 = size.width as i32;
        let wh: i32 = size.height as i32;

        if x >= wx && x < wx + ww && y >= wy && y < wy + wh {
            let img = win.capture_image().map_err(|e| e.to_string())?;
            let result = DynamicImage::ImageRgba8(img);
            return Ok(img_to_base64_png(&result));
        }
    }

    Err("No suitable window found at that position".into())
}

/// Cancel capture: clear state and destroy overlay window.
#[tauri::command]
pub fn capture_cancel(app: AppHandle, state: tauri::State<'_, CaptureState>) -> Result<(), String> {
    {
        let mut guard = state.image.lock().map_err(|e| e.to_string())?;
        *guard = None;
    }
    destroy_overlay(&app);
    Ok(())
}

// ---- Window lifecycle ----

fn destroy_overlay<R: Runtime>(app: &AppHandle<R>) {
    if let Some(win) = app.get_webview_window("capture-overlay") {
        let _ = win.destroy();
    }
}

fn ensure_sidebar<R: Runtime>(app: &AppHandle<R>) {
    if app.get_webview_window("sidebar").is_none() {
        if let Some(main_win) = app.get_webview_window("main") {
            if let Ok(Some(monitor)) = main_win.primary_monitor() {
                let screen_size = monitor.size();
                let screen_pos = monitor.position();
                let sidebar_width: u32 = 380;
                let sidebar_height = (screen_size.height as f64 * 0.85) as u32;
                let x = screen_pos.x + screen_size.width as i32 - sidebar_width as i32 - 20;
                let y = screen_pos.y + 40;

                let _ = WebviewWindowBuilder::new(
                    app,
                    "sidebar",
                    WebviewUrl::App("/".into()),
                )
                .title("Desktop Teacher")
                .inner_size(sidebar_width as f64, sidebar_height as f64)
                .decorations(false)
                .always_on_top(true)
                .skip_taskbar(true)
                .resizable(true)
                .position(x as f64, y as f64)
                .build();
            }
        }
    } else if let Some(win) = app.get_webview_window("sidebar") {
        let _ = win.show();
        let _ = win.set_focus();
    }
}

/// Trigger the full capture flow: screenshot primary monitor → open overlay.
pub fn trigger_capture<R: Runtime>(app: &AppHandle<R>) {
    let monitors = match xcap::Monitor::all() {
        Ok(m) => m,
        Err(e) => {
            eprintln!("Failed to enumerate monitors: {e}");
            return;
        }
    };

    let primary = match monitors.into_iter().find(|m| m.is_primary().unwrap_or(false)) {
        Some(m) => m,
        None => {
            eprintln!("No primary monitor found");
            return;
        }
    };

    let img = match primary.capture_image() {
        Ok(i) => i,
        Err(e) => {
            eprintln!("Failed to capture screen: {e}");
            return;
        }
    };

    let state: tauri::State<CaptureState> = app.state();
    {
        let mut guard = match state.image.lock() {
            Ok(g) => g,
            Err(e) => {
                eprintln!("Failed to lock capture state: {e}");
                return;
            }
        };
        *guard = Some(DynamicImage::ImageRgba8(img));
    }

    let monitor_size = match primary.size() {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Failed to get monitor size: {e}");
            return;
        }
    };
    let monitor_pos = match primary.position() {
        Ok(p) => p,
        Err(e) => {
            eprintln!("Failed to get monitor position: {e}");
            return;
        }
    };

    if let Some(win) = app.get_webview_window("capture-overlay") {
        let _ = win.destroy();
    }

    let overlay_result = WebviewWindowBuilder::new(
        app,
        "capture-overlay",
        WebviewUrl::App("/".into()),
    )
    .title("Capture")
    .inner_size(monitor_size.width as f64, monitor_size.height as f64)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .position(monitor_pos.x as f64, monitor_pos.y as f64)
    .build();

    if let Err(e) = overlay_result {
        eprintln!("Failed to create overlay window: {e}");
    }
}

/// Receive confirmed selection from overlay: emit event, show sidebar, close overlay.
#[tauri::command]
pub fn capture_confirm_selection(app: AppHandle, image_data: String) -> Result<(), String> {
    destroy_overlay(&app);
    ensure_sidebar(&app);
    app.emit("capture-selected", image_data)
        .map_err(|e| e.to_string())
}
