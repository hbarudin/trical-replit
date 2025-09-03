import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { parse } from "csv-parse/sync";
import multer from "multer";
import { storage } from "./storage";
import { insertEventSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Configure multer for file uploads
  const upload = multer({ 
    storage: multer.memoryStorage(),
    fileFilter: (req: any, file: any, cb: any) => {
      if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
        cb(null, true);
      } else {
        cb(new Error('Only CSV files are allowed'));
      }
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
  });
  // Get all events
  app.get("/api/events", async (req, res) => {
    try {
      const events = await storage.getAllEvents();
      res.json(events);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  // Get single event
  app.get("/api/events/:id", async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  // Create event
  app.post("/api/events", async (req, res) => {
    try {
      const validatedData = insertEventSchema.parse(req.body);
      const event = await storage.createEvent(validatedData);
      res.status(201).json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to create event" });
    }
  });

  // Update event
  app.patch("/api/events/:id", async (req, res) => {
    try {
      const validatedData = insertEventSchema.partial().parse(req.body);
      const event = await storage.updateEvent(req.params.id, validatedData);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to update event" });
    }
  });

  // Delete event
  app.delete("/api/events/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteEvent(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Event not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete event" });
    }
  });

  // Clear all events
  app.delete("/api/events", async (req, res) => {
    try {
      const events = await storage.getAllEvents();
      let deletedCount = 0;
      
      for (const event of events) {
        const deleted = await storage.deleteEvent(event.id);
        if (deleted) {
          deletedCount++;
        }
      }
      
      res.json({ 
        message: `Successfully deleted ${deletedCount} events`,
        deletedCount 
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to clear all events" });
    }
  });

  // Helper function to calculate nth date
  function calculateNthDate(
    nthOccurrence: number,
    dayOfWeek: number,
    month: number,
    year: number = new Date().getFullYear()
  ): Date {
    // Create date for first day of the month
    const firstDay = new Date(year, month - 1, 1);
    
    // Find the first occurrence of the target day of week
    let date = new Date(firstDay);
    while (date.getDay() !== dayOfWeek) {
      date.setDate(date.getDate() + 1);
    }
    
    if (nthOccurrence === -1) {
      // Find last occurrence
      const lastDay = new Date(year, month, 0); // Last day of month
      const lastDate = new Date(lastDay);
      while (lastDate.getDay() !== dayOfWeek) {
        lastDate.setDate(lastDate.getDate() - 1);
      }
      return lastDate;
    } else {
      // Find nth occurrence
      date.setDate(date.getDate() + (nthOccurrence - 1) * 7);
      
      // Check if still in the same month
      if (date.getMonth() !== month - 1) {
        throw new Error(`No ${nthOccurrence} occurrence in month`);
      }
      
      return date;
    }
  }

  // Helper function to calculate relative date
  function calculateRelativeDate(
    baseDate: Date,
    period: number,
    unit: string,
    direction: "before" | "after"
  ): Date {
    const result = new Date(baseDate);
    const multiplier = direction === "before" ? -1 : 1;
    
    switch (unit) {
      case "days":
        result.setDate(result.getDate() + (period * multiplier));
        break;
      case "weeks":
        result.setDate(result.getDate() + (period * 7 * multiplier));
        break;
      case "months":
        result.setMonth(result.getMonth() + (period * multiplier));
        break;
      case "years":
        result.setFullYear(result.getFullYear() + (period * multiplier));
        break;
      default:
        throw new Error(`Invalid unit: ${unit}`);
    }
    
    return result;
  }

  // Helper function to calculate event date for any event type
  function calculateEventDate(event: any, allEvents: any[]): Date | null {
    switch (event.dateType) {
      case "fixed":
        if (!event.startDate) return null;
        
        const parseSimpleDate = (dateValue: any) => {
          if (typeof dateValue === 'string') {
            const [year, month, day] = dateValue.toString().split('T')[0].split('-');
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          }
          return new Date(dateValue);
        };
        
        return parseSimpleDate(event.startDate);
        
      case "nth":
        if (!event.nthOccurrence || event.dayOfWeek === null || event.dayOfWeek === undefined || !event.month) {
          return null;
        }
        try {
          const baseYear = event.baseYear || new Date().getFullYear();
          return calculateNthDate(
            event.nthOccurrence,
            event.dayOfWeek,
            event.month,
            baseYear
          );
        } catch {
          return null;
        }
        
      case "relative":
        if (!event.relativeEventName || !event.relativePeriod || !event.relativeUnit || !event.relativeDirection) {
          return null;
        }
        const referenceEvent = allEvents.find(e => e.title === event.relativeEventName);
        if (!referenceEvent) return null;
        
        const referenceDate = calculateEventDate(referenceEvent, allEvents);
        if (!referenceDate) return null;
        
        try {
          return calculateRelativeDate(
            referenceDate,
            event.relativePeriod,
            event.relativeUnit,
            event.relativeDirection as "before" | "after"
          );
        } catch {
          return null;
        }
        
      default:
        return null;
    }
  }

  // Export events as ICS
  app.get("/api/events/export/ics", async (req, res) => {
    try {
      const events = await storage.getAllEvents();
      
      // Simple ICS generation
      let icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//CalendarSync//Calendar Event Creator//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH'
      ];

      for (const event of events) {
        let eventStart: Date;
        let eventEnd: Date;
        
        if (event.dateType === 'fixed') {
          if (!event.startDate) continue;
          
          // Parse date strings directly to avoid timezone issues
          const parseSimpleDate = (dateValue: any) => {
            if (typeof dateValue === 'string') {
              const [year, month, day] = dateValue.toString().split('T')[0].split('-');
              return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            }
            return new Date(dateValue);
          };
          
          eventStart = parseSimpleDate(event.startDate);
          
          if (event.endDate) {
            eventEnd = parseSimpleDate(event.endDate);
            // For all-day events, ICS end date should be the day AFTER the last day
            eventEnd.setDate(eventEnd.getDate() + 1);
          } else {
            // Single day event - end date is the day after start date
            eventEnd = new Date(eventStart);
            eventEnd.setDate(eventStart.getDate() + 1);
          }
        } else if (event.dateType === 'nth') {
          // Calculate nth date
          if (!event.nthOccurrence || event.dayOfWeek === null || event.dayOfWeek === undefined || !event.month) continue;
          
          try {
            const baseYear = event.baseYear || new Date().getFullYear();
            eventStart = calculateNthDate(
              event.nthOccurrence,
              event.dayOfWeek!,
              event.month,
              baseYear
            );
            // Single day event - end date is the day after start date
            eventEnd = new Date(eventStart);
            eventEnd.setDate(eventStart.getDate() + 1);
          } catch (error) {
            // Skip events that can't be calculated
            continue;
          }
        } else if (event.dateType === 'relative') {
          // Calculate relative date
          const calculatedDate = calculateEventDate(event, events);
          if (!calculatedDate) continue;
          
          eventStart = calculatedDate;
          // Single day event - end date is the day after start date
          eventEnd = new Date(eventStart);
          eventEnd.setDate(eventStart.getDate() + 1);
        } else {
          // Skip unknown event types
          continue;
        }
        
        const formatDateForAllDay = (date: Date) => {
          // Format as YYYYMMDD for all-day events
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}${month}${day}`;
        };
        
        const formatDateTimeForCreated = (date: Date) => {
          return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        icsContent.push(
          'BEGIN:VEVENT',
          `UID:${event.id}@calendarsync.com`,
          `DTSTART;VALUE=DATE:${formatDateForAllDay(eventStart)}`,
          `DTEND;VALUE=DATE:${formatDateForAllDay(eventEnd)}`,
          `SUMMARY:${event.title}`,
          event.description ? `DESCRIPTION:${event.description}` : '',
          `CREATED:${formatDateTimeForCreated(new Date(event.createdAt))}`,
          'END:VEVENT'
        );
      }

      icsContent.push('END:VCALENDAR');
      
      const icsString = icsContent.filter(line => line).join('\r\n');
      
      res.setHeader('Content-Type', 'text/calendar');
      res.setHeader('Content-Disposition', 'attachment; filename="events.ics"');
      res.send(icsString);
    } catch (error) {
      res.status(500).json({ message: "Failed to export events" });
    }
  });

  // Update calendar year - updates base year for all nth date events
  app.post("/api/events/update-year", async (req, res) => {
    try {
      const { newYear } = req.body;
      
      if (!newYear || typeof newYear !== 'number' || newYear < 2020 || newYear > 2050) {
        return res.status(400).json({ message: "Invalid year. Must be between 2020 and 2050." });
      }
      
      const events = await storage.getAllEvents();
      const updatedEvents = [];
      
      for (const event of events) {
        if (event.dateType === 'nth') {
          // Update the base year for nth date events
          const updatedData = {
            baseYear: newYear
          };
          await storage.updateEvent(event.id, updatedData);
          const updatedEvent = { ...event, baseYear: newYear };
          updatedEvents.push(updatedEvent);
        }
        // Leave fixed and relative events unchanged
      }
      
      res.json({ 
        message: `Updated ${updatedEvents.length} nth date events to year ${newYear}`,
        updatedCount: updatedEvents.length,
        year: newYear
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to update calendar year" });
    }
  });

  // Import events from CSV
  app.post("/api/events/import", upload.single('file'), async (req: Request & { file?: any }, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const csvContent = req.file.buffer.toString('utf-8');
      
      // Parse CSV with headers
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      const results = {
        total: records.length,
        successful: 0,
        failed: 0,
        errors: [] as string[]
      };

      // Process each record
      for (let i = 0; i < records.length; i++) {
        const record = records[i] as any;
        try {
          // Transform CSV data to event format
          const eventData: any = {
            title: record.title || record.Title,
            description: record.description || record.Description || null,
            dateType: (record.dateType || record['Date Type'] || '').toLowerCase()
          };

          // Handle different date types
          if (eventData.dateType === 'fixed') {
            eventData.startDate = record.startDate || record['Start Date'] || null;
            eventData.endDate = record.endDate || record['End Date'] || null;
          } else if (eventData.dateType === 'nth') {
            eventData.nthOccurrence = parseInt(record.nthOccurrence || record['Nth Occurrence'] || '1');
            eventData.dayOfWeek = parseInt(record.dayOfWeek || record['Day of Week'] || '1');
            eventData.month = parseInt(record.month || record.Month || '1');
            eventData.baseYear = parseInt(record.baseYear || record['Base Year'] || new Date().getFullYear().toString());
          } else if (eventData.dateType === 'relative') {
            eventData.relativePeriod = parseInt(record.relativePeriod || record['Relative Period'] || '1');
            eventData.relativeUnit = record.relativeUnit || record['Relative Unit'] || 'days';
            eventData.relativeDirection = record.relativeDirection || record['Relative Direction'] || 'before';
            eventData.relativeEventName = record.relativeEventName || record['Relative Event Name'] || record.relativeEventId || record['Relative Event ID'] || '';
          }

          // Validate the event data
          const validatedData = insertEventSchema.parse(eventData);
          
          // Create the event
          await storage.createEvent(validatedData);
          results.successful++;
        } catch (error) {
          results.failed++;
          const errorMsg = error instanceof z.ZodError 
            ? `Row ${i + 1}: ${error.errors.map(e => e.message).join(', ')}`
            : `Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          results.errors.push(errorMsg);
        }
      }

      res.json({
        message: `Import completed: ${results.successful} successful, ${results.failed} failed`,
        ...results
      });
    } catch (error) {
      res.status(500).json({ 
        message: "Failed to process CSV file",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
