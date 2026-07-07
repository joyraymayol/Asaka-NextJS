// Raw Traccar REST API response shapes. These must never reach a Client
// Component directly -- always map through lib/traccar/dto.ts first, since
// fields like `password`/`token`/`attributes` should never leave the server.

export type TraccarUser = {
  id: number;
  name: string;
  login: string;
  email: string;
  phone: string;
  readonly: boolean;
  administrator: boolean;
  map: string;
  latitude: number;
  longitude: number;
  zoom: number;
  twelveHourFormat: boolean;
  coordinateFormat: string;
  disabled: boolean;
  expirationTime: string | null;
  deviceLimit: number;
  userLimit: number;
  deviceReadonly: boolean;
  token: string | null;
  limitCommands: boolean;
  poiLayer: string;
  password: string | null;
  attributes: Record<string, unknown>;
};

export type TraccarDevice = {
  id: number;
  attributes: Record<string, unknown>;
  groupId: number;
  calendarId: number;
  name: string;
  uniqueId: string;
  status: "online" | "offline" | "unknown";
  lastUpdate: string | null;
  positionId: number;
  phone: string;
  model: string;
  contact: string;
  category: string | null;
  disabled: boolean;
  expirationTime: string | null;
  geofenceIds: number[];
};

export type TraccarPosition = {
  id: number;
  attributes: Record<string, unknown>;
  deviceId: number;
  protocol: string;
  serverTime: string;
  deviceTime: string;
  fixTime: string;
  outdated: boolean;
  valid: boolean;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  course: number;
  address: string | null;
  accuracy: number;
  network: Record<string, unknown> | null;
};

// Shape of messages pushed over Traccar's /api/socket -- any subset of these
// keys may be present in a given message, never all at once.
export type TraccarWsMessage = {
  devices?: TraccarDevice[];
  positions?: TraccarPosition[];
  events?: TraccarEvent[];
};

export type TraccarEvent = {
  id: number;
  attributes: Record<string, unknown>;
  deviceId: number;
  type: string;
  eventTime: string;
  positionId: number;
  geofenceId: number;
  maintenanceId: number;
};
