package api

import (
	"net/url"
	"time"
)

const (
	ttlApplications = 60 * time.Second
	ttlDashboard    = 60 * time.Second
	ttlStats        = 60 * time.Second
)

// ListApplications fetches all applications from the API.
func (c *Client) ListApplications() ([]Application, error) {
	const cacheKey = "applications:all"
	if cached, ok := c.cacheGet(cacheKey); ok {
		if apps, ok := cached.([]Application); ok {
			return apps, nil
		}
	}
	var apps []Application
	if err := c.get("/api/applications", &apps); err != nil {
		return nil, err
	}
	if apps == nil {
		apps = []Application{}
	}
	c.cacheSet(cacheKey, apps, ttlApplications)
	return apps, nil
}

// ListApplicationsByStatus fetches applications filtered by status.
// Valid statuses: applied, interview, offer, rejected, ghosted, archived.
func (c *Client) ListApplicationsByStatus(status string) ([]Application, error) {
	cacheKey := "applications:" + status
	if cached, ok := c.cacheGet(cacheKey); ok {
		if apps, ok := cached.([]Application); ok {
			return apps, nil
		}
	}
	var apps []Application
	if err := c.get("/api/applications?status="+url.QueryEscape(status), &apps); err != nil {
		return nil, err
	}
	if apps == nil {
		apps = []Application{}
	}
	c.cacheSet(cacheKey, apps, ttlApplications)
	return apps, nil
}

// GetApplication fetches a single application by name.
func (c *Client) GetApplication(name string) (*Application, error) {
	var app Application
	if err := c.get("/api/applications/"+url.PathEscape(name), &app); err != nil {
		return nil, err
	}
	return &app, nil
}

// CreateApplication creates a new application.
func (c *Client) CreateApplication(company, position, appURL string) (*Application, error) {
	body := map[string]string{
		"company":  company,
		"position": position,
		"url":      appURL,
	}
	var app Application
	if err := c.post("/api/applications", body, &app); err != nil {
		return nil, err
	}
	c.cacheInvalidate("applications:all", "dashboard", "stats")
	c.cacheInvalidatePrefix("applications:")
	return &app, nil
}

// UpdateApplicationStatus updates the status of an application via PATCH.
func (c *Client) UpdateApplicationStatus(name, status string) error {
	body := map[string]string{"status": status}
	if err := c.patch("/api/applications/"+url.PathEscape(name), body, nil); err != nil {
		return err
	}
	c.cacheInvalidate("applications:all", "dashboard", "stats")
	c.cacheInvalidatePrefix("applications:")
	return nil
}

// GetDashboard fetches aggregated dashboard data.
func (c *Client) GetDashboard() (*DashboardData, error) {
	if cached, ok := c.cacheGet("dashboard"); ok {
		if data, ok := cached.(*DashboardData); ok {
			return data, nil
		}
	}
	var data DashboardData
	if err := c.get("/api/dashboard", &data); err != nil {
		return nil, err
	}
	c.cacheSet("dashboard", &data, ttlDashboard)
	return &data, nil
}

// GetStats fetches pipeline statistics.
func (c *Client) GetStats() (*StatsData, error) {
	if cached, ok := c.cacheGet("stats"); ok {
		if data, ok := cached.(*StatsData); ok {
			return data, nil
		}
	}
	var data StatsData
	if err := c.get("/api/stats", &data); err != nil {
		return nil, err
	}
	c.cacheSet("stats", &data, ttlStats)
	return &data, nil
}
