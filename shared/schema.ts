import { z } from "zod";

// Event interface for localStorage-based storage
export interface Event {
  id: string;
  title: string;
  description: string | null;
  
  // Date type: 'fixed', 'nth', 'relative'
  dateType: 'fixed' | 'nth' | 'relative';
  
  // For fixed dates
  startDate: Date | null;
  endDate: Date | null;
  
  // For nth dates
  nthOccurrence: number | null; // 1, 2, 3, 4, -1 (for last)
  dayOfWeek: number | null; // 0-6 (Sunday to Saturday)
  month: number | null; // 1-12
  baseYear: number | null; // base year for nth date calculations
  
  // For relative dates
  relativePeriod: number | null; // number of units
  relativeUnit: 'days' | 'weeks' | 'months' | 'years' | null;
  relativeDirection: 'before' | 'after' | null;
  relativeEventName: string | null; // Changed from ID to name
  
  // Metadata
  createdAt: Date;
}

export const insertEventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable().optional(),
  dateType: z.enum(['fixed', 'nth', 'relative']),
  
  // For fixed dates
  startDate: z.union([z.string(), z.date()]).nullable().optional().transform(val => {
    if (typeof val === 'string' && val) return new Date(val);
    if (val instanceof Date) return val;
    return null;
  }),
  endDate: z.union([z.string(), z.date()]).nullable().optional().transform(val => {
    if (typeof val === 'string' && val) return new Date(val);
    if (val instanceof Date) return val;
    return null;
  }),
  
  // For nth dates
  nthOccurrence: z.number().min(-1).max(4).nullable().optional(),
  dayOfWeek: z.number().min(0).max(6).nullable().optional(),
  month: z.number().min(1).max(12).nullable().optional(),
  baseYear: z.number().min(2020).max(2050).nullable().optional(),
  
  // For relative dates
  relativePeriod: z.number().positive().nullable().optional(),
  relativeUnit: z.enum(['days', 'weeks', 'months', 'years']).nullable().optional(),
  relativeDirection: z.enum(['before', 'after']).nullable().optional(),
  relativeEventName: z.string().nullable().optional(), // Changed from ID to name
});

export type InsertEvent = z.infer<typeof insertEventSchema>;
