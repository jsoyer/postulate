package handlers

import (
	"net/http"
	"os"
)

const openapiPath = "docs/openapi.yml"

const swaggerUIHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>cv-api — API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "/docs/openapi.yml",
      dom_id: "#swagger-ui",
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: "BaseLayout"
    });
  </script>
</body>
</html>
`

// DocsHandler serves the OpenAPI spec and Swagger UI.
type DocsHandler struct{}

// NewDocsHandler creates a new DocsHandler.
func NewDocsHandler() *DocsHandler {
	return &DocsHandler{}
}

// ServeSpec serves the OpenAPI YAML spec at GET /docs/openapi.yml.
func (h *DocsHandler) ServeSpec(w http.ResponseWriter, r *http.Request) {
	data, err := os.ReadFile(openapiPath)
	if err != nil {
		if os.IsNotExist(err) {
			respondError(w, http.StatusNotFound, "OpenAPI spec not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to read OpenAPI spec")
		return
	}

	w.Header().Set("Content-Type", "application/yaml")
	w.WriteHeader(http.StatusOK)
	w.Write(data) //nolint:errcheck
}

// ServeUI serves a minimal Swagger UI HTML page at GET /docs.
func (h *DocsHandler) ServeUI(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(swaggerUIHTML)) //nolint:errcheck
}
