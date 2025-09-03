import { useMutation } from "@tanstack/react-query";
import { Calendar, CalendarDays, Link, Edit, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { calculateEventDate } from "@/lib/date-utils";
import type { Event } from "@shared/schema";

interface EventsListProps {
  events: Event[];
  isLoading: boolean;
  selectedFilter: string;
  onFilterChange: (filter: string) => void;
  onEventDeleted: () => void;
  onEventEdit: (event: Event) => void;
}

export default function EventsList({ 
  events, 
  isLoading, 
  selectedFilter, 
  onFilterChange,
  onEventDeleted,
  onEventEdit 
}: EventsListProps) {
  const { toast } = useToast();

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      await apiRequest("DELETE", `/api/events/${eventId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Event deleted successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      onEventDeleted();
    },
    onError: () => {
      toast({
        title: "Error", 
        description: "Failed to delete event. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteEvent = (eventId: string) => {
    if (confirm("Are you sure you want to delete this event?")) {
      deleteEventMutation.mutate(eventId);
    }
  };

  const getEventTypeIcon = (dateType: string) => {
    switch (dateType) {
      case "fixed": return <Calendar className="h-4 w-4 text-primary" />;
      case "nth": return <CalendarDays className="h-4 w-4 text-primary" />;
      case "relative": return <Link className="h-4 w-4 text-primary" />;
      default: return <Calendar className="h-4 w-4 text-primary" />;
    }
  };

  const getEventTypeBadge = (dateType: string) => {
    const variants = {
      fixed: "default",
      nth: "secondary", 
      relative: "destructive",
    } as const;

    const labels = {
      fixed: "Fixed Date",
      nth: "Nth Date",
      relative: "Relative Date",
    };

    return (
      <Badge variant={variants[dateType as keyof typeof variants] || "default"}>
        {labels[dateType as keyof typeof labels] || dateType}
      </Badge>
    );
  };

  const formatEventDate = (event: Event) => {
    if (event.dateType === "fixed" && event.startDate && event.endDate) {
      // Handle date strings properly to avoid timezone issues
      const formatDateString = (dateValue: any) => {
        if (typeof dateValue === 'string') {
          // If it's a date string like "2025-09-01", parse it as local date
          const [year, month, day] = dateValue.split('T')[0].split('-');
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toLocaleDateString();
        } else {
          // If it's already a Date object
          return new Date(dateValue).toLocaleDateString();
        }
      };
      
      const start = formatDateString(event.startDate);
      const end = formatDateString(event.endDate);
      return start === end ? start : `${start} - ${end}`;
    }
    
    // Try to calculate the actual date
    const calculatedDate = calculateEventDate(event, events);
    
    if (event.dateType === "nth") {
      const occurrences = ["", "1st", "2nd", "3rd", "4th"];
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const months = ["", "January", "February", "March", "April", "May", "June", 
                     "July", "August", "September", "October", "November", "December"];
      
      const occurrence = event.nthOccurrence === -1 ? "Last" : occurrences[event.nthOccurrence || 1];
      const day = days[event.dayOfWeek || 0];
      const month = months[event.month || 1];
      const year = event.baseYear || new Date().getFullYear();
      
      const pattern = `${occurrence} ${day} in ${month} ${year}`;
      return calculatedDate ? `${calculatedDate.toLocaleDateString()} (${pattern})` : pattern;
    }
    
    if (event.dateType === "relative") {
      const referenceEvent = events.find(e => e.id === event.relativeEventId);
      const pattern = `${event.relativePeriod} ${event.relativeUnit} ${event.relativeDirection} ${referenceEvent ? referenceEvent.title : 'reference event'}`;
      return calculatedDate ? `${calculatedDate.toLocaleDateString()} (${pattern})` : pattern;
    }
    
    return "Date not set";
  };


  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Created Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="loading-spinner" />
            <span className="ml-2 text-muted-foreground">Loading events...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Created Events</CardTitle>
          <div className="flex items-center space-x-2">
            <Select value={selectedFilter} onValueChange={onFilterChange}>
              <SelectTrigger className="w-40" data-testid="select-event-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="fixed">Fixed Dates</SelectItem>
                <SelectItem value="nth">Nth Dates</SelectItem>
                <SelectItem value="relative">Relative Dates</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" data-testid="button-search">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {events.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No events created yet</h3>
            <p className="text-muted-foreground">Create your first event using the form above.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div 
                key={event.id} 
                className="event-card bg-secondary/50 p-4 rounded-lg border border-border"
                data-testid={`event-card-${event.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="font-medium text-foreground" data-testid={`event-title-${event.id}`}>
                        {event.title}
                      </h4>
                      {getEventTypeBadge(event.dateType)}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div className="flex items-center space-x-2">
                        {getEventTypeIcon(event.dateType)}
                        <span data-testid={`event-date-${event.id}`}>
                          {formatEventDate(event)}
                        </span>
                      </div>
                      {event.description && (
                        <p className="text-xs text-muted-foreground/80 mt-1">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => onEventEdit(event)}
                      data-testid={`button-edit-${event.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDeleteEvent(event.id)}
                      disabled={deleteEventMutation.isPending}
                      data-testid={`button-delete-${event.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            <div className="mt-6 pt-4 border-t border-border">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground" data-testid="text-event-count">
                  Showing {events.length} of {events.length} events
                </p>
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled
                    data-testid="button-previous"
                  >
                    Previous
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled
                    data-testid="button-next"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
