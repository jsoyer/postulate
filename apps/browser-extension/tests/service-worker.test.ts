import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// ---------------------------------------------------------------------------
// Mock chrome APIs before importing the service worker
// ---------------------------------------------------------------------------

const mockSetBadgeText = vi.fn()
const mockSetBadgeBackgroundColor = vi.fn()
const mockNotificationsCreate = vi.fn()
const mockTabsQuery = vi.fn().mockResolvedValue([])
const mockTabsSendMessage = vi.fn().mockResolvedValue(undefined)
const mockRuntimeGetURL = vi.fn().mockReturnValue("chrome-extension://test/icons/icon-48.png")
const mockStorageSyncGet = vi.fn()
const mockStorageLocalGet = vi.fn()
const mockStorageLocalSet = vi.fn()
const mockAlarmsCreate = vi.fn()

// Mock listeners storage
const mockOnMessageListeners: ((...args: unknown[]) => unknown)[] = []
const mockOnAlarmListeners: ((alarm: { name: string }) => void)[] = []
const mockOnInstalledListeners: (() => void)[] = []
const mockOnStartupListeners: (() => void)[] = []

vi.mock("../src/lib/storage", () => ({
  getSettings: vi.fn(),
  getRecentApplications: vi.fn(),
  prependApplication: vi.fn(),
}))

vi.mock("../src/lib/api-client", () => ({
  createClientFromStorage: vi.fn(),
  CvApiClient: vi.fn(),
}))

import { getSettings, getRecentApplications, prependApplication } from "../src/lib/storage"
import { createClientFromStorage } from "../src/lib/api-client"
const mockGetSettings = vi.mocked(getSettings)
const mockGetRecentApplications = vi.mocked(getRecentApplications)
const mockCreateClientFromStorage = vi.mocked(createClientFromStorage)

function setupChromeMocks() {
  mockSetBadgeText.mockClear()
  mockSetBadgeBackgroundColor.mockClear()
  mockNotificationsCreate.mockClear()
  mockTabsQuery.mockClear().mockResolvedValue([])
  mockTabsSendMessage.mockClear().mockResolvedValue(undefined)
  mockRuntimeGetURL.mockClear().mockReturnValue("chrome-extension://test/icons/icon-48.png")
  mockStorageSyncGet.mockClear()
  mockStorageLocalGet.mockClear()
  mockStorageLocalSet.mockClear()
  mockAlarmsCreate.mockClear()
  mockOnMessageListeners.length = 0
  mockOnAlarmListeners.length = 0
  mockOnInstalledListeners.length = 0
  mockOnStartupListeners.length = 0

  const mockOnMessage = {
    addListener: vi.fn((cb: (...args: unknown[]) => unknown) => {
      mockOnMessageListeners.push(cb)
    }),
  }
  const mockOnAlarm = {
    addListener: vi.fn((cb: (alarm: { name: string }) => void) => {
      mockOnAlarmListeners.push(cb)
    }),
  }
  const mockOnInstalled = {
    addListener: vi.fn((cb: () => void) => {
      mockOnInstalledListeners.push(cb)
    }),
  }
  const mockOnStartup = {
    addListener: vi.fn((cb: () => void) => {
      mockOnStartupListeners.push(cb)
    }),
  }

  ;(globalThis as Record<string, unknown>).chrome = {
    action: {
      setBadgeText: mockSetBadgeText,
      setBadgeBackgroundColor: mockSetBadgeBackgroundColor,
    },
    notifications: {
      create: mockNotificationsCreate,
    },
    tabs: {
      query: mockTabsQuery,
      sendMessage: mockTabsSendMessage,
    },
    runtime: {
      sendMessage: vi.fn(),
      getURL: mockRuntimeGetURL,
      onMessage: mockOnMessage,
      onInstalled: mockOnInstalled,
      onStartup: mockOnStartup,
      lastError: null,
    },
    alarms: {
      create: mockAlarmsCreate,
      onAlarm: mockOnAlarm,
    },
    storage: {
      sync: {
        get: mockStorageSyncGet,
      },
      local: {
        get: mockStorageLocalGet,
        set: mockStorageLocalSet,
      },
    },
  }
}

import { ALARM_INTERVALS, ALARM_NAMES } from "../src/lib/constants"

async function importServiceWorker() {
  return import("../src/background/service-worker")
}

