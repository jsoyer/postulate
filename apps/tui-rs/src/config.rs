#![allow(dead_code)]

use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct Config {
    pub api: ApiConfig,
    #[serde(default)]
    pub ui: UiConfig,
}

#[derive(Deserialize)]
pub struct ApiConfig {
    pub base_url: String,
    pub api_key: String,
    #[serde(default = "default_timeout")]
    pub timeout_secs: u64,
}

impl std::fmt::Debug for ApiConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ApiConfig")
            .field("base_url", &self.base_url)
            .field("api_key", &"[REDACTED]")
            .field("timeout_secs", &self.timeout_secs)
            .finish()
    }
}

#[derive(Debug, Deserialize)]
pub struct UiConfig {
    #[serde(default = "default_theme")]
    pub theme: String,
}

impl Default for UiConfig {
    fn default() -> Self {
        Self {
            theme: default_theme(),
        }
    }
}

fn default_timeout() -> u64 {
    30
}

fn default_theme() -> String {
    "catppuccin-mocha".to_string()
}

impl Config {
    /// Apply environment-variable overrides on top of the loaded configuration.
    ///
    /// The following variables are honoured:
    ///
    /// | Variable    | Field overridden          |
    /// |-------------|---------------------------|
    /// | `CV_API_URL`  | `api.base_url`            |
    /// | `CV_API_KEY`  | `api.api_key`             |
    /// | `CV_TIMEOUT`  | `api.timeout_secs` (u64)  |
    pub fn apply_env_overrides(&mut self) {
        if let Ok(url) = std::env::var("CV_API_URL") {
            if !url.is_empty() {
                self.api.base_url = url;
            }
        }
        if let Ok(key) = std::env::var("CV_API_KEY") {
            if !key.is_empty() {
                self.api.api_key = key;
            }
        }
        if let Ok(timeout_str) = std::env::var("CV_TIMEOUT") {
            if let Ok(secs) = timeout_str.parse::<u64>() {
                self.api.timeout_secs = secs;
            }
        }
    }

    /// Load configuration from a specific path.
    #[allow(clippy::result_large_err)]
    pub fn load_from(path: &str) -> crate::error::Result<Self> {
        let content = std::fs::read_to_string(path)
            .map_err(|e| crate::error::AppError::Config(format!("failed to read {path}: {e}")))?;
        let config: Config = toml::from_str(&content)?;
        Ok(config)
    }

    /// Load configuration from ~/.config/cv/config.toml
    #[allow(clippy::result_large_err)]
    pub fn load() -> crate::error::Result<Self> {
        let path = dirs::config_dir()
            .ok_or_else(|| crate::error::AppError::Config("no config directory found".into()))?
            .join("cv")
            .join("config.toml");

        let content = std::fs::read_to_string(&path).map_err(|e| {
            crate::error::AppError::Config(format!("failed to read {}: {}", path.display(), e))
        })?;

        let config: Config = toml::from_str(&content)?;
        Ok(config)
    }
}
