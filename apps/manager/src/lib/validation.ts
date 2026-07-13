import { z } from "zod"

export const CreateApplicationSchema = z.object({
  company: z.string().min(1).max(200).trim(),
  position: z.string().min(1).max(200).trim(),
  url: z.string().url().optional().or(z.literal("")),
})

export const UpdateApplicationSchema = z.object({
  status: z
    .enum(["applied", "interview", "offer", "rejected", "ghosted"])
    .optional(),
  company: z.string().min(1).max(200).trim().optional(),
  position: z.string().min(1).max(200).trim().optional(),
  followup_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
})

export const NotesSchema = z.object({
  content: z.string().max(50_000),
})

export const TagsSchema = z.object({
  tags: z.array(z.string().max(100).trim()),
})

export const AtsScoreSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  score: z.number().min(0).max(100),
})

export const PreferencesSchema = z.object({
  ai_provider: z.string().max(50).optional(),
  theme: z.string().max(50).optional(),
})

export const ActionHistoryEntrySchema = z.object({
  action: z.string().max(200),
  params: z.record(z.string(), z.string()),
  timestamp: z.number(),
  success: z.boolean(),
})

export const SettingsSchema = z.object({
  theme: z.string().max(50).optional(),
  default_view: z.string().max(50).optional(),
  default_ai: z.enum(["gemini", "claude", "openai", "mistral", "ollama"]).optional(),
  default_model: z.string().max(200).optional(),
  pdfa_enabled: z.boolean().optional(),
})

export function zodError(error: z.ZodError): Response {
  return Response.json(
    { error: "Validation error", details: error.flatten().fieldErrors },
    { status: 422 }
  )
}
