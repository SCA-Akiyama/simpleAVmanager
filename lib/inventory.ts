import { PjLinkDevice } from "./devices/PjLinkDevice";
import { BrightSignDevice } from "./devices/BrightSignDevice";

export const inventory = [
  new PjLinkDevice("pj-01", "192.168.1.100"),
  new BrightSignDevice("bs-01", "192.168.1.110"),
];