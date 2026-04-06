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

fn logical_monitor_rect<R: Runtime>(app: &AppHandle<R>) -> Option<(f64, f64, f64, f64)> {
    let main_win = app.get_webview_window("main")?;
    let monitor = main_win.primary_monitor().ok()??;
    let scale = monitor.scale_factor();
    let w = monitor.size().width as f64 / scale;
    let h = monitor.size().height as f64 / scale;
    let x = monitor.position().x as f64 / scale;
    let y = monitor.position().y as f64 / scale;
    Some((x, y, w, h))
}

// ---- Pre-created overlay window ----

pub fn create_overlay_window<R: Runtime>(app: &AppHandle<R>) {
    let Some((x, y, w, h)) = logical_monitor_rect(app) else {
        eprintln!("Warning: could not get monitor info for overlay creation");
        return;
    };
    let _ = WebviewWindowBuilder::new(
        app,
        "capture-overlay",
        WebviewUrl::App("/".into()),
    )
    .title("Capture")
    .inner_size(w, h)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .visible(false)
    .position(x, y)
    .build();
}

// ---- Commands ----

#[tauri::command]
pub fn capture_get_screenshot(state: tauri::State<'_, CaptureState>) -> Result<String, String> {
    let guard = state.image.lock().map_err(|e| e.to_string())?;
    match guard.as_ref() {
        Some(img) => Ok(img_to_base64_png(img)),
        None => Err("No screenshot available".into()),
    }
}

#[tauri::command]
pub fn capture_crop_region(
    state: tauri::State<'_, CaptureState>,
    x: u32,
    y: u32,
    w: u32,
    h: u32,
) -> Result<String, String> {
    let mut guard = state.image.lock().map_err(|e| e.to_string())?;
    let mut img = guard.take().ok_or("No screenshot available")?;

    let iw = img.width();
    let ih = img.height();
    let cx = x.min(iw.saturating_sub(1));
    let cy = y.min(ih.saturating_sub(1));
    let cw = w.min(iw - cx);
    let ch = h.min(ih - cy);

    let cropped = image::imageops::crop(&mut img, cx, cy, cw, ch).to_image();
    let result = DynamicImage::ImageRgba8(cropped);
    Ok(img_to_base64_png(&result))
}

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

        let wx = match win.x() {
            Ok(v) => v,
            Err(_) => continue,
        };
        let wy = match win.y() {
            Ok(v) => v,
            Err(_) => continue,
        };
        let ww = match win.width() {
            Ok(v) => v as i32,
            Err(_) => continue,
        };
        let wh = match win.height() {
            Ok(v) => v as i32,
            Err(_) => continue,
        };

        if x >= wx && x < wx + ww && y >= wy && y < wy + wh {
            let img = win.capture_image().map_err(|e| e.to_string())?;
            let result = DynamicImage::ImageRgba8(img);
            return Ok(img_to_base64_png(&result));
        }
    }

    Err("No suitable window found at that position".into())
}

#[tauri::command]
pub fn capture_cancel(app: AppHandle, state: tauri::State<'_, CaptureState>) -> Result<(), String> {
    {
        let mut guard = state.image.lock().map_err(|e| e.to_string())?;
        *guard = None;
    }
    hide_overlay(&app);
    Ok(())
}

// ---- Window lifecycle ----

fn hide_overlay<R: Runtime>(app: &AppHandle<R>) {
    if let Some(win) = app.get_webview_window("capture-overlay") {
        let _ = app.emit("capture-reset", ());
        let _ = win.hide();
    }
}

fn show_sidebar<R: Runtime>(app: &AppHandle<R>) {
    if let Some(win) = app.get_webview_window("sidebar") {
        let _ = win.show();
        let _ = win.set_focus();
    } else {
        create_sidebar_window(app);
    }
}

fn create_sidebar_window<R: Runtime>(app: &AppHandle<R>) {
    let Some((screen_x, screen_y, screen_w, screen_h)) = logical_monitor_rect(app) else {
        return;
    };
    let sidebar_width = 380.0;
    let sidebar_height = (screen_h * 0.75).min(720.0);
    let margin = 16.0;
    let x = screen_x + screen_w - sidebar_width - margin;
    let y = screen_y + (screen_h - sidebar_height) / 2.0;

    let _ = WebviewWindowBuilder::new(
        app,
        "sidebar",
        WebviewUrl::App("/".into()),
    )
    .title("Desktop Teacher")
    .inner_size(sidebar_width, sidebar_height)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(true)
    .position(x, y)
    .build();
}

pub fn trigger_capture<R: Runtime>(app: &AppHandle<R>) {
    if let Some(win) = app.get_webview_window("sidebar") {
        let _ = win.hide();
    }
    if let Some(win) = app.get_webview_window("capture-overlay") {
        let _ = win.hide();
    }

    let app_handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(50));

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

        let state: tauri::State<CaptureState> = app_handle.state();
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

        if let Some(overlay) = app_handle.get_webview_window("capture-overlay") {
            let _ = overlay.show();
            let _ = overlay.set_focus();
        }

        let _ = app_handle.emit("capture-ready", ());
    });
}

#[tauri::command]
pub fn capture_confirm_selection(app: AppHandle, image_data: String) -> Result<(), String> {
    hide_overlay(&app);
    show_sidebar(&app);
    app.emit("capture-selected", image_data)
        .map_err(|e| e.to_string())
}
