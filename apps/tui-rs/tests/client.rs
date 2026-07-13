// Real ApiClient tests are inline in src/api/client.rs under #[cfg(test)].
// This file exists to satisfy the project-level integration-test layout.
// Binary crates expose no lib target, so integration tests cannot import
// internal modules; unit tests live alongside the production code instead.
