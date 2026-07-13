package api

// GetSettings fetches current user settings.
func (c *Client) GetSettings() (map[string]any, error) {
	var settings map[string]any
	if err := c.get("/api/settings", &settings); err != nil {
		return nil, err
	}
	return settings, nil
}

// UpdateSettings updates user settings (PUT /api/settings).
func (c *Client) UpdateSettings(settings map[string]any) (map[string]any, error) {
	var result map[string]any
	if err := c.put("/api/settings", settings, &result); err != nil {
		return nil, err
	}
	return result, nil
}
