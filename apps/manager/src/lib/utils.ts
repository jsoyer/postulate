import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const CV_PATH = process.env.CV_PATH || "/Users/jeromesoyer/Documents/Github/CV"
