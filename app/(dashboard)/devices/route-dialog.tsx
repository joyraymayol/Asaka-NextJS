"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ROUTE_HISTORY_DAYS } from "@/lib/route-limits";

// Period boundaries are computed CLIENT-side on purpose: only the browser
// knows the user's timezone, and "today" means the user's local midnight,
// not the server's.
function localDayStart(daysAgo = 0): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

function withTime(day: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const d = new Date(day);
  d.setHours(hours || 0, minutes || 0, 0, 0);
  return d;
}

function formatTimeLabel(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(hours || 0, minutes || 0, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// A single "field" that looks like a text input but opens a popover with a
// single-date calendar + a time input on click -- the calendar itself stays
// hidden until the field is clicked, per user feedback that an always-open
// range calendar was more than needed for picking one start or end moment.
function DateTimeField({
  id,
  label,
  date,
  time,
  onDateChange,
  onTimeChange,
  fromDate,
  toDate,
  defaultMonth,
}: {
  id: string;
  label: string;
  date: Date | undefined;
  time: string;
  onDateChange: (date: Date | undefined) => void;
  onTimeChange: (time: string) => void;
  fromDate: Date;
  toDate: Date;
  defaultMonth: Date;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              className="w-full justify-start font-normal"
            />
          }
        >
          <CalendarIcon className="opacity-60" />
          {date ? `${date.toLocaleDateString(undefined, { dateStyle: "medium" })}, ${formatTimeLabel(time)}` : "Pick date & time"}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2.5">
          <Calendar
            mode="single"
            selected={date}
            onSelect={onDateChange}
            disabled={{ before: fromDate, after: toDate }}
            defaultMonth={date ?? defaultMonth}
          />
          <div className="flex flex-col gap-1 border-t px-1 pt-2.5">
            <Label htmlFor={`${id}-time`}>{label} time</Label>
            <Input
              id={`${id}-time`}
              type="time"
              value={time}
              onChange={(e) => onTimeChange(e.target.value)}
            />
          </div>
          {/* Explicit close, not just outside-click: this popover is nested
              inside the Route dialog, and a click meant to dismiss just the
              popover can land as an "outside click" for the dialog too and
              close both at once. A dedicated button always closes only this
              popover. */}
          <div className="border-t px-1 pt-2.5">
            <Button type="button" size="sm" className="w-full" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function RouteDialog({
  deviceId,
  deviceName,
  trigger,
}: {
  deviceId: number;
  deviceName: string;
  /** Rendered via Base UI's `render` prop; defaults to a small outline button. */
  trigger?: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState("today");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [startTime, setStartTime] = useState("00:00");
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [endTime, setEndTime] = useState("23:59");
  const [error, setError] = useState<string | undefined>();
  const [isNavigating, startNavigate] = useTransition();

  const today = localDayStart();
  const oldestSelectable = localDayStart(ROUTE_HISTORY_DAYS - 1);

  function view(from: Date, to: Date) {
    const params = new URLSearchParams({
      deviceId: String(deviceId),
      from: from.toISOString(),
      to: to.toISOString(),
    });
    // Deliberately don't close the dialog here: startTransition keeps this
    // component mounted with isNavigating=true (showing pending feedback on
    // the button below) until the /routes page's data is ready, instead of
    // leaving the user staring at the current page wondering if anything
    // happened. The dialog disappears naturally once the page it's part of
    // is replaced by the completed navigation.
    startNavigate(() => {
      router.push(`/routes?${params}`);
    });
  }

  function handleView() {
    setError(undefined);
    if (period === "today") {
      view(localDayStart(), new Date());
      return;
    }
    if (period === "yesterday") {
      view(localDayStart(1), localDayStart());
      return;
    }
    if (!startDate || !endDate) {
      setError("Pick a start and end date first.");
      return;
    }
    const from = withTime(startDate, startTime);
    const to = withTime(endDate, endTime);
    if (from >= to) {
      setError("The start must be before the end.");
      return;
    }
    view(from, to);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button variant="outline" size="sm" />}>Route</DialogTrigger>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Route — {deviceName}</DialogTitle>
          <DialogDescription>
            Show where this device travelled. History is available for the last {ROUTE_HISTORY_DAYS}{" "}
            days (older positions are cleaned up on the server).
          </DialogDescription>
        </DialogHeader>

        <Tabs value={period} onValueChange={(v) => setPeriod(v as string)}>
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="yesterday">Yesterday</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="pt-2">
            <p className="text-muted-foreground text-sm">From midnight until now.</p>
          </TabsContent>
          <TabsContent value="yesterday" className="pt-2">
            <p className="text-muted-foreground text-sm">The full previous day.</p>
          </TabsContent>
          <TabsContent value="custom" className="grid grid-cols-2 gap-3 pt-2">
            <DateTimeField
              id={`route-start-${deviceId}`}
              label="Start"
              date={startDate}
              time={startTime}
              onDateChange={setStartDate}
              onTimeChange={setStartTime}
              fromDate={oldestSelectable}
              toDate={today}
              defaultMonth={today}
            />
            <DateTimeField
              id={`route-end-${deviceId}`}
              label="End"
              date={endDate}
              time={endTime}
              onDateChange={setEndDate}
              onTimeChange={setEndTime}
              fromDate={oldestSelectable}
              toDate={today}
              defaultMonth={today}
            />
          </TabsContent>
        </Tabs>

        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button onClick={handleView} disabled={isNavigating}>
            {isNavigating ? "Loading route…" : "View route"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
