import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next dev blocks cross-origin requests to dev-only assets/HMR by default,
  // trusting only localhost -- without this, loading the app from another
  // device on the LAN (e.g. a phone during testing) serves the initial HTML
  // fine but silently fails to hydrate (no chunk/HMR requests get through),
  // leaving every client component dead: no click handlers, no dynamically
  // imported components (e.g. the live map) ever mount.
  allowedDevOrigins: ["192.168.0.104"],
};

export default nextConfig;
