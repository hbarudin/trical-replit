import type { Event } from "@shared/schema";

export function calculateNthDate(
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
      throw new Error(`No ${nthOccurrence}${getOrdinalSuffix(nthOccurrence)} occurrence in month`);
    }
    
    return date;
  }
}

export function calculateRelativeDate(
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

export function calculateEventDate(event: Event, allEvents: Event[] = []): Date | null {
  switch (event.dateType) {
    case "fixed":
      return event.startDate ? new Date(event.startDate) : null;
      
    case "nth":
      if (event.nthOccurrence && event.dayOfWeek !== undefined && event.month) {
        try {
          return calculateNthDate(
            event.nthOccurrence,
            event.dayOfWeek!,
            event.month,
            event.baseYear || new Date().getFullYear()
          );
        } catch {
          return null;
        }
      }
      return null;
      
    case "relative":
      if (event.relativeEventName && event.relativePeriod && event.relativeUnit && event.relativeDirection) {
        const referenceEvent = allEvents.find(e => e.title === event.relativeEventName);
        if (referenceEvent) {
          const referenceDate = calculateEventDate(referenceEvent, allEvents);
          if (referenceDate) {
            return calculateRelativeDate(
              referenceDate,
              event.relativePeriod,
              event.relativeUnit,
              event.relativeDirection as "before" | "after"
            );
          }
        }
      }
      return null;
      
    default:
      return null;
  }
}

export function getOrdinalSuffix(n: number): string {
  const suffix = ["th", "st", "nd", "rd"];
  const value = n % 100;
  return suffix[(value - 20) % 10] || suffix[value] || suffix[0];
}

export function formatEventDate(event: Event): string {
  const date = calculateEventDate(event);
  if (date) {
    return date.toLocaleDateString();
  }
  
  // Fallback to pattern description
  if (event.dateType === "nth") {
    const occurrences = ["", "1st", "2nd", "3rd", "4th"];
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = ["", "January", "February", "March", "April", "May", "June", 
                   "July", "August", "September", "October", "November", "December"];
    
    const occurrence = event.nthOccurrence === -1 ? "Last" : occurrences[event.nthOccurrence || 1];
    const day = days[event.dayOfWeek || 0];
    const month = months[event.month || 1];
    
    return `${occurrence} ${day} in ${month}`;
  }
  
  if (event.dateType === "relative") {
    return `${event.relativePeriod} ${event.relativeUnit} ${event.relativeDirection} ${event.relativeEventName || 'reference event'}`;
  }
  
  return "Date not calculated";
}
