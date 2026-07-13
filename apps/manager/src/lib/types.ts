export interface Application {
  id: string
  company: string
  position: string
  stage: "apply" | "phone" | "onsite" | "offer" | "rejected" | "withdrawn"
  appliedDate: string
  url?: string
  notes?: string
  atsScore?: number
}

export interface CVData {
  basics: {
    name: string
    label?: string
    email: string
    phone?: string
    url?: string
    summary?: string
    location?: {
      city?: string
      region?: string
      country?: string
    }
  }
  work: Array<{
    company: string
    position: string
    startDate: string
    endDate?: string
    summary?: string
    highlights?: string[]
  }>
  education: Array<{
    institution: string
    area: string
    studyType: string
    startDate?: string
    endDate?: string
  }>
  skills: Array<{
    name: string
    level?: string
    keywords?: string[]
  }>
}

export interface Stats {
  total: number
  byStage: Record<string, number>
  responseRate: number
  interviewRate: number
}

export interface ATSResult {
  score: number
  keywords: string[]
  missing: string[]
  suggestions: string[]
}
