//! HTTP client with TTL cache and retry logic for the cv-api backend.

use std::collections::HashMap;
use std::time::{Duration, Instant};

use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use tokio::sync::{mpsc::UnboundedSender, Mutex};
use tokio_tungstenite::{
    connect_async, tungstenite::client::IntoClientRequest, tungstenite::http::HeaderValue,
    tungstenite::protocol::Message,
};

use std::sync::Arc;

use urlencoding::encode as url_encode;

use crate::api::models::{
    ActionRequest, ActionResult, Application, DashboardData, StatsData, Target, WsMessage,
};
use crate::error::{AppError, Result};

// ---------------------------------------------------------------------------
// Cache internals
// ---------------------------------------------------------------------------

/// A single cached value with an expiry timestamp.
struct CacheEntry {
    value: Value,
    expires: Instant,
}

impl CacheEntry {
    fn is_valid(&self) -> bool {
        Instant::now() < self.expires
    }
}

type Cache = Arc<Mutex<HashMap<String, CacheEntry>>>;

/// Named cache-key constants used throughout the client.
const KEY_APPLICATIONS: &str = "applications";
const KEY_DASHBOARD: &str = "dashboard";
const KEY_STATS: &str = "stats";
const KEY_TARGETS: &str = "targets";

const TTL_APPLICATIONS: Duration = Duration::from_secs(60);
const TTL_DASHBOARD: Duration = Duration::from_secs(60);
const TTL_STATS: Duration = Duration::from_secs(60);
const TTL_TARGETS: Duration = Duration::from_secs(300);

// ---------------------------------------------------------------------------
// Retry configuration
// ---------------------------------------------------------------------------

const RETRY_ATTEMPTS: u32 = 3;
const RETRY_BASE_DELAY_MS: u64 = 500;

// ---------------------------------------------------------------------------
// ApiClient
// ---------------------------------------------------------------------------

/// Async HTTP client for the cv-api backend.
///
/// Cloning the client is cheap — the underlying `reqwest::Client`, cache, and
/// configuration are all reference-counted and shared across clones.
#[derive(Clone)]
pub struct ApiClient {
    base_url: String,
    api_key: String,
    http: reqwest::Client,
    cache: Cache,
}

impl ApiClient {
    /// Construct a new client.
    ///
    /// # Errors
    ///
    /// Returns an error if the underlying `reqwest` client cannot be built
    /// (e.g. invalid TLS configuration).
    #[allow(clippy::result_large_err)]
    pub fn new(base_url: String, api_key: String, timeout_secs: u64) -> Result<Self> {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(timeout_secs))
            .build()?;

