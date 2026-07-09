"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  getTripsForDeviceAction,
  refreshTripDistanceAction,
  startTripAction,
  stopTripAction,
} from "./actions";
import type { TripDTO } from "@/lib/dal/trips";

function formatKm(meters: number): string {
  return `${(meters / 1000).toFixed(2)} km`;
}

function formatElapsed(fromIso: string, toIso?: string | null): string {
  const ms = (toIso ? new Date(toIso) : new Date()).getTime() - new Date(fromIso).getTime();
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function ActiveTripRow({
  trip,
  onUpdated,
}: {
  trip: TripDTO;
  onUpdated: (trip: TripDTO) => void;
}) {
  const [isRefreshing, startRefresh] = useTransition();
  const [isStopping, startStop] = useTransition();

  function handleRefresh() {
    startRefresh(async () => {
      const result = await refreshTripDistanceAction(trip.id);
      if (result.error) toast.error(result.error);
      else if (result.trip) {
        onUpdated(result.trip);
        if (result.trip.status === "DISCARDED") {
          toast.error(`${trip.name} was invalidated: position history expired.`);
        }
      }
    });
  }

  function handleStop() {
    startStop(async () => {
      const result = await stopTripAction(trip.id);
      if (result.error) toast.error(result.error);
      else if (result.trip) {
        onUpdated(result.trip);
        toast.success(
          result.trip.status === "COMPLETED"
            ? `${trip.name} completed — ${formatKm(result.trip.distanceMeters)}`
            : `${trip.name} was invalidated: position history expired.`,
        );
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{trip.name}</span>
        <span className="text-muted-foreground text-xs">
          Started {new Date(trip.startedAt).toLocaleString()} · running {formatElapsed(trip.startedAt)}
        </span>
        <span className="text-xs">
          {formatKm(trip.distanceMeters)}
          <span className="text-muted-foreground">
            {trip.lastComputedFixTime
              ? ` as of ${new Date(trip.lastComputedFixTime).toLocaleString()}`
              : " — not calculated yet"}
          </span>
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing || isStopping}
          aria-label={`Refresh distance for ${trip.name}`}
        >
          <RefreshCw className={isRefreshing ? "animate-spin" : ""} />
          {isRefreshing ? "Updating…" : "Update"}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>Stop</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Stop “{trip.name}”?</AlertDialogTitle>
              <AlertDialogDescription>
                The final distance is calculated up to now and the trip moves to history. This cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleStop} disabled={isStopping}>
                {isStopping ? "Stopping…" : "Stop trip"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export function TripsDialog({
  deviceId,
  deviceName,
  trigger,
  triggerLabel,
}: {
  deviceId: number;
  deviceName: string;
  /** Rendered via Base UI's `render` prop; defaults to a small outline button. */
  trigger?: React.ReactElement;
  triggerLabel: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [trips, setTrips] = useState<TripDTO[] | null>(null);
  const [name, setName] = useState("");
  const [isLoading, startLoad] = useTransition();
  const [isStarting, startStartTrip] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setTrips(null);
      setName("");
      startLoad(async () => {
        const result = await getTripsForDeviceAction(deviceId);
        if (result.error) toast.error(result.error);
        setTrips(result.trips ?? []);
      });
    }
  }

  function upsertTrip(trip: TripDTO) {
    setTrips((current) => {
      if (!current) return current;
      const rest = current.filter((t) => t.id !== trip.id);
      return [trip, ...rest].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    });
  }

  function handleStart(e: React.FormEvent) {
    e.preventDefault();
    startStartTrip(async () => {
      const result = await startTripAction(deviceId, name);
      if (result.error) toast.error(result.error);
      else if (result.trip) {
        upsertTrip(result.trip);
        setName("");
        toast.success(`Trip "${result.trip.name}" started`);
      }
    });
  }

  const active = (trips ?? []).filter((t) => t.status === "ACTIVE");
  const history = (trips ?? []).filter((t) => t.status !== "ACTIVE");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger ?? <Button variant="outline" size="sm" />}>{triggerLabel}</DialogTrigger>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Trips — {deviceName}</DialogTitle>
          <DialogDescription>
            Distance is calculated from recorded GPS positions. Update a running trip at least once every
            few days so its history isn&apos;t lost to server cleanup.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleStart} className="flex items-end gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor={`trip-name-${deviceId}`} className="text-xs font-medium">
              New trip name
            </label>
            <Input
              id={`trip-name-${deviceId}`}
              value={name}
              maxLength={80}
              required
              placeholder="e.g. Cebu → Danao delivery"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={isStarting}>
            {isStarting ? "Starting…" : "Start trip"}
          </Button>
        </form>

        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Active {trips ? `(${active.length})` : ""}</TabsTrigger>
            <TabsTrigger value="history">History {trips ? `(${history.length})` : ""}</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="flex flex-col gap-2 pt-2">
            {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
            {trips && active.length === 0 && (
              <p className="text-muted-foreground text-sm">No running trips.</p>
            )}
            {active.map((trip) => (
              <ActiveTripRow key={trip.id} trip={trip} onUpdated={upsertTrip} />
            ))}
          </TabsContent>

          <TabsContent value="history" className="flex flex-col gap-2 pt-2">
            {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
            {trips && history.length === 0 && (
              <p className="text-muted-foreground text-sm">No finished trips yet.</p>
            )}
            {history.map((trip) => (
              <div key={trip.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium">{trip.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(trip.startedAt).toLocaleString()} →{" "}
                    {trip.endedAt ? new Date(trip.endedAt).toLocaleString() : "—"} (
                    {formatElapsed(trip.startedAt, trip.endedAt)})
                  </span>
                  {trip.invalidReason && (
                    <span className="text-destructive text-xs">{trip.invalidReason}</span>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant={trip.status === "COMPLETED" ? "default" : "destructive"}>
                    {trip.status === "COMPLETED" ? "Completed" : "Invalid"}
                  </Badge>
                  {trip.status === "COMPLETED" && (
                    <span className="text-sm font-medium">{formatKm(trip.distanceMeters)}</span>
                  )}
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
