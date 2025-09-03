import type { Event } from "@shared/schema";
import { calculateEventDate } from "./date-utils";

interface ExportSettings {
  includeDescriptions: boolean;
  setReminders: boolean;
}

export function generateICS(events: Event[], settings: ExportSettings): string {
  const icsLines = [
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
      // For fixed dates, use the original start/end dates
      if (!event.startDate) continue;
      
      // Parse date strings directly to avoid timezone issues
      const parseSimpleDate = (dateValue: any) => {
        if (typeof dateValue === 'string') {
          const [year, month, day] = dateValue.split('T')[0].split('-');
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
    } else {
      // For nth and relative dates, calculate the actual date
      const calculatedDate = calculateEventDate(event, events);
      if (!calculatedDate) continue;
      
      eventStart = new Date(calculatedDate);
      eventEnd = new Date(calculatedDate);
      eventEnd.setDate(eventStart.getDate() + 1); // All-day event ends next day
    }


    const formatDate = (date: Date) => {
      // Format as YYYYMMDD for all-day events
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    };

    const eventLines = [
      'BEGIN:VEVENT',
      `UID:${event.id}@calendarsync.com`,
      `DTSTART;VALUE=DATE:${formatDate(eventStart)}`,
      `DTEND;VALUE=DATE:${formatDate(eventEnd)}`,
      `SUMMARY:${escapeICSValue(event.title)}`,
      `CREATED:${new Date(event.createdAt).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'}`
    ];

    if (settings.includeDescriptions && event.description) {
      eventLines.push(`DESCRIPTION:${escapeICSValue(event.description)}`);
    }


    if (settings.setReminders) {
      eventLines.push(
        'BEGIN:VALARM',
        'TRIGGER:-PT15M',
        'ACTION:DISPLAY',
        'DESCRIPTION:Reminder',
        'END:VALARM'
      );
    }

    eventLines.push('END:VEVENT');
    icsLines.push(...eventLines);
  }

  icsLines.push('END:VCALENDAR');
  return icsLines.join('\r\n');
}

function escapeICSValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

export function downloadICS(content: string, filename: string = 'events.ics') {
  const blob = new Blob([content], { type: 'text/calendar' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
