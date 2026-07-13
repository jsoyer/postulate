# CV Pipeline — Privacy Policy

Last updated: 2026-06-26

## Summary

CV Pipeline does not collect, transmit, or share any personal data with the extension developer or any third party.

## Data collected and where it goes

When you click "Add to Pipeline" on a job page, the extension reads the following data from the current web page:

| Data | Source | Destination |
|---|---|---|
| Company name | Job page DOM | Your cv-api instance only |
| Job title / position | Job page DOM | Your cv-api instance only |
| Job description text | Job page DOM | Your cv-api instance only |
| Job page URL | Browser tab | Your cv-api instance only |

This data is sent only to the cv-api URL you configure in the extension settings. The destination is a server you control — the extension developer has no access to it.

## Local storage

The extension stores the following data locally in your browser using the storage.local API:

- API URL and API Key — connection credentials you enter in Settings
- Extension preferences — badge count toggle, follow-up notifications toggle
- Offline job queue — job entries awaiting retry when the API is temporarily unavailable

None of this data leaves your browser except to reach the cv-api URL you configured.

## Permissions

| Permission | Purpose |
|---|---|
| activeTab | Read the job posting page to extract data |
| storage | Save your settings and offline queue locally |
| notifications | Display pipeline progress and follow-up reminders |
| alarms | Schedule periodic retries and reminder checks |
| tabs | Send progress messages from the background to the content script |
| Host permissions (LinkedIn, Indeed, WttJ) | Inject the action button on supported job boards only |

## Third-party services

None. The extension does not use any analytics, crash reporting, or telemetry service.

## Contact

This extension is open-source. For questions or concerns, open an issue at:
https://github.com/jsoyer/cv-browser-extension
