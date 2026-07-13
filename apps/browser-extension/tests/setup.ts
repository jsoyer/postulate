// Global test setup — provides chrome.* stubs for extension modules
;(globalThis as Record<string, unknown>).chrome = {
  runtime: {
    sendMessage: () => Promise.resolve({}),
    onMessage: {
      addListener: () => {},
    },
    onInstalled: {
      addListener: () => {},
    },
    onStartup: {
      addListener: () => {},
    },
    getURL: (path: string) => `chrome-extension://test/${path}`,
    lastError: null,
  },
  action: {
    setBadgeText: () => {},
    setBadgeBackgroundColor: () => {},
  },
  notifications: {
    create: () => {},
  },
  tabs: {
    query: () => Promise.resolve([]),
    sendMessage: () => Promise.resolve(undefined),
  },
  alarms: {
    create: () => {},
    onAlarm: {
      addListener: () => {},
    },
  },
  storage: {
    sync: {
      get: () => {},
      set: () => {},
    },
    local: {
      get: () => {},
      set: () => {},
    },
  },
}
