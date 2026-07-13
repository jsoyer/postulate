import type { ActionField } from "@/components/ActionRunner"

export type ActionStage =
  | "apply"
  | "research"
  | "cv"
  | "interview"
  | "offer"
  | "linkedin"
  | "reports"

export interface ActionRegistryEntry {
  slug: string
  title: string
  description: string
  category: ActionCategory
  stage: ActionStage
  fields: ActionField[]
  hasAI: boolean
}

export type ActionCategory =
  | "workflow"
  | "cv"
  | "intelligence"
  | "interview"
  | "salary"
  | "outreach"
  | "linkedin"
  | "reports"

export const AI_PROVIDER_OPTIONS = [
  { value: "gemini", label: "Gemini" },
  { value: "claude", label: "Claude" },
  { value: "openai", label: "OpenAI" },
  { value: "mistral", label: "Mistral" },
  { value: "ollama", label: "Ollama (local)" },
]

const AI_FIELD: ActionField = {
  name: "ai",
  label: "AI Provider",
  type: "select",
  options: AI_PROVIDER_OPTIONS,
}

export const ACTION_REGISTRY: ActionRegistryEntry[] = [
  // === Workflow (11) ===
  {
    slug: "apply",
    title: "Full Apply Workflow",
    description: "Create branch, PR, fetch job, tailor, and build",
    category: "workflow",
    stage: "apply",
    hasAI: true,
    fields: [
      { name: "company", label: "Company", required: true },
      { name: "position", label: "Position", required: true },
      { name: "url", label: "Job URL", type: "url" },
      { ...AI_FIELD },
    ],
  },
  {
    slug: "fetch",
    title: "Fetch Job Description",
    description: "Fetch job description from URL and save to application",
    category: "workflow",
    stage: "apply",
    hasAI: false,
    fields: [
      { name: "name", label: "Application Name", placeholder: "e.g. 2026-02-snowflake", required: true },
    ],
  },
  {
    slug: "tailor",
    title: "AI Tailor",
    description: "Tailor your CV for a specific job application using AI",
    category: "workflow",
    stage: "apply",
    hasAI: true,
    fields: [
      { name: "name", label: "Application Name", placeholder: "e.g. 2026-02-databricks", required: true },
      {
        name: "theme",
        label: "CV Theme",
        type: "select",
        options: [
          { value: "tech-blue", label: "Tech Blue" },
          { value: "startup-orange", label: "Startup Orange" },
          { value: "executive-dark", label: "Executive Dark" },
          { value: "cyber-red", label: "Cyber Red" },
        ],
      },
      { ...AI_FIELD },
    ],
  },
  {
    slug: "score",
    title: "ATS Score",
    description: "Calculate ATS keyword score for an application",
    category: "workflow",
    stage: "apply",
    hasAI: false,
    fields: [
      { name: "name", label: "Application Name", placeholder: "e.g. 2026-02-snowflake", required: true },
    ],
  },
  {
    slug: "ats-rank",
    title: "ATS Rank",
    description: "Rank all applications by ATS score",
    category: "workflow",
    stage: "apply",
    hasAI: false,
    fields: [
      { name: "min", label: "Minimum Score (optional)", type: "number", placeholder: "70" },
    ],
  },
  {
    slug: "diff",
    title: "Diff Master vs Application",
    description: "Compare master CV with application CV",
    category: "workflow",
    stage: "apply",
    hasAI: false,
    fields: [
      { name: "name", label: "Application Name", required: true },
    ],
  },
  {
    slug: "compare",
    title: "Compare CVs",
    description: "Compare two tailored CV versions side by side",
    category: "workflow",
    stage: "apply",
    hasAI: false,
    fields: [
      { name: "name1", label: "First Application Name", placeholder: "e.g. 2026-02-databricks", required: true },
      { name: "name2", label: "Second Application Name", placeholder: "e.g. 2026-02-stripe", required: true },
    ],
  },
  {
    slug: "archive",
    title: "Archive Application",
    description: "Archive a completed job application",
    category: "workflow",
    stage: "apply",
    hasAI: false,
    fields: [
      { name: "name", label: "Application Name", placeholder: "e.g. 2026-02-databricks", required: true },
    ],
  },
  {
    slug: "archive-app",
    title: "Archive + Outcome",
    description: "Archive an application and record the final outcome",
    category: "workflow",
    stage: "apply",
    hasAI: false,
    fields: [
      { name: "name", label: "Application Name", placeholder: "e.g. 2026-02-databricks", required: true },
      {
        name: "outcome",
        label: "Outcome (optional)",
        type: "select",
        options: [
          { value: "rejected", label: "Rejected" },
          { value: "offer", label: "Offer" },
          { value: "ghosted", label: "Ghosted" },
          { value: "withdrawn", label: "Withdrawn" },
        ],
      },
    ],
  },
  {
    slug: "apply-board",
    title: "Apply Board",
    description: "View your application pipeline board",
    category: "workflow",
    stage: "apply",
    hasAI: false,
    fields: [
      {
        name: "stage",
        label: "Filter by Stage (optional)",
        type: "select",
        options: [
          { value: "all", label: "All" },
          { value: "applied", label: "Applied" },
          { value: "phone-screen", label: "Phone Screen" },
          { value: "interview", label: "Interview" },
          { value: "final", label: "Final" },
          { value: "offer", label: "Offer" },
          { value: "rejected", label: "Rejected" },
          { value: "ghosted", label: "Ghosted" },
        ],
      },
    ],
  },
  {
    slug: "tasks",
    title: "Apply Board",
    description: "View your application pipeline board",
    category: "workflow",
    stage: "apply",
    hasAI: false,
    fields: [
      {
        name: "stage",
        label: "Filter by Stage (optional)",
        type: "select",
        options: [
          { value: "applied", label: "Applied" },
          { value: "phone-screen", label: "Phone Screen" },
          { value: "interview", label: "Interview" },
          { value: "final", label: "Final" },
          { value: "offer", label: "Offer" },
          { value: "rejected", label: "Rejected" },
          { value: "ghosted", label: "Ghosted" },
        ],
      },
    ],
  },

  // === CV (5) ===
  {
    slug: "render",
    title: "Render YAML",
    description: "Render the CV from YAML source",
    category: "cv",
    stage: "cv",
    hasAI: false,
    fields: [
      {
        name: "lang",
        label: "Language (optional)",
        type: "select",
        options: [
          { value: "en", label: "English (en)" },
          { value: "fr", label: "French (fr)" },
        ],
      },
      { name: "draft", label: "Draft Mode (optional)", placeholder: "true" },
    ],
  },
  {
    slug: "docx",
    title: "Convert to DOCX",
    description: "Convert CV to DOCX format",
    category: "cv",
    stage: "cv",
    hasAI: false,
    fields: [
      { name: "name", label: "Application Name (optional)", placeholder: "Leave empty for master CV" },
    ],
  },
  {
    slug: "export",
    title: "Export CV",
    description: "Export CV data in different formats",
    category: "cv",
    stage: "cv",
    hasAI: false,
    fields: [
      {
        name: "format",
        label: "Format",
        type: "select",
        options: [
          { value: "json", label: "JSON" },
          { value: "markdown", label: "Markdown" },
          { value: "text", label: "Plain Text" },
        ],
      },
    ],
  },
  {
    slug: "export-csv",
    title: "Export CSV",
    description: "Export all applications to CSV format",
    category: "cv",
    stage: "cv",
    hasAI: false,
    fields: [],
  },
  {
    slug: "cv-health",
    title: "CV Health",
    description: "Check the health and quality of your CV",
    category: "cv",
    stage: "cv",
    hasAI: false,
    fields: [
      { name: "name", label: "Application Name (optional)", placeholder: "e.g. 2026-02-databricks" },
    ],
  },

  // === Intelligence (7) ===
  {
    slug: "culture",
    title: "Company Research",
    description: "Research company intelligence for an application using AI",
    category: "intelligence",
    stage: "research",
    hasAI: true,
    fields: [
      { name: "name", label: "Application Name", placeholder: "e.g. 2026-02-databricks", required: true },
      { ...AI_FIELD },
    ],
  },
  {
    slug: "contacts",
    title: "Find Contacts",
    description: "Find relevant contacts for a job application",
    category: "intelligence",
    stage: "research",
    hasAI: false,
    fields: [
      { name: "name", label: "Application Name", placeholder: "e.g. 2026-02-databricks", required: true },
    ],
  },
  {
    slug: "competitor-map",
    title: "Competitor Map",
    description: "Map the competitive landscape for a company using AI",
    category: "intelligence",
    stage: "research",
    hasAI: true,
    fields: [
      { name: "name", label: "Application Name", placeholder: "e.g. 2026-02-databricks", required: true },
      { ...AI_FIELD },
    ],
  },
  {
    slug: "glassdoor",
    title: "Job Fit Score",
    description: "Evaluate how well your CV matches a job application",
    category: "intelligence",
    stage: "research",
    hasAI: false,
    fields: [
      { name: "name", label: "Application Name", placeholder: "e.g. 2026-02-databricks", required: true },
    ],
  },
  {
    slug: "ai-cover-letter",
    title: "Cover Letter Angles",
    description: "Generate cover letter angles for an application using AI",
    category: "intelligence",
    stage: "research",
    hasAI: true,
    fields: [
      { name: "name", label: "Application Name", placeholder: "e.g. 2026-02-databricks", required: true },
      { ...AI_FIELD },
    ],
  },
  {
    slug: "skills",
    title: "Skills Gap Analysis",
    description: "Analyze skill gaps across all your applications",
    category: "intelligence",
    stage: "research",
    hasAI: false,
    fields: [],
  },
  {
    slug: "trends",
    title: "Keyword Trends",
    description: "Analyze keyword trends across your applications",
    category: "intelligence",
    stage: "research",
    hasAI: false,
    fields: [
      { name: "since", label: "Since (optional)", placeholder: "e.g. 2026-01" },
      { name: "top", label: "Top N Keywords", type: "number", placeholder: "30" },
    ],
  },

  // === Interview (7) ===
  {
    slug: "prep",
    title: "Interview Prep",
    description: "Generate interview preparation notes",
    category: "interview",
    stage: "interview",
    hasAI: false,
    fields: [
      { name: "name", label: "Application Name", placeholder: "e.g. 2026-02-snowflake", required: true },
    ],
  },
  {
    slug: "ai-interview-prep",
    title: "Interview Brief",
    description: "Generate AI-powered interview brief for an application",
    category: "interview",
    stage: "interview",
    hasAI: true,
    fields: [
      { name: "name", label: "Application Name", placeholder: "e.g. 2026-02-databricks", required: true },
      {
        name: "stage",
        label: "Interview Stage",
        type: "select",
        options: [
          { value: "phone-screen", label: "Phone Screen" },
          { value: "technical", label: "Technical" },
          { value: "panel", label: "Panel" },
          { value: "final", label: "Final" },
        ],
      },
      { ...AI_FIELD },
    ],
  },
  {
    slug: "star",
    title: "STAR Stories",
    description: "Generate STAR interview stories for an application using AI",
    category: "interview",
    stage: "interview",
    hasAI: true,
    fields: [
      { name: "name", label: "Application Name", placeholder: "e.g. 2026-02-databricks", required: true },
      { name: "count", label: "Number of Stories", type: "number", placeholder: "5" },
      { ...AI_FIELD },
    ],
  },
  {
    slug: "milestone",
    title: "Log Milestone",
    description: "Log an interview milestone for an application",
    category: "interview",
    stage: "interview",
    hasAI: false,
    fields: [
      { name: "name", label: "Application Name", placeholder: "e.g. 2026-02-databricks", required: true },
      {
        name: "stage",
        label: "Stage (optional)",
        type: "select",
        options: [
          { value: "applied", label: "Applied" },
          { value: "phone-screen", label: "Phone Screen" },
          { value: "technical", label: "Technical" },
          { value: "panel", label: "Panel" },
          { value: "final", label: "Final" },
          { value: "offer", label: "Offer" },
          { value: "rejected", label: "Rejected" },
        ],
      },
      { name: "date", label: "Date (optional)", placeholder: "YYYY-MM-DD" },
      {
        name: "outcome",
        label: "Outcome (optional)",
        type: "select",
        options: [
          { value: "passed", label: "Passed" },
          { value: "rejected", label: "Rejected" },
        ],
      },
    ],
  },
  {
    slug: "questions",
    title: "Question Bank",
    description: "Generate interview questions for an application",
    category: "interview",
    stage: "interview",
    hasAI: false,
    fields: [
      { name: "name", label: "Application Name (optional)", placeholder: "e.g. 2026-02-databricks" },
    ],
  },
  {
    slug: "quiz",
    title: "Interview Quiz",
    description: "Flashcard quiz from your prep notes",
    category: "interview",
    stage: "interview",
    hasAI: false,
    fields: [],
  },
  {
    slug: "prep-star",
    title: "STAR Stories",
    description: "Generate STAR interview stories for an application using AI",
    category: "interview",
    stage: "interview",
    hasAI: true,
    fields: [
      { name: "name", label: "Application Name", placeholder: "e.g. 2026-02-databricks", required: true },
      { name: "count", label: "Number of Stories (optional)", type: "number", placeholder: "5" },
      { ...AI_FIELD },
    ],
  },

  // === Salary (4) ===
  {
    slug: "salary",
    title: "Salary Benchmark",
    description: "Research salary benchmarks for an application using AI",
    category: "salary",
    stage: "offer",
    hasAI: true,
    fields: [
      { name: "name", label: "Application Name", placeholder: "e.g. 2026-02-databricks", required: true },
      { ...AI_FIELD },
    ],
  },
  {
    slug: "negotiate",
    title: "Negotiate",
    description: "Get AI-powered salary negotiation advice for an offer",
    category: "salary",
    stage: "offer",
    hasAI: true,
    fields: [
      { name: "name", label: "Application Name", placeholder: "e.g. 2026-02-databricks", required: true },
      { name: "offer", label: "Offer Details (optional)", placeholder: "e.g. €120k + 10% bonus" },
      { ...AI_FIELD },
    ],
  },
  {
    slug: "thankyou",
    title: "Thank-You Email",
    description: "Generate a thank-you email after an interview",
    category: "salary",
    stage: "offer",
    hasAI: true,
    fields: [
      { name: "name", label: "Application Name", placeholder: "e.g. 2026-02-databricks", required: true },
      {
        name: "stage",
        label: "Interview Stage (optional)",
        type: "select",
        options: [
          { value: "phone-screen", label: "Phone Screen" },
          { value: "technical", label: "Technical" },
          { value: "panel", label: "Panel" },
          { value: "final", label: "Final" },
        ],
      },
      { ...AI_FIELD },
    ],
  },
  {
    slug: "email-sequence",
    title: "Follow-Up Email",
    description: "Generate a follow-up email for an application",
    category: "salary",
    stage: "offer",
    hasAI: false,
    fields: [
      { name: "name", label: "Application Name", placeholder: "e.g. 2026-02-databricks", required: true },
      { name: "days", label: "Days Since Last Contact", type: "number", placeholder: "7" },
    ],
  },

  // === Outreach (5) ===
  {
    slug: "recruiter",
    title: "Recruiter Email",
    description: "Generate a recruiter outreach email for an application",
    category: "outreach",
    stage: "offer",
    hasAI: true,
    fields: [
      { name: "name", label: "Application Name", placeholder: "e.g. 2026-02-databricks", required: true },
      {
        name: "type",
        label: "Email Type",
        type: "select",
        options: [
          { value: "cold", label: "Cold" },
          { value: "follow-up", label: "Follow-Up" },
          { value: "post-apply", label: "Post-Apply" },
        ],
      },
      { name: "contact", label: "Contact Name (optional)", placeholder: "Recruiter name" },
      { ...AI_FIELD },
    ],
  },
  {
    slug: "cold-sequence",
    title: "Cold Email",
    description: "Generate a cold recruiter email for an application",
    category: "outreach",
    stage: "offer",
    hasAI: true,
    fields: [
      { name: "name", label: "Application Name", placeholder: "e.g. 2026-02-databricks", required: true },
      { name: "contact", label: "Contact Name (optional)", placeholder: "Recruiter or hiring manager name" },
      { ...AI_FIELD },
    ],
  },
  {
    slug: "linkedin-message",
    title: "LinkedIn Message",
    description: "Generate a LinkedIn message for an application contact",
    category: "outreach",
    stage: "offer",
    hasAI: true,
    fields: [
      { name: "name", label: "Application Name", placeholder: "e.g. 2026-02-databricks", required: true },
      {
        name: "type",
        label: "Message Type",
        type: "select",
        options: [
          { value: "recruiter", label: "Recruiter" },
          { value: "hm", label: "Hiring Manager" },
          { value: "referral", label: "Referral" },
        ],
      },
      { name: "contact", label: "Contact Name (optional)", placeholder: "Person's name" },
      { ...AI_FIELD },
    ],
  },
  {
    slug: "recruiter-email",
    title: "Recruiter Email",
    description: "Generate a recruiter outreach email for an application",
    category: "outreach",
    stage: "offer",
    hasAI: true,
    fields: [
      { name: "name", label: "Application Name", placeholder: "e.g. 2026-02-databricks", required: true },
      {
        name: "type",
        label: "Email Type (optional)",
        type: "select",
        options: [
          { value: "cold", label: "Cold" },
          { value: "follow-up", label: "Follow-Up" },
          { value: "post-apply", label: "Post-Apply" },
        ],
      },
      { name: "contact", label: "Contact Name (optional)", placeholder: "Recruiter name" },
      { ...AI_FIELD },
    ],
  },
  {
    slug: "followup",
    title: "Follow-Up Email",
    description: "Generate a follow-up email for an application",
    category: "outreach",
    stage: "offer",
    hasAI: false,
    fields: [
      { name: "name", label: "Application Name", placeholder: "e.g. 2026-02-databricks", required: true },
      { name: "days", label: "Days Since Last Contact (optional)", type: "number", placeholder: "7" },
    ],
  },

  // === LinkedIn (5) ===
  {
    slug: "linkedin",
    title: "LinkedIn Sync",
    description: "Sync your CV with LinkedIn. LinkedIn sync is dry-run by default. Set PUSH=true to actually push changes.",
    category: "linkedin",
    stage: "linkedin",
    hasAI: false,
    fields: [
      { name: "push", label: "Push Changes (leave empty for dry-run)", placeholder: "true" },
    ],
  },
  {
    slug: "brand",
    title: "LinkedIn Profile",
    description: "Generate or update your LinkedIn profile using AI",
    category: "linkedin",
    stage: "linkedin",
    hasAI: true,
    fields: [
      { name: "name", label: "Application Name (optional)", placeholder: "e.g. 2026-02-databricks" },
      { ...AI_FIELD },
    ],
  },
  {
    slug: "blog",
    title: "LinkedIn Post",
    description: "Generate a LinkedIn post using AI",
    category: "linkedin",
    stage: "linkedin",
    hasAI: true,
    fields: [
      { name: "name", label: "Application Name (optional)", placeholder: "e.g. 2026-02-databricks" },
      {
        name: "type",
        label: "Post Type",
        type: "select",
        options: [
          { value: "open-to-work", label: "Open to Work" },
          { value: "transition", label: "Transition" },
          { value: "achievement", label: "Achievement" },
          { value: "insight", label: "Insight" },
        ],
      },
      { name: "topic", label: "Topic (optional)", placeholder: "Topic or theme for the post" },
      { ...AI_FIELD },
    ],
  },
  {
    slug: "linkedin-post",
    title: "LinkedIn Post",
    description: "Generate a LinkedIn post using AI",
    category: "linkedin",
    stage: "linkedin",
    hasAI: true,
    fields: [
      { name: "name", label: "Application Name (optional)", placeholder: "e.g. 2026-02-databricks" },
      {
        name: "type",
        label: "Post Type",
        type: "select",
        options: [
          { value: "open-to-work", label: "Open to Work" },
          { value: "transition", label: "Transition" },
          { value: "achievement", label: "Achievement" },
          { value: "insight", label: "Insight" },
        ],
      },
      { name: "topic", label: "Topic (optional)", placeholder: "Topic or theme for the post" },
      { ...AI_FIELD },
    ],
  },
  {
    slug: "linkedin-profile",
    title: "LinkedIn Profile",
    description: "Generate or update your LinkedIn profile using AI",
    category: "linkedin",
    stage: "linkedin",
    hasAI: true,
    fields: [
      { name: "name", label: "Application Name (optional)", placeholder: "e.g. 2026-02-databricks" },
      { ...AI_FIELD },
    ],
  },

  // === Reports (6) ===
  {
    slug: "quarterly",
    title: "Pipeline Digest",
    description: "Generate a pipeline digest summary for the past N days",
    category: "reports",
    stage: "reports",
    hasAI: false,
    fields: [
      { name: "days", label: "Number of Days to Cover", type: "number", placeholder: "14" },
    ],
  },
  {
    slug: "digest",
    title: "Pipeline Digest",
    description: "Generate a pipeline digest summary for the past N days",
    category: "reports",
    stage: "reports",
    hasAI: false,
    fields: [
      { name: "days", label: "Number of Days (optional)", type: "number", placeholder: "14" },
    ],
  },
  {
    slug: "weekly",
    title: "Weekly Digest",
    description: "Generate a weekly pipeline digest (last 7 days)",
    category: "reports",
    stage: "reports",
    hasAI: false,
    fields: [],
  },
  {
    slug: "discover",
    title: "Discover Jobs",
    description: "Discover new job opportunities based on your CV",
    category: "reports",
    stage: "reports",
    hasAI: false,
    fields: [],
  },
  {
    slug: "research",
    title: "Company Research",
    description: "Research company intelligence for an application using AI",
    category: "reports",
    stage: "reports",
    hasAI: true,
    fields: [
      { name: "name", label: "Application Name", placeholder: "e.g. 2026-02-databricks", required: true },
      { ...AI_FIELD },
    ],
  },
  {
    slug: "salary-bench",
    title: "Salary Benchmark",
    description: "Research salary benchmarks for an application using AI",
    category: "reports",
    stage: "reports",
    hasAI: true,
    fields: [
      { name: "name", label: "Application Name", placeholder: "e.g. 2026-02-databricks", required: true },
      { ...AI_FIELD },
    ],
  },

  // === Special / Integration (5) ===
  {
    slug: "notion",
    title: "Notion Sync",
    description: "Pull from or push your CV data to Notion",
    category: "reports",
    stage: "reports",
    hasAI: false,
    fields: [
      { name: "name", label: "Application Name (optional)", placeholder: "e.g. 2026-02-databricks" },
    ],
  },
  {
    slug: "cover-angles",
    title: "Cover Letter Angles",
    description: "Generate cover letter angles for an application using AI",
    category: "intelligence",
    stage: "research",
    hasAI: true,
    fields: [
      { name: "name", label: "Application Name", placeholder: "e.g. 2026-02-databricks", required: true },
      { name: "angles", label: "Angles (optional)", placeholder: "business,technical,culture" },
      { ...AI_FIELD },
    ],
  },
  {
    slug: "interview-brief",
    title: "Interview Brief",
    description: "Generate an AI-powered interview brief for an application",
    category: "interview",
    stage: "interview",
    hasAI: true,
    fields: [
      { name: "name", label: "Application Name", placeholder: "e.g. 2026-02-databricks", required: true },
      {
        name: "stage",
        label: "Interview Stage (optional)",
        type: "select",
        options: [
          { value: "phone-screen", label: "Phone Screen" },
          { value: "technical", label: "Technical" },
          { value: "panel", label: "Panel" },
          { value: "final", label: "Final" },
        ],
      },
      { ...AI_FIELD },
    ],
  },
  {
    slug: "interview-debrief",
    title: "Interview Debrief",
    description: "Generate an AI-powered interview debrief",
    category: "interview",
    stage: "interview",
    hasAI: true,
    fields: [
      { name: "name", label: "Application Name", placeholder: "e.g. 2026-02-databricks", required: true },
      {
        name: "stage",
        label: "Interview Stage (optional)",
        type: "select",
        options: [
          { value: "phone-screen", label: "Phone Screen" },
          { value: "technical", label: "Technical" },
          { value: "panel", label: "Panel" },
          { value: "final", label: "Final" },
        ],
      },
      { name: "notes", label: "Notes (optional)", placeholder: "Key points from the interview" },
      { ...AI_FIELD },
    ],
  },
  {
    slug: "job-fit",
    title: "Job Fit Score",
    description: "Evaluate how well your CV matches a job application",
    category: "intelligence",
    stage: "research",
    hasAI: false,
    fields: [
      { name: "name", label: "Application Name", placeholder: "e.g. 2026-02-databricks", required: true },
    ],
  },
]

