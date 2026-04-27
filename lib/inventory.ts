// src/lib/inventory.ts
import { createDevice } from "./factory";
import { pjLinkDef } from "./devices/PjLinkDevice";
import { brightSignDef } from "./devices/BrightSignDevice";

export const inventory = [
  createDevice(pjLinkDef, { id: "pj-01", ip: "192.168.1.100" }),
  createDevice(brightSignDef, { id: "bs-01", ip: "192.168.1.110" }), 
] as const;