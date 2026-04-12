use crate::window_utils;
/**
 * System tray icon + sidebar window management
 *
 * Left-click tray icon → toggle sidebar window
 * Right-click tray icon → context menu (Show / Hide / Quit)
 */
use tauri::{
    menu::{MenuBuilder, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime, WebviewUrl, WebviewWindowBuilder,
};

// ---------- Public ----------

pub fn create_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let show_i = MenuItem::with_id(app, "show", "显示侧边栏", true, None::<&str>)?;
    let hide_i = MenuItem::with_id(app, "hide", "隐藏侧边栏", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

    let menu = MenuBuilder::new(app)
        .item(&show_i)
        .item(&hide_i)
        .separator()
        .item(&quit_i)
        .build()?;

    let _tray = TrayIconBuilder::with_id("main-tray")
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("Desktop Teacher - AI 学习助手")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "show" => show_sidebar(app),
            "hide" => hide_sidebar(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                toggle_sidebar(app);
            }
        })
        .build(app)?;

    Ok(())
}

// ---------- Sidebar window helpers ----------

fn show_sidebar<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("sidebar") {
        let _ = window.show();
        let _ = window.set_focus();
    } else {
        create_sidebar_window(app);
    }
}

fn hide_sidebar<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("sidebar") {
        let _ = window.hide();
    }
}

fn toggle_sidebar<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("sidebar") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            window_utils::show_sidebar(app);
        }
    } else {
        create_sidebar_window(app);
    }
}

pub fn create_sidebar_window<R: Runtime>(app: &AppHandle<R>) {
    let Some((screen_x, screen_y, screen_w, screen_h)) = window_utils::logical_monitor_rect(app)
    else {
        return;
    };

    let sidebar_width = 380.0;
    let sidebar_height = (screen_h * 0.75).min(720.0);
    let margin = 16.0;
    let x = screen_x + screen_w - sidebar_width - margin;
    let y = screen_y + (screen_h - sidebar_height) / 2.0;

    let _ = WebviewWindowBuilder::new(app, "sidebar", WebviewUrl::App("/".into()))
        .title("Desktop Teacher")
        .inner_size(sidebar_width, sidebar_height)
        .decorations(false)
        .always_on_top(false)
        .skip_taskbar(true)
        .resizable(true)
        .visible(false)
        .position(x, y)
        .build();
}

#[tauri::command]
pub fn toggle_always_on_top(app: AppHandle) -> Result<bool, String> {
    let win = app
        .get_webview_window("sidebar")
        .ok_or("sidebar window not found")?;
    let current = win.is_always_on_top().map_err(|e| e.to_string())?;
    let new_state = !current;
    win.set_always_on_top(new_state)
        .map_err(|e| e.to_string())?;
    Ok(new_state)
}
