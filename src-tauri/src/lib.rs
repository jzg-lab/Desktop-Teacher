mod tray;

use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use tauri::Manager;

// ---- Data types matching TS types ----

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConversationMeta {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConversationIndex {
    pub conversations: Vec<ConversationMeta>,
    pub last_updated: String,
}

impl Default for ConversationIndex {
    fn default() -> Self {
        Self {
            conversations: Vec::new(),
            last_updated: chrono::Utc::now().to_rfc3339(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Turn {
    pub id: String,
    pub conversation_id: String,
    pub role: String,
    pub content: String,
    pub route_type: Option<String>,
    pub created_at: String,
}

// ---- Storage helpers ----

fn data_dir(app: &tauri::AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .expect("Failed to resolve app data dir");
    let conv_dir = dir.join("conversations");
    fs::create_dir_all(&conv_dir).expect("Failed to create conversations dir");
    conv_dir
}

fn index_path(app: &tauri::AppHandle) -> PathBuf {
    data_dir(app).join("conversations-index.json")
}

fn read_index(app: &tauri::AppHandle) -> ConversationIndex {
    let path = index_path(app);
    if path.exists() {
        let content = fs::read_to_string(&path).expect("Failed to read index");
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        ConversationIndex::default()
    }
}

fn write_index(app: &tauri::AppHandle, index: &ConversationIndex) {
    let path = index_path(app);
    let content = serde_json::to_string_pretty(index).expect("Failed to serialize index");
    fs::write(&path, content).expect("Failed to write index");
}

fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

fn now_rfc3339() -> String {
    chrono::Utc::now().to_rfc3339()
}

// ---- Tauri commands ----

#[tauri::command]
fn storage_load_index(app: tauri::AppHandle) -> ConversationIndex {
    read_index(&app)
}

#[tauri::command]
fn storage_save_index(app: tauri::AppHandle, index: ConversationIndex) {
    write_index(&app, &index);
}

#[tauri::command]
fn storage_create_conversation(app: tauri::AppHandle, title: String) -> ConversationMeta {
    let id = new_id();
    let now = now_rfc3339();
    let meta = ConversationMeta {
        id: id.clone(),
        title,
        created_at: now.clone(),
        updated_at: now,
        status: "active".to_string(),
    };

    let base = data_dir(&app).join(&id);
    fs::create_dir_all(&base).expect("Failed to create conversation dir");
    fs::create_dir_all(base.join("attachments")).expect("Failed to create attachments dir");

    let meta_json = serde_json::to_string_pretty(&meta).expect("Failed to serialize meta");
    fs::write(base.join("meta.json"), meta_json).expect("Failed to write meta");

    let empty_turns: Vec<Turn> = Vec::new();
    let turns_json = serde_json::to_string_pretty(&empty_turns).expect("Failed to serialize turns");
    fs::write(base.join("messages.json"), turns_json).expect("Failed to write messages");

    let mut index = read_index(&app);
    index.conversations.insert(0, meta.clone());
    index.last_updated = now_rfc3339();
    write_index(&app, &index);

    meta
}

#[tauri::command]
fn storage_get_conversation(app: tauri::AppHandle, id: String) -> Option<ConversationMeta> {
    let path = data_dir(&app).join(&id).join("meta.json");
    if path.exists() {
        let content = fs::read_to_string(&path).ok()?;
        serde_json::from_str(&content).ok()
    } else {
        None
    }
}

#[tauri::command]
fn storage_update_conversation_title(app: tauri::AppHandle, id: String, title: String) {
    let base = data_dir(&app).join(&id);
    let meta_path = base.join("meta.json");
    if let Ok(content) = fs::read_to_string(&meta_path) {
        let mut meta: ConversationMeta =
            serde_json::from_str(&content).expect("Failed to parse meta");
        meta.title = title;
        meta.updated_at = now_rfc3339();
        let updated = serde_json::to_string_pretty(&meta).expect("Failed to serialize meta");
        fs::write(meta_path, updated).expect("Failed to write meta");

        let mut index = read_index(&app);
        if let Some(entry) = index.conversations.iter_mut().find(|c| c.id == id) {
            entry.title = meta.title.clone();
            entry.updated_at = meta.updated_at.clone();
        }
        index.last_updated = now_rfc3339();
        write_index(&app, &index);
    }
}

#[tauri::command]
fn storage_delete_conversation(app: tauri::AppHandle, id: String) {
    let base = data_dir(&app).join(&id);
    if base.exists() {
        fs::remove_dir_all(base).expect("Failed to delete conversation dir");
    }

    let mut index = read_index(&app);
    index.conversations.retain(|c| c.id != id);
    index.last_updated = now_rfc3339();
    write_index(&app, &index);
}

#[tauri::command]
fn storage_load_turns(app: tauri::AppHandle, conversation_id: String) -> Vec<Turn> {
    let path = data_dir(&app).join(&conversation_id).join("messages.json");
    if path.exists() {
        let content = fs::read_to_string(&path).expect("Failed to read turns");
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        Vec::new()
    }
}

#[tauri::command]
fn storage_append_turn(
    app: tauri::AppHandle,
    conversation_id: String,
    role: String,
    content: String,
    route_type: Option<String>,
) -> Turn {
    let turn = Turn {
        id: new_id(),
        conversation_id: conversation_id.clone(),
        role,
        content,
        route_type,
        created_at: now_rfc3339(),
    };

    let path = data_dir(&app).join(&conversation_id).join("messages.json");
    let mut turns: Vec<Turn> = if path.exists() {
        let file_content = fs::read_to_string(&path).expect("Failed to read turns");
        serde_json::from_str(&file_content).unwrap_or_default()
    } else {
        Vec::new()
    };

    turns.push(turn.clone());
    let turns_json = serde_json::to_string_pretty(&turns).expect("Failed to serialize turns");
    fs::write(&path, turns_json).expect("Failed to write turns");

    let mut index = read_index(&app);
    if let Some(entry) = index.conversations.iter_mut().find(|c| c.id == conversation_id) {
        entry.updated_at = now_rfc3339();
    }
    index.last_updated = now_rfc3339();
    write_index(&app, &index);

    turn
}

// ---- App entry ----

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            if let Err(e) = tray::create_tray(app.handle()) {
                eprintln!("Warning: tray icon unavailable ({}) — running without system tray", e);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            storage_load_index,
            storage_save_index,
            storage_create_conversation,
            storage_get_conversation,
            storage_update_conversation_title,
            storage_delete_conversation,
            storage_load_turns,
            storage_append_turn,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
