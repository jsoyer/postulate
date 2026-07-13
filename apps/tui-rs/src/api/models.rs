#![allow(dead_code)]

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Application {
    pub name: String,
    pub company: String,
    pub position: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub deadline: Option<DateTime<Utc>>,
    pub outcome: Option<String>,
    pub files: Option<HashMap<String, String>>,
}

#[derive(Debug, Serialize)]
pub struct ActionRequest {
    pub target: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub application: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub args: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ActionResult {
    pub job_id: String,
    pub target: String,
    pub status: String,
    pub exit_code: i32,
    pub stdout: Option<String>,
    pub stderr: Option<String>,
    pub duration_ms: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct WsMessage {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Target {
    pub name: String,
    pub category: String,
    pub description: String,
    pub args: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardData {
    pub total_applications: i32,
    pub by_status: HashMap<String, i32>,
    pub recent_applications: Vec<Application>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatsData {
    pub funnel: HashMap<String, i32>,
    pub timeline: Vec<TimelineEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineEntry {
    pub date: String,
    pub count: i32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ApiError {
    pub code: i32,
    pub message: String,
}