        Ok(Self {
            base_url,
            api_key,
            http,
            cache: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    /// Return the configured base URL.
    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    /// Return the configured API key (crate-internal use only).
    pub(crate) fn api_key(&self) -> &str {
        &self.api_key
    }

    /// Return a reference to the underlying `reqwest::Client`.
    pub fn http(&self) -> &reqwest::Client {
        &self.http
    }

    // -----------------------------------------------------------------------
    // Cache helpers
    // -----------------------------------------------------------------------

    /// Attempt to deserialise a cached value for `key`.
    ///
    /// Returns `None` when the key is absent or has expired.
    async fn cache_get<T>(&self, key: &str) -> Option<T>
    where
        T: serde::de::DeserializeOwned,
    {
        let guard = self.cache.lock().await;
        let entry = guard.get(key)?;
        if !entry.is_valid() {
            return None;
        }
        serde_json::from_value(entry.value.clone()).ok()
    }

    /// Store a serialisable value under `key` with the given TTL.
    async fn cache_set<T>(&self, key: &str, value: &T, ttl: Duration)
    where
        T: serde::Serialize,
    {
        let Ok(json) = serde_json::to_value(value) else {
            return;
        };
        let entry = CacheEntry {
            value: json,
            expires: Instant::now() + ttl,
        };
        self.cache.lock().await.insert(key.to_string(), entry);
    }

    /// Evict one or more cache keys.
    async fn cache_invalidate(&self, keys: &[&str]) {
        let mut guard = self.cache.lock().await;
        for key in keys {
            guard.remove(*key);
        }
    }

    // -----------------------------------------------------------------------
    // Retry-aware GET
    // -----------------------------------------------------------------------

    /// Send a GET request to `url`, retrying on connection/timeout errors.
    ///
    /// Three attempts with exponential back-off (500 ms, 1 000 ms) are made
    /// before the error is surfaced to the caller.  HTTP-level errors (4xx /
    /// 5xx) are *not* retried.
    async fn get_with_retry(&self, url: &str) -> Result<reqwest::Response> {
        let mut delay = RETRY_BASE_DELAY_MS;

        for attempt in 0..RETRY_ATTEMPTS {
            let result = self
                .http
                .get(url)
                .header("X-API-Key", &self.api_key)
                .send()
                .await;

            match result {
                Ok(resp) => return Ok(resp),
                Err(e) if attempt + 1 < RETRY_ATTEMPTS && (e.is_connect() || e.is_timeout()) => {
                    tokio::time::sleep(Duration::from_millis(delay)).await;
                    delay *= 2;
                }
                Err(e) => return Err(AppError::Http(e)),
            }
        }

        // Unreachable: the loop always returns, but the compiler needs a path.
        Err(AppError::Api("retry loop exhausted".to_string()))
    }

    /// Send a POST request to `url`, retrying on connection/timeout errors.
    async fn post_with_retry<B>(&self, url: &str, body: &B) -> Result<reqwest::Response>
    where
        B: serde::Serialize,
    {
        let mut delay = RETRY_BASE_DELAY_MS;

        for attempt in 0..RETRY_ATTEMPTS {
            let result = self
                .http
                .post(url)
                .header("X-API-Key", &self.api_key)
                .json(body)
                .send()
                .await;

            match result {
                Ok(resp) => return Ok(resp),
                Err(e) if attempt + 1 < RETRY_ATTEMPTS && (e.is_connect() || e.is_timeout()) => {
                    tokio::time::sleep(Duration::from_millis(delay)).await;
                    delay *= 2;
                }
                Err(e) => return Err(AppError::Http(e)),
            }
        }

        Err(AppError::Api("retry loop exhausted".to_string()))
    }

    // -----------------------------------------------------------------------
    // Error extraction
    // -----------------------------------------------------------------------

    /// Convert a non-2xx response into an `AppError::Api`.
    ///
    /// Attempts to parse the body as `{"message": "..."}` first; falls back
    /// to the raw body text.
    async fn error_from_response(resp: reqwest::Response) -> AppError {
        let status = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();

        // Try to extract a structured message from the response.
        let message = serde_json::from_str::<serde_json::Value>(&body)
            .ok()
            .and_then(|v| {
                v.get("message")
                    .and_then(|m| m.as_str())
                    .map(str::to_string)
            })
            .unwrap_or_else(|| body.clone());

        AppError::Api(format!("HTTP {status}: {message}"))
    }

    // -----------------------------------------------------------------------
    // Health
    // -----------------------------------------------------------------------

    /// Check that the API is reachable.
    ///
    /// Returns `true` when the server responds with HTTP 200, `false`
    /// otherwise.  Network errors are propagated.
    pub async fn health(&self) -> Result<bool> {
        let url = format!("{}/health", self.base_url);
        let resp = self.get_with_retry(&url).await?;
        Ok(resp.status().as_u16() == 200)
    }

    // -----------------------------------------------------------------------
    // Applications
    // -----------------------------------------------------------------------

    /// Fetch all applications, using a 60-second in-memory cache.
    pub async fn list_applications(&self) -> Result<Vec<Application>> {
        if let Some(cached) = self.cache_get::<Vec<Application>>(KEY_APPLICATIONS).await {
            return Ok(cached);
        }

        let url = format!("{}/api/applications", self.base_url);
        let resp = self.get_with_retry(&url).await?;

        if resp.status().is_client_error() || resp.status().is_server_error() {
            return Err(Self::error_from_response(resp).await);
        }

        let apps: Vec<Application> = resp.json().await?;
        self.cache_set(KEY_APPLICATIONS, &apps, TTL_APPLICATIONS)
            .await;
        Ok(apps)
    }

    /// Fetch a single application by its slug name.
    pub async fn get_application(&self, name: &str) -> Result<Application> {
        let url = format!("{}/api/applications/{}", self.base_url, url_encode(name));
        let resp = self.get_with_retry(&url).await?;

        if resp.status().is_client_error() || resp.status().is_server_error() {
            return Err(Self::error_from_response(resp).await);
        }

        let app: Application = resp.json().await?;
        Ok(app)
    }

    /// Create a new application.
    ///
    /// Invalidates the `applications` cache so the next
    /// [`list_applications`](Self::list_applications) call fetches fresh data.
    pub async fn create_application(
        &self,
        company: &str,
        position: &str,
        url: Option<&str>,
    ) -> Result<Application> {
        #[derive(serde::Serialize)]
        struct CreateBody<'a> {
            company: &'a str,
            position: &'a str,
            #[serde(skip_serializing_if = "Option::is_none")]
            url: Option<&'a str>,
        }

        let api_url = format!("{}/api/applications", self.base_url);
        let body = CreateBody {
            company,
            position,
            url,
        };

        let resp = self.post_with_retry(&api_url, &body).await?;

        if resp.status().is_client_error() || resp.status().is_server_error() {
            return Err(Self::error_from_response(resp).await);
        }

        let app: Application = resp.json().await?;
        self.cache_invalidate(&[KEY_APPLICATIONS]).await;
        Ok(app)
    }

    // -----------------------------------------------------------------------
    // Dashboard
    // -----------------------------------------------------------------------

    /// Fetch aggregated dashboard data, using a 60-second cache.
    pub async fn get_dashboard(&self) -> Result<DashboardData> {
        if let Some(cached) = self.cache_get::<DashboardData>(KEY_DASHBOARD).await {
            return Ok(cached);
        }

        let url = format!("{}/api/dashboard", self.base_url);
        let resp = self.get_with_retry(&url).await?;

        if resp.status().is_client_error() || resp.status().is_server_error() {
            return Err(Self::error_from_response(resp).await);
        }

        let data: DashboardData = resp.json().await?;
        self.cache_set(KEY_DASHBOARD, &data, TTL_DASHBOARD).await;
        Ok(data)
    }

    // -----------------------------------------------------------------------
    // Stats
    // -----------------------------------------------------------------------

    /// Fetch pipeline statistics, using a 60-second cache.
    pub async fn get_stats(&self) -> Result<StatsData> {
        if let Some(cached) = self.cache_get::<StatsData>(KEY_STATS).await {
            return Ok(cached);
        }

        let url = format!("{}/api/stats", self.base_url);
        let resp = self.get_with_retry(&url).await?;

        if resp.status().is_client_error() || resp.status().is_server_error() {
            return Err(Self::error_from_response(resp).await);
        }

        let data: StatsData = resp.json().await?;
        self.cache_set(KEY_STATS, &data, TTL_STATS).await;
        Ok(data)
    }

    // -----------------------------------------------------------------------
    // Targets
    // -----------------------------------------------------------------------

    /// Fetch the list of Make targets, using a 5-minute cache.
    pub async fn list_targets(&self) -> Result<Vec<Target>> {
        if let Some(cached) = self.cache_get::<Vec<Target>>(KEY_TARGETS).await {
            return Ok(cached);
        }

        let url = format!("{}/api/targets", self.base_url);
        let resp = self.get_with_retry(&url).await?;

        if resp.status().is_client_error() || resp.status().is_server_error() {
            return Err(Self::error_from_response(resp).await);
        }

        let targets: Vec<Target> = resp.json().await?;
        self.cache_set(KEY_TARGETS, &targets, TTL_TARGETS).await;
        Ok(targets)
    }

    // -----------------------------------------------------------------------
    // Actions — HTTP
    // -----------------------------------------------------------------------

    /// Execute a Make target synchronously via HTTP POST.
    ///
    /// Invalidates the `applications`, `dashboard`, and `stats` caches so
    /// subsequent reads reflect any side-effects of the action.
    pub async fn execute_action(
        &self,
        target: &str,
        app_name: Option<&str>,
        args: Option<HashMap<String, String>>,
    ) -> Result<ActionResult> {
        let url = format!("{}/api/actions/{}", self.base_url, url_encode(target));
        let body = ActionRequest {
            target: target.to_string(),
            application: app_name.map(str::to_string),
            args,
        };

        let resp = self.post_with_retry(&url, &body).await?;

        if resp.status().is_client_error() || resp.status().is_server_error() {
            return Err(Self::error_from_response(resp).await);
        }

        let result: ActionResult = resp.json().await?;
        self.cache_invalidate(&[KEY_APPLICATIONS, KEY_DASHBOARD, KEY_STATS])
            .await;
        Ok(result)
    }

    // -----------------------------------------------------------------------
    // Actions — WebSocket streaming
    // -----------------------------------------------------------------------

    /// Stream action output over WebSocket, forwarding each message directly
    /// into the application's message channel.
    ///
    /// The `http://` / `https://` scheme in `base_url` is automatically
    /// converted to `ws://` / `wss://`.  Authentication is provided via the
    /// `X-API-Key` request header, sent during the WebSocket upgrade handshake.
    ///
    /// Each JSON frame is parsed as a [`WsMessage`].  `"stdout"` and
    /// `"stderr"` frames emit [`AppMsg::ActionOutput`]; an `"exit"` or
    /// `"error"` frame emits [`AppMsg::ActionDone`] (or [`AppMsg::ActionError`]
    /// for the error case).  The cache entries for applications, dashboard, and
    /// stats are invalidated on a clean exit.
    pub async fn stream_action(
        &self,
        target: &str,
        app_name: Option<&str>,
        tx: UnboundedSender<crate::app::AppMsg>,
    ) -> Result<()> {
        let ws_base = self
            .base_url
            .replace("https://", "wss://")
            .replace("http://", "ws://");

        let ws_url = format!("{}/ws/actions/{}", ws_base, url_encode(target));

        let mut ws_request = ws_url.into_client_request()?;
        ws_request.headers_mut().insert(
            "X-API-Key",
            HeaderValue::from_str(&self.api_key)
                .map_err(|e| AppError::Api(format!("invalid api key header: {e}")))?,
        );
        let (ws_stream, _) = connect_async(ws_request).await?;
        let (mut write, mut read) = ws_stream.split();

        // Send the initial request payload.
        let req = ActionRequest {
            target: target.to_string(),
            application: app_name.map(str::to_string),
            args: None,
        };
        let json = serde_json::to_string(&req)?;
        write.send(Message::Text(json.into())).await?;

        while let Some(msg_result) = read.next().await {
            let msg = match msg_result {
                Ok(m) => m,
                Err(_) => break,
            };

            let text = match msg {
                Message::Text(t) => t.to_string(),
                Message::Binary(b) => match String::from_utf8(b.to_vec()) {
                    Ok(s) => s,
                    Err(_) => continue,
                },
                Message::Close(_) => break,
                _ => continue,
            };

            let ws_msg: WsMessage = match serde_json::from_str(&text) {
                Ok(m) => m,
                Err(_) => continue,
            };

            match ws_msg.msg_type.as_str() {
                "stdout" | "stderr" => {
                    for line in ws_msg.data.lines() {
                        let _ = tx.send(crate::app::AppMsg::ActionOutput(line.to_string()));
                    }
                }
                "exit" => {
                    self.cache_invalidate(&[KEY_APPLICATIONS, KEY_DASHBOARD, KEY_STATS])
                        .await;
                    let _ = tx.send(crate::app::AppMsg::ActionDone);
                    break;
                }
                "error" => {
                    let _ = tx.send(crate::app::AppMsg::ActionError(ws_msg.data));
                    break;
                }
                _ => {
                    // Unknown frame type — forward data as output, keep reading.
                    if !ws_msg.data.is_empty() {
                        let _ = tx.send(crate::app::AppMsg::ActionOutput(ws_msg.data.to_string()));
                    }
                }
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn api_key_returns_configured_value() {
        let client = ApiClient::new(
            "http://localhost:8080".to_string(),
            "test-key-123".to_string(),
            30,
        )
        .unwrap();
        assert_eq!(client.api_key(), "test-key-123");
    }
}