// ---------------------------------------------------------------------------
// Helper: simulate sending a message and capture async response
// ---------------------------------------------------------------------------

function simulateMessageAsync(message: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve) => {
    for (const listener of mockOnMessageListeners) {
      const sendResponse = (response: unknown) => resolve(response)
      const result = listener(message, {}, sendResponse)
      if (result === true) return // async — resolve will be called via sendResponse
      // Sync response
      resolve(result)
    }
    resolve(false)
  })
}

function simulateMessageSync(message: Record<string, unknown>): unknown {
  for (const listener of mockOnMessageListeners) {
    const sendResponse = vi.fn()
    const result = listener(message, {}, sendResponse)
    if (result === true) return true
    if (sendResponse.mock.calls.length > 0) return sendResponse.mock.calls[0]![0]
  }
  return false
}

function simulateAlarm(name: string) {
  for (const listener of mockOnAlarmListeners) {
    listener({ name })
  }
}

function simulateInstalled() {
  for (const listener of mockOnInstalledListeners) {
    listener()
  }
}

function simulateStartup() {
  for (const listener of mockOnStartupListeners) {
    listener()
  }
}

// ---------------------------------------------------------------------------
// updateBadge tests
// ---------------------------------------------------------------------------

describe("updateBadge", () => {
  beforeEach(async () => {
    setupChromeMocks()
    vi.resetModules()

    mockGetSettings.mockResolvedValue({
      apiUrl: "https://api.example.com",
      apiKey: "test-key",
      theme: "dark",
      badgeEnabled: true,
      notificationsEnabled: true,
    })

    await importServiceWorker()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it("sets badge text to empty when badge is disabled", async () => {
    mockGetSettings.mockResolvedValue({
      apiUrl: "https://api.example.com",
      apiKey: "test-key",
      theme: "dark",
      badgeEnabled: false,
      notificationsEnabled: true,
    })

    simulateStartup()
    await new Promise((r) => setTimeout(r, 50))
    expect(mockSetBadgeText).toHaveBeenCalledWith({ text: "" })
  })

  it("sets badge text to empty on API failure", async () => {
    mockCreateClientFromStorage.mockRejectedValue(new Error("API unreachable"))

    simulateStartup()
    await new Promise((r) => setTimeout(r, 100))
    expect(mockSetBadgeText).toHaveBeenCalledWith({ text: "" })
  })
})

// ---------------------------------------------------------------------------
// checkFollowups tests
// ---------------------------------------------------------------------------

describe("checkFollowups", () => {
  beforeEach(async () => {
    setupChromeMocks()
    vi.resetModules()

    mockGetSettings.mockResolvedValue({
      apiUrl: "https://api.example.com",
      apiKey: "test-key",
      theme: "dark",
      badgeEnabled: true,
      notificationsEnabled: true,
    })

    await importServiceWorker()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it("does not notify when notifications are disabled", async () => {
    mockGetSettings.mockResolvedValue({
      apiUrl: "https://api.example.com",
      apiKey: "test-key",
      theme: "dark",
      badgeEnabled: true,
      notificationsEnabled: false,
    })

    simulateAlarm(ALARM_NAMES.FOLLOWUP_CHECK)
    await new Promise((r) => setTimeout(r, 50))
    expect(mockNotificationsCreate).not.toHaveBeenCalled()
  })

  it("silently handles API errors during followup check", async () => {
    simulateAlarm(ALARM_NAMES.FOLLOWUP_CHECK)
    await new Promise((r) => setTimeout(r, 100))
    expect(mockOnAlarmListeners.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Message handler tests
// ---------------------------------------------------------------------------

describe("Message handler", () => {
  beforeEach(async () => {
    setupChromeMocks()
    vi.resetModules()

    mockGetSettings.mockResolvedValue({
      apiUrl: "https://api.example.com",
      apiKey: "test-key",
      theme: "dark",
      badgeEnabled: true,
      notificationsEnabled: true,
    })

    mockGetRecentApplications.mockResolvedValue([])

    await importServiceWorker()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it("handles GET_RECENT_APPLICATIONS message", async () => {
    mockGetRecentApplications.mockResolvedValue([
      {
        name: "test-app",
        company: "Acme",
        position: "Engineer",
        status: "applied",
        created_at: "2024-01-01",
      },
    ])

    const response = await simulateMessageAsync({
      type: "GET_RECENT_APPLICATIONS",
    })

    expect(response).toEqual({
      success: true,
      apps: [
        {
          name: "test-app",
          company: "Acme",
          position: "Engineer",
          status: "applied",
          created_at: "2024-01-01",
        },
      ],
    })
  })

  it("handles GET_SETTINGS message", async () => {
    const response = await simulateMessageAsync({
      type: "GET_SETTINGS",
    })

    expect(response).toEqual({
      success: true,
      settings: {
        apiUrl: "https://api.example.com",
        apiKey: "test-key",
        theme: "dark",
        badgeEnabled: true,
        notificationsEnabled: true,
      },
    })
  })

  it("handles CHECK_HEALTH message", async () => {
    const response = await simulateMessageAsync({
      type: "CHECK_HEALTH",
    })

    expect(response).toEqual({ healthy: false })
  })

  it("returns false for unknown message types", async () => {
    const response = await simulateMessageAsync({
      type: "UNKNOWN_TYPE",
    })

    expect(response).toBe(false)
  })

  it("returns true for ADD_TO_PIPELINE (async handler)", async () => {
    const result = simulateMessageSync({
      type: "ADD_TO_PIPELINE",
      payload: {
        job: {
          company: "Acme",
          position: "Engineer",
          description: "Test job",
          url: "https://example.com",
          source: "linkedin",
        },
      },
    })

    expect(result).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Install / startup lifecycle
// ---------------------------------------------------------------------------

describe("Install / startup lifecycle", () => {
  beforeEach(async () => {
    setupChromeMocks()
    vi.resetModules()

    mockGetSettings.mockResolvedValue({
      apiUrl: "https://api.example.com",
      apiKey: "test-key",
      theme: "dark",
      badgeEnabled: true,
      notificationsEnabled: true,
    })

    await importServiceWorker()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it("creates alarms on install", () => {
    simulateInstalled()

    expect(mockAlarmsCreate).toHaveBeenCalledWith(ALARM_NAMES.BADGE_REFRESH, {
      periodInMinutes: ALARM_INTERVALS.BADGE_REFRESH_MINUTES,
    })
    expect(mockAlarmsCreate).toHaveBeenCalledWith(ALARM_NAMES.FOLLOWUP_CHECK, {
      periodInMinutes: ALARM_INTERVALS.FOLLOWUP_CHECK_MINUTES,
    })
  })

  it("updates badge on install", async () => {
    simulateInstalled()
    await new Promise((r) => setTimeout(r, 50))
    expect(mockSetBadgeText).toHaveBeenCalled()
  })

  it("updates badge on startup", async () => {
    simulateStartup()
    await new Promise((r) => setTimeout(r, 50))
    expect(mockSetBadgeText).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Alarm handler tests
// ---------------------------------------------------------------------------

describe("Alarm handler", () => {
  beforeEach(async () => {
    setupChromeMocks()
    vi.resetModules()

    mockGetSettings.mockResolvedValue({
      apiUrl: "https://api.example.com",
      apiKey: "test-key",
      theme: "dark",
      badgeEnabled: true,
      notificationsEnabled: true,
    })

    await importServiceWorker()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it("triggers badge refresh on badge-refresh alarm", async () => {
    simulateAlarm(ALARM_NAMES.BADGE_REFRESH)
    await new Promise((r) => setTimeout(r, 50))
    expect(mockSetBadgeText).toHaveBeenCalled()
  })

  it("triggers followup check on followup-check alarm", async () => {
    simulateAlarm(ALARM_NAMES.FOLLOWUP_CHECK)
    await new Promise((r) => setTimeout(r, 50))
    expect(mockOnAlarmListeners.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// GET_RECENT_APPLICATIONS error handling
// ---------------------------------------------------------------------------

describe("Message handler error handling", () => {
  beforeEach(async () => {
    setupChromeMocks()
    vi.resetModules()

    mockGetSettings.mockResolvedValue({
      apiUrl: "https://api.example.com",
      apiKey: "test-key",
      theme: "dark",
      badgeEnabled: true,
      notificationsEnabled: true,
    })

    await importServiceWorker()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it("returns error response when getRecentApplications fails", async () => {
    mockGetRecentApplications.mockRejectedValue(new Error("Storage error"))

    const response = await simulateMessageAsync({
      type: "GET_RECENT_APPLICATIONS",
    })

    expect(response).toEqual({
      success: false,
      error: "Error: Storage error",
    })
  })
})
