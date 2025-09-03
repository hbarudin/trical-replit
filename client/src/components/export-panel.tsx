import { useState, useRef } from "react";
import { Download, FileDown, FileSpreadsheet, Info, Settings, Calendar, Upload, FileText, FileType } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { generateICS } from "@/lib/ics-export";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Event } from "@shared/schema";

interface ExportPanelProps {
  events: Event[];
  stats: {
    fixed: number;
    nth: number;
    relative: number;
    total: number;
  };
}

interface ExportSettings {
  includeDescriptions: boolean;
  setReminders: boolean;
}

export default function ExportPanel({ events, stats }: ExportPanelProps) {
  const { toast } = useToast();
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    includeDescriptions: true,
    setReminders: false,
  });
  const [newYear, setNewYear] = useState(new Date().getFullYear() + 1);
  const [isUpdatingYear, setIsUpdatingYear] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGoogleCalendarExport = async () => {
    try {
      // Generate ICS file and trigger download
      const icsContent = generateICS(events, exportSettings);
      const blob = new Blob([icsContent], { type: 'text/calendar' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'calendar-events.ics';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Successful!",
        description: "Your events have been exported. Import the file into Google Calendar.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export events. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleICSDownload = async () => {
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

      toast({
        title: "Download Successful!",
        description: "ICS file has been downloaded.",
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to download ICS file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCSVExport = () => {
    try {
      const csvHeader = "Title,Date Type,Start Date,End Date,Description\n";
      const csvRows = events.map(event => {
        const startDate = event.startDate ? new Date(event.startDate).toLocaleDateString() : "";
        const endDate = event.endDate ? new Date(event.endDate).toLocaleDateString() : "";
        
        return [
          `"${event.title}"`,
          `"${event.dateType}"`,
          `"${startDate}"`,
          `"${endDate}"`,
          `"${event.description || ""}"`
        ].join(",");
      }).join("\n");

      const csvContent = csvHeader + csvRows;
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'events.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Successful!",
        description: "CSV file has been downloaded.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export CSV. Please try again.",
        variant: "destructive",
      });
    }
  };

  const updateSetting = (key: keyof ExportSettings, value: boolean) => {
    setExportSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleUpdateYear = async () => {
    try {
      setIsUpdatingYear(true);
      
      const response = await apiRequest("POST", "/api/events/update-year", {
        newYear: newYear
      });
      
      const data = await response.json();
      
      // Invalidate events cache to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      
      toast({
        title: "Year Updated Successfully!",
        description: `Updated ${data.updatedCount} nth date events to year ${newYear}`,
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update calendar year. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingYear(false);
    }
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Invalid File Type",
        description: "Please select a CSV file",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsImporting(true);
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/events/import', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      if (response.ok) {
        // Invalidate events cache to refresh the list
        queryClient.invalidateQueries({ queryKey: ["/api/events"] });
        
        toast({
          title: "Import Successful!",
          description: `${result.successful} events imported successfully${result.failed > 0 ? `, ${result.failed} failed` : ''}`,
        });
        
        // Show detailed errors if any
        if (result.errors && result.errors.length > 0) {
          console.log('Import errors:', result.errors);
        }
      } else {
        throw new Error(result.message || 'Import failed');
      }
    } catch (error) {
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import CSV file",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleDownloadTemplate = () => {
    // Create CSV template with example data for each event type
    const templateData = [
      // Headers
      'Title,Date Type,Description,Start Date,End Date,Nth Occurrence,Day of Week,Month,Base Year,Relative Period,Relative Unit,Relative Direction,Relative Event Name',
      // Fixed date example
      'Company Holiday,fixed,Christmas Day,2024-12-25,2024-12-25,,,,,,,,',
      // Nth date example
      'Board Meeting,nth,Monthly board meeting,,,2,2,1,2024,,,,',
      // Relative date example (references event by name)
      'Holiday Party Setup,relative,Setup for holiday party,,,,,,-3,days,before,Company Holiday'
    ];
    
    const csvContent = templateData.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'calendar_import_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    toast({
      title: "Template Downloaded!",
      description: "CSV template with examples downloaded successfully",
    });
  };

  return (
    <div className="space-y-6">
      {/* Export Options */}
      <Card>
        <CardHeader>
          <CardTitle>Export Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Button 
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleGoogleCalendarExport}
              data-testid="button-export-google-calendar"
            >
              <Download className="mr-2 h-4 w-4" />
              Export to Google Calendar
            </Button>
            <Button 
              variant="secondary"
              className="w-full"
              onClick={handleICSDownload}
              data-testid="button-download-ics"
            >
              <FileDown className="mr-2 h-4 w-4" />
              Download as ICS
            </Button>
            <Button 
              variant="secondary"
              className="w-full"
              onClick={handleCSVExport}
              data-testid="button-export-csv"
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export as CSV
            </Button>
            <Button 
              variant="outline"
              className="w-full"
              onClick={handleImportClick}
              disabled={isImporting}
              data-testid="button-import-csv"
            >
              {isImporting ? (
                <div className="loading-spinner mr-2" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {isImporting ? "Importing..." : "Import from CSV"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileImport}
              style={{ display: 'none' }}
              data-testid="input-file-import"
            />
            <Button 
              variant="ghost"
              className="w-full text-sm"
              onClick={handleDownloadTemplate}
              data-testid="button-download-template"
            >
              <FileType className="mr-2 h-4 w-4" />
              Download CSV Template
            </Button>
          </div>

          <div className="pt-4 border-t border-border">
            <div className="bg-muted p-3 rounded-md mb-4">
              <div className="flex items-start space-x-2 text-sm">
                <FileText className="h-4 w-4 text-primary mt-0.5" />
                <div className="space-y-1">
                  <span className="font-medium text-foreground">CSV Import Format:</span>
                  <div className="text-muted-foreground space-y-1">
                    <p><strong>Required:</strong> Title, Date Type (fixed/nth/relative)</p>
                    <p><strong>Fixed dates:</strong> Start Date, End Date (YYYY-MM-DD)</p>
                    <p><strong>Nth dates:</strong> Nth Occurrence (1-4,-1), Day of Week (0-6), Month (1-12), Base Year</p>
                    <p><strong>Relative dates:</strong> Relative Period, Relative Unit, Relative Direction, Relative Event Name</p>
                    <p><strong>Optional:</strong> Description</p>
                    <p className="text-xs italic">💡 Download the template above for proper formatting examples</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <h4 className="font-medium text-foreground mb-3">Export Settings</h4>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-descriptions"
                  checked={exportSettings.includeDescriptions}
                  onCheckedChange={(checked) => updateSetting('includeDescriptions', !!checked)}
                  data-testid="checkbox-include-descriptions"
                />
                <label htmlFor="include-descriptions" className="text-sm text-foreground">
                  Include descriptions
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="set-reminders"
                  checked={exportSettings.setReminders}
                  onCheckedChange={(checked) => updateSetting('setReminders', !!checked)}
                  data-testid="checkbox-set-reminders"
                />
                <label htmlFor="set-reminders" className="text-sm text-foreground">
                  Set reminders
                </label>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <div className="bg-muted p-3 rounded-md">
              <div className="flex items-center space-x-2 text-sm">
                <Info className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground" data-testid="text-ready-events">
                    {stats.total} events
                  </span> ready to export
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Year Update */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Update Calendar Year</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="year-input">New Year</Label>
            <Input
              id="year-input"
              type="number"
              min="2020"
              max="2050"
              value={newYear}
              onChange={(e) => setNewYear(parseInt(e.target.value) || new Date().getFullYear())}
              data-testid="input-new-year"
            />
          </div>
          
          <Button 
            className="w-full"
            onClick={handleUpdateYear}
            disabled={isUpdatingYear || stats.nth === 0}
            data-testid="button-update-year"
          >
            {isUpdatingYear ? "Updating..." : `Update ${stats.nth} Nth Date Events`}
          </Button>
          
          <div className="text-sm text-muted-foreground space-y-1">
            <p className="flex items-center space-x-1">
              <Info className="h-3 w-3" />
              <span>Updates base year for all "Nth Date" events</span>
            </p>
            <p>• Fixed dates: Manual update required</p>
            <p>• Relative dates: Auto-recalculate based on reference events</p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Fixed Dates</span>
              <span className="font-medium text-foreground" data-testid="stat-fixed">{stats.fixed}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Nth Dates</span>
              <span className="font-medium text-foreground" data-testid="stat-nth">{stats.nth}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Relative Dates</span>
              <span className="font-medium text-foreground" data-testid="stat-relative">{stats.relative}</span>
            </div>
            <div className="pt-2 border-t border-border">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-foreground">Total Events</span>
                <span className="font-semibold text-primary" data-testid="stat-total">{stats.total}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
