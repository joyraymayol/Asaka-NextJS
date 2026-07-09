import { redirect } from "next/navigation";
import { z } from "zod";
import { listDevices } from "@/lib/dal/devices";
import { listRoutePositions } from "@/lib/dal/positions";
import { RouteMapView } from "./route-map-view";
import { BackButton } from "./back-button";

const paramsSchema = z.object({
  deviceId: z.coerce.number().int().positive(),
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export default async function RoutePage({
  searchParams,
}: {
  // Next 16: searchParams is a Promise and must be awaited.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = paramsSchema.safeParse(await searchParams);
  if (!parsed.success || parsed.data.from >= parsed.data.to) redirect("/devices");
  const { deviceId, from, to } = parsed.data;

  const [devices, positions] = await Promise.all([
    listDevices(),
    listRoutePositions(deviceId, from, to),
  ]);
  const device = devices.find((d) => d.id === deviceId);
  if (!device) redirect("/devices");

  const period = `${from.toLocaleString()} → ${to.toLocaleString()}`;

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{device.name}</span>
          <span className="text-muted-foreground text-xs">
            {period} · {positions.length} positions
          </span>
        </div>
        <BackButton />
      </div>
      {positions.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-muted-foreground text-sm">
            No recorded positions for {device.name} in this period.
          </p>
        </div>
      ) : (
        <div className="relative min-h-0 flex-1">
          <RouteMapView deviceName={device.name} positions={positions} />
        </div>
      )}
    </div>
  );
}
