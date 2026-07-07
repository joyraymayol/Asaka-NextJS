"use client";

import { useEffect, useRef, useState } from "react";
import type { DeviceDTO, PositionDTO, LiveFeedMessage } from "@/lib/traccar/dto";

const RECONNECT_DELAY_MS = 3000;

export function useLiveFeed(initialDevices: DeviceDTO[], initialPositions: PositionDTO[]) {
  const [devices, setDevices] = useState<Record<number, DeviceDTO>>(() =>
    Object.fromEntries(initialDevices.map((d) => [d.id, d])),
  );
  const [positions, setPositions] = useState<Record<number, PositionDTO>>(() =>
    Object.fromEntries(initialPositions.map((p) => [p.deviceId, p])),
  );
  const [connected, setConnected] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let socket: WebSocket | undefined;
    let cancelled = false;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/ws/live`);

      socket.addEventListener("open", () => setConnected(true));

      socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data) as LiveFeedMessage;
        if (message.devices?.length) {
          setDevices((prev) => {
            const next = { ...prev };
            for (const device of message.devices!) next[device.id] = device;
            return next;
          });
        }
        if (message.positions?.length) {
          setPositions((prev) => {
            const next = { ...prev };
            for (const position of message.positions!) next[position.deviceId] = position;
            return next;
          });
        }
      });

      socket.addEventListener("close", () => {
        setConnected(false);
        if (!cancelled) {
          reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      });

      socket.addEventListener("error", () => socket?.close());
    }

    connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer.current);
      socket?.close();
    };
  }, []);

  return { devices, positions, connected };
}
