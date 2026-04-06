/**
 * System tray icon + sidebar window management
 *
 * Left-click tray icon → toggle sidebar window
 * Right-click tray icon → context menu (Show / Hide / Quit)
 */

use tauri::{
    AppHandle, Manager, Runtime,
    menu::{MenuBuilder, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    WebviewUrl, WebviewWindowBuilder,
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
            let _ = window.show();
            let _ = window.set_focus();
        }
    } else {
        create_sidebar_window(app);
    }
}

fn create_sidebar_window<R: Runtime>(app: &AppHandle<R>) {
    // Position the sidebar at the right edge of the primary monitor
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
}
