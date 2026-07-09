import type { TraccarUser, TraccarDevice, TraccarPosition, TraccarWsMessage } from "@/lib/traccar/types";

// Strips password/token/attributes/map-position fields before anything
// reaches a Server/Client Component boundary.
export type UserDTO = {
  id: number;
  name: string;
  email: string;
  login: string;
  phone: string;
  administrator: boolean;
  readonly: boolean;
  deviceReadonly: boolean;
  limitCommands: boolean;
  disabled: boolean;
  deviceLimit: number;
  userLimit: number;
  expirationTime: string | null;
};

export function toUserDto(user: TraccarUser): UserDTO {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    login: user.login,
    phone: user.phone,
    administrator: user.administrator,
    readonly: user.readonly,
    deviceReadonly: user.deviceReadonly,
    limitCommands: user.limitCommands,
    disabled: user.disabled,
    deviceLimit: user.deviceLimit,
    userLimit: user.userLimit,
    expirationTime: user.expirationTime,
  };
}

export type DeviceDTO = {
  id: number;
  name: string;
  uniqueId: string;
  status: "online" | "offline" | "unknown";
  lastUpdate: string | null;
  category: string | null;
  disabled: boolean;
  positionId: number;
  geofenceIds: number[];
};

export function toDeviceDto(device: TraccarDevice): DeviceDTO {
  return {
    id: device.id,
    name: device.name,
    uniqueId: device.uniqueId,
    status: device.status,
    lastUpdate: device.lastUpdate,
    category: device.category,
    disabled: device.disabled,
    positionId: device.positionId,
    geofenceIds: device.geofenceIds,
  };
}

export type PositionDTO = {
  id: number;
  deviceId: number;
  fixTime: string;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  address: string | null;
};

export function toPositionDto(position: TraccarPosition): PositionDTO {
  return {
    id: position.id,
    deviceId: position.deviceId,
    fixTime: position.fixTime,
    latitude: position.latitude,
    longitude: position.longitude,
    speed: position.speed,
    course: position.course,
    address: position.address,
  };
}

export type LiveFeedMessage = {
  devices?: DeviceDTO[];
  positions?: PositionDTO[];
};

// Applied to every /ws/live relay frame (see server.ts) so the raw Traccar
// feed -- which includes attributes/network/protocol -- never reaches the
// browser, same as the REST-backed DAL calls above. Events are dropped here
// until Phase 6 adds an EventDTO for geofence notifications.
export function toLiveFeedMessage(raw: TraccarWsMessage): LiveFeedMessage {
  const message: LiveFeedMessage = {};
  if (raw.devices) message.devices = raw.devices.map(toDeviceDto);
  if (raw.positions) message.positions = raw.positions.map(toPositionDto);
  return message;
}
