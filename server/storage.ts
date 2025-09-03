import { type Event, type InsertEvent } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getEvent(id: string): Promise<Event | undefined>;
  getAllEvents(): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: string): Promise<boolean>;
}

// localStorage-based storage implementation
export class LocalStorage implements IStorage {
  private readonly STORAGE_KEY = 'calendar_events';

  private getEvents(): Event[] {
    if (typeof window === 'undefined') {
      // Server-side: return empty array (will be handled by client-side hydration)
      return [];
    }
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      
      const parsed = JSON.parse(stored);
      // Convert date strings back to Date objects
      return parsed.map((event: any) => ({
        ...event,
        startDate: event.startDate ? new Date(event.startDate) : null,
        endDate: event.endDate ? new Date(event.endDate) : null,
        createdAt: new Date(event.createdAt),
      }));
    } catch (error) {
      console.error('Error loading events from localStorage:', error);
      return [];
    }
  }

  private saveEvents(events: Event[]): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(events));
    } catch (error) {
      console.error('Error saving events to localStorage:', error);
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  async getAllEvents(): Promise<Event[]> {
    return this.getEvents().sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  async getEvent(id: string): Promise<Event | undefined> {
    const events = this.getEvents();
    return events.find(event => event.id === id);
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const events = this.getEvents();
    const id = this.generateId();
    const event: Event = {
      ...insertEvent,
      id,
      createdAt: new Date(),
    } as Event;
    events.push(event);
    this.saveEvents(events);
    return event;
  }

  async updateEvent(id: string, updateData: Partial<InsertEvent>): Promise<Event | undefined> {
    const events = this.getEvents();
    const index = events.findIndex(event => event.id === id);
    if (index === -1) return undefined;
    
    const updatedEvent: Event = { ...events[index], ...updateData };
    events[index] = updatedEvent;
    this.saveEvents(events);
    return updatedEvent;
  }

  async deleteEvent(id: string): Promise<boolean> {
    const events = this.getEvents();
    const index = events.findIndex(event => event.id === id);
    if (index === -1) return false;
    
    events.splice(index, 1);
    this.saveEvents(events);
    return true;
  }
}

// In-memory storage implementation (fallback for server-side)
export class MemStorage implements IStorage {
  private events: Map<string, Event>;

  constructor() {
    this.events = new Map();
  }

  async getEvent(id: string): Promise<Event | undefined> {
    return this.events.get(id);
  }

  async getAllEvents(): Promise<Event[]> {
    return Array.from(this.events.values()).sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const id = randomUUID();
    const event: Event = { 
      ...insertEvent, 
      id,
      createdAt: new Date()
    } as Event;
    this.events.set(id, event);
    return event;
  }

  async updateEvent(id: string, updateData: Partial<InsertEvent>): Promise<Event | undefined> {
    const existingEvent = this.events.get(id);
    if (!existingEvent) return undefined;

    const updatedEvent: Event = { ...existingEvent, ...updateData };
    this.events.set(id, updatedEvent);
    return updatedEvent;
  }

  async deleteEvent(id: string): Promise<boolean> {
    return this.events.delete(id);
  }
}

// Choose storage based on environment
const createStorage = (): IStorage => {
  // Use LocalStorage for both client and server (server will use MemStorage as fallback)
  if (typeof window !== 'undefined') {
    return new LocalStorage();
  } else {
    console.log('Using in-memory storage for server-side');
    return new MemStorage();
  }
};

export const storage = createStorage();