export function getActionBySlug(slug: string): ActionRegistryEntry | undefined {
  return ACTION_REGISTRY.find(a => a.slug === slug)
}

export function getActionsByCategory(category: ActionCategory): ActionRegistryEntry[] {
  return ACTION_REGISTRY.filter(a => a.category === category)
}

export function getAllCategories(): ActionCategory[] {
  return ["workflow", "cv", "intelligence", "interview", "salary", "outreach", "linkedin", "reports"]
}

export const CATEGORY_LABELS: Record<ActionCategory, string> = {
  workflow: "Application Workflow",
  cv: "CV Generation",
  intelligence: "Intelligence",
  interview: "Interview",
  salary: "Salary & Negotiation",
  outreach: "Outreach",
  linkedin: "LinkedIn",
  reports: "Reports",
}

export const STAGE_GROUPS: ActionStage[] = ["apply", "research", "cv", "interview", "offer", "linkedin", "reports"]

export const STAGE_LABELS: Record<ActionStage, string> = {
  apply: "Apply",
  research: "Research",
  cv: "CV",
  interview: "Interview",
  offer: "Offer",
  linkedin: "LinkedIn",
  reports: "Reports",
}

export const STAGE_ICONS: Record<ActionStage, string> = {
  apply: "Zap",
  research: "Search",
  cv: "FileText",
  interview: "Users",
  offer: "Handshake",
  linkedin: "Linkedin",
  reports: "BarChart3",
}

export function getActionsByStage(stage: ActionStage): ActionRegistryEntry[] {
  return ACTION_REGISTRY.filter(a => a.stage === stage)
}

export function getUniqueActions(): ActionRegistryEntry[] {
  const seen = new Set<string>()
  return ACTION_REGISTRY.filter(a => {
    if (seen.has(a.slug)) return false
    seen.add(a.slug)
    return true
  })
}

export function getActionsByStageUnique(stage: ActionStage): ActionRegistryEntry[] {
  return getUniqueActions().filter(a => a.stage === stage)
}
