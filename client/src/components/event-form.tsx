import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Calendar, CalendarDays, Link, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertEventSchema, type InsertEvent, type Event } from "@shared/schema";
import { z } from "zod";

const fixedDateSchema = insertEventSchema.extend({
  dateType: z.literal("fixed"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const nthDateSchema = insertEventSchema.extend({
  dateType: z.literal("nth"),
  nthOccurrence: z.number(),
  dayOfWeek: z.number(),
  month: z.number(),
});

const relativeDateSchema = insertEventSchema.extend({
  dateType: z.literal("relative"),
  relativePeriod: z.number(),
  relativeUnit: z.enum(["days", "weeks", "months", "years"]),
  relativeDirection: z.enum(["before", "after"]),
  relativeEventId: z.string(),
});

interface EventFormProps {
  onEventCreated: () => void;
  editingEvent?: Event | null;
  onEditComplete?: () => void;
}

export default function EventForm({ onEventCreated, editingEvent, onEditComplete }: EventFormProps) {
  const [activeTab, setActiveTab] = useState(editingEvent?.dateType || "fixed");
  const { toast } = useToast();

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const createEventMutation = useMutation({
    mutationFn: async (event: InsertEvent) => {
      const response = await apiRequest("POST", "/api/events", event);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Event created successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      onEventCreated();
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create event. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async (event: Partial<InsertEvent>) => {
      if (!editingEvent?.id) throw new Error("No event ID for update");
      const response = await apiRequest("PATCH", `/api/events/${editingEvent.id}`, event);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Event updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      onEditComplete?.();
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update event. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getSchema = () => {
    switch (activeTab) {
      case "fixed": return fixedDateSchema;
      case "nth": return nthDateSchema;
      case "relative": return relativeDateSchema;
      default: return fixedDateSchema;
    }
  };

  const getDefaultValues = () => {
    if (editingEvent) {
      const base = {
        title: editingEvent.title,
        description: editingEvent.description || "",
        dateType: editingEvent.dateType,
      };
      
      switch (editingEvent.dateType) {
        case "fixed":
          return {
            ...base,
            startDate: editingEvent.startDate ? new Date(editingEvent.startDate).toISOString().split('T')[0] : "",
            endDate: editingEvent.endDate ? new Date(editingEvent.endDate).toISOString().split('T')[0] : "",
          };
        case "nth":
          return {
            ...base,
            nthOccurrence: editingEvent.nthOccurrence || 1,
            dayOfWeek: editingEvent.dayOfWeek || 1,
            month: editingEvent.month || 1,
            baseYear: editingEvent.baseYear || new Date().getFullYear(),
          };
        case "relative":
          return {
            ...base,
            relativePeriod: editingEvent.relativePeriod || 1,
            relativeUnit: editingEvent.relativeUnit || "days",
            relativeDirection: editingEvent.relativeDirection || "before",
            relativeEventName: editingEvent.relativeEventName || "",
          };
        default:
          return base;
      }
    }
    
    const base = {
      title: "",
      description: "",
      dateType: activeTab as "fixed" | "nth" | "relative",
    };
    
    switch (activeTab) {
      case "fixed":
        return { ...base, startDate: "", endDate: "" };
      case "nth":
        return { ...base, nthOccurrence: 1, dayOfWeek: 1, month: 1, baseYear: new Date().getFullYear() };
      case "relative":
        return { ...base, relativePeriod: 1, relativeUnit: "days" as const, relativeDirection: "before" as const, relativeEventName: "" };
      default:
        return base;
    }
  };

  const form = useForm<any>({
    resolver: zodResolver(getSchema()),
    defaultValues: getDefaultValues(),
  });

  // Reset form when editingEvent changes
  useEffect(() => {
    if (editingEvent) {
      setActiveTab(editingEvent.dateType);
      const defaultValues = getDefaultValues();
      form.reset(defaultValues);
      
      // Scroll to form when editing starts
      const formElement = document.querySelector('[data-testid="event-form"]');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [editingEvent]);

  const onSubmit = (data: any) => {
    const eventData: InsertEvent = {
      ...data,
      dateType: activeTab,
    };
    
    if (editingEvent) {
      updateEventMutation.mutate(eventData);
    } else {
      createEventMutation.mutate(eventData);
    }
  };

  const getPatternPreview = () => {
    const formData = form.getValues();
    
    if (activeTab === "nth") {
      const occurrences = ["1st", "2nd", "3rd", "4th", "Last"];
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const months = ["January", "February", "March", "April", "May", "June", 
                     "July", "August", "September", "October", "November", "December"];
      
      const occurrence = formData.nthOccurrence === -1 ? "Last" : occurrences[(formData.nthOccurrence || 1) - 1];
      const day = days[formData.dayOfWeek || 0];
      const month = months[(formData.month || 1) - 1];
      
      return occurrence && day && month ? `${occurrence} ${day} in ${month}` : "Pattern preview";
    }
    
    if (activeTab === "relative") {
      const referenceEventName = formData.relativeEventName;
      const period = formData.relativePeriod;
      const unit = formData.relativeUnit;
      const direction = formData.relativeDirection;
      
      return period && unit && direction && referenceEventName 
        ? `${period} ${unit} ${direction} ${referenceEventName}`
        : "Pattern preview";
    }
    
    return "";
  };

  return (
    <Card data-testid="event-form" className={editingEvent ? "ring-2 ring-primary" : ""}>
      <CardHeader>
        <CardTitle>{editingEvent ? "Edit Event" : "Create New Event"}</CardTitle>
        <CardDescription>
          {editingEvent ? "Update event details and date patterns" : "Add events with different date patterns and export to Google Calendar"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(value) => {
          setActiveTab(value);
          // Reset form with proper defaults for the new tab
          const newDefaults = {
            title: "",
            description: "",
            dateType: value as "fixed" | "nth" | "relative",
            ...(value === "fixed" && { startDate: "", endDate: "" }),
            ...(value === "nth" && { nthOccurrence: 1, dayOfWeek: 1, month: 1, baseYear: new Date().getFullYear() }),
            ...(value === "relative" && { relativePeriod: 1, relativeUnit: "days" as const, relativeDirection: "before" as const, relativeEventName: "" }),
          };
          form.reset(newDefaults);
        }}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="fixed" className="flex items-center space-x-2" data-testid="tab-fixed">
              <Calendar className="h-4 w-4" />
              <span>Fixed Date</span>
            </TabsTrigger>
            <TabsTrigger value="nth" className="flex items-center space-x-2" data-testid="tab-nth">
              <CalendarDays className="h-4 w-4" />
              <span>Nth Date</span>
            </TabsTrigger>
            <TabsTrigger value="relative" className="flex items-center space-x-2" data-testid="tab-relative">
              <Link className="h-4 w-4" />
              <span>Relative Date</span>
            </TabsTrigger>
          </TabsList>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
              {/* Common fields */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter event title" {...field} data-testid="input-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <TabsContent value="fixed" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ""} data-testid="input-start-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ""} data-testid="input-end-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="nth" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="nthOccurrence"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Occurrence</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()} data-testid="select-occurrence">
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1">1st</SelectItem>
                            <SelectItem value="2">2nd</SelectItem>
                            <SelectItem value="3">3rd</SelectItem>
                            <SelectItem value="4">4th</SelectItem>
                            <SelectItem value="-1">Last</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dayOfWeek"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Day of Week</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()} data-testid="select-day-of-week">
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1">Monday</SelectItem>
                            <SelectItem value="2">Tuesday</SelectItem>
                            <SelectItem value="3">Wednesday</SelectItem>
                            <SelectItem value="4">Thursday</SelectItem>
                            <SelectItem value="5">Friday</SelectItem>
                            <SelectItem value="6">Saturday</SelectItem>
                            <SelectItem value="0">Sunday</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="month"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Month</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()} data-testid="select-month">
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1">January</SelectItem>
                            <SelectItem value="2">February</SelectItem>
                            <SelectItem value="3">March</SelectItem>
                            <SelectItem value="4">April</SelectItem>
                            <SelectItem value="5">May</SelectItem>
                            <SelectItem value="6">June</SelectItem>
                            <SelectItem value="7">July</SelectItem>
                            <SelectItem value="8">August</SelectItem>
                            <SelectItem value="9">September</SelectItem>
                            <SelectItem value="10">October</SelectItem>
                            <SelectItem value="11">November</SelectItem>
                            <SelectItem value="12">December</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="baseYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Year</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder={new Date().getFullYear().toString()}
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || new Date().getFullYear())}
                          data-testid="input-base-year"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="bg-muted p-4 rounded-md">
                  <p className="text-sm text-muted-foreground">
                    Pattern preview: <span className="font-medium text-foreground">{getPatternPreview()}</span>
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="relative" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="relativePeriod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Time Period</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="10" 
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            data-testid="input-relative-period"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="relativeUnit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} data-testid="select-relative-unit">
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="days">days</SelectItem>
                            <SelectItem value="weeks">weeks</SelectItem>
                            <SelectItem value="months">months</SelectItem>
                            <SelectItem value="years">years</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="relativeDirection"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Relation</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} data-testid="select-relative-direction">
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="before">before</SelectItem>
                            <SelectItem value="after">after</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="relativeEventName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reference Event Name</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} data-testid="select-reference-event">
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select or type event name" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {events
                            .filter(event => event.dateType !== 'relative') // Don't allow relative events to reference other relative events
                            .map((event) => (
                            <SelectItem key={event.id} value={event.title}>
                              {event.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="bg-muted p-4 rounded-md">
                  <p className="text-sm text-muted-foreground">
                    Pattern preview: <span className="font-medium text-foreground">{getPatternPreview()}</span>
                  </p>
                </div>
              </TabsContent>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        rows={3} 
                        placeholder="Event description (optional)" 
                        {...field} 
                        data-testid="textarea-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2">
                {editingEvent && onEditComplete && (
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={onEditComplete}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </Button>
                )}
                <Button 
                  type="submit" 
                  disabled={createEventMutation.isPending || updateEventMutation.isPending}
                  data-testid={editingEvent ? "button-update-event" : "button-add-event"}
                >
                  {(createEventMutation.isPending || updateEventMutation.isPending) ? (
                    <div className="loading-spinner mr-2" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  {editingEvent ? "Update Event" : "Add Event"}
                </Button>
              </div>
            </form>
          </Form>
        </Tabs>
      </CardContent>
    </Card>
  );
}