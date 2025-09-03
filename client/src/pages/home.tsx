import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Download, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import EventForm from "@/components/event-form";
import EventsList from "@/components/events-list";
import ExportPanel from "@/components/export-panel";
import type { Event } from "@shared/schema";

export default function Home() {
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  const { data: events = [], isLoading, refetch } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const handleExportAll = async () => {
    try {
      const response = await fetch("/api/events/export/ics");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "events.ics";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Failed to export events:", error);
    }
  };

  const filteredEvents = events.filter(event => {
    if (selectedFilter === "all") return true;
    return event.dateType === selectedFilter;
  });

  const eventStats = {
    fixed: events.filter(e => e.dateType === "fixed").length,
    nth: events.filter(e => e.dateType === "nth").length,
    relative: events.filter(e => e.dateType === "relative").length,
    total: events.length,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Calendar className="text-primary text-2xl" />
                <h1 className="text-xl font-semibold text-foreground">CalendarSync</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                onClick={handleExportAll} 
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="button-export-all"
              >
                <Download className="mr-2 h-4 w-4" />
                Export All
              </Button>
              <Button 
                variant="secondary"
                data-testid="button-settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Event Creation Panel */}
          <div className="lg:col-span-2">
            <EventForm 
              onEventCreated={refetch} 
              editingEvent={editingEvent}
              onEditComplete={() => {
                setEditingEvent(null);
                refetch();
              }}
            />
          </div>

          {/* Export Panel */}
          <div className="lg:col-span-1">
            <ExportPanel 
              events={events} 
              stats={eventStats}
            />
          </div>
        </div>

        {/* Events List */}
        <div className="mt-8">
          <EventsList 
            events={filteredEvents}
            isLoading={isLoading}
            selectedFilter={selectedFilter}
            onFilterChange={setSelectedFilter}
            onEventDeleted={refetch}
            onEventEdit={setEditingEvent}
          />
        </div>
      </div>
    </div>
  );
}
