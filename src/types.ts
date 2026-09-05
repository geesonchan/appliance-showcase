export type Lang = "en" | "zh";

export type Category =
  | "refrigerator"
  | "range"
  | "cooktop"
  | "wall-oven"
  | "dishwasher"
  | "hood"
  | "microwave"
  | "wine"
  | "other";

export type Fuel = "gas" | "electric" | "induction" | "dual";

export type SlotId =
  | "slot-fridge"
  | "slot-range"
  | "slot-hood"
  | "slot-dishwasher"
  | "slot-wall-oven"
  | "slot-microwave";

export type UtilityType = "gas" | "power" | "water" | "duct";

export type CabinetType = "base" | "tall" | "upper" | "enclosure" | "countertop-cutout";

export type DuctRoute = "up-through-cabinet" | "back-wall" | "recirc";

export interface CabinetConfig {
  type: CabinetType;
  openingIn: { w: number; h: number; d: number };
  panelReady: boolean;
  finishedSides: number;
}

export interface Utilities {
  gas?: { pipeSize: '1/2"' | '3/4"'; shutoff: boolean };
  power: { voltage: 120 | 240; amps: number; dedicated: boolean };
  water?: { supply: boolean; drain: boolean };
  duct?: { diameterIn: 6 | 8 | 10; route: DuctRoute };
}

export interface Slot {
  id: SlotId;
  /** i18n key resolved through t(); the brief's {en, zh} pair lives in the string tables. */
  labelKey: string;
  /** Scene position in feet: floor-level centre of the appliance footprint. */
  position: [number, number, number];
  /** Rotation about Y in radians. 0 faces +Z (out from the back wall). */
  rotationY: number;
  /** Rough opening at this position, in inches. */
  cutout: { w: number; h: number; d: number };
  compatibleCategories: Category[];
  cabinetConfig: CabinetConfig;
  utilities: Utilities;
}

export interface Appliance {
  id: string;
  category: Category;
  brand: string;
  model: string;
  series?: string;
  priceUSD: number;
  fuel?: Fuel;
  widthIn: number;
  heightIn: number;
  depthIn: number;
  cutoutWidthIn?: number;
  cutoutHeightIn?: number;
  cutoutDepthIn?: number;
  finish: Finish[];
  leadTimeWeeks?: number;
  highlights: { en: string[]; zh: string[] };
  imageUrl?: string;
  slot: SlotId;
  installType: string;
  requires: {
    gasBTU?: number;
    voltage: 120 | 240;
    amps?: number;
    water?: boolean;
    cfm?: number;
    makeupAirRequired?: boolean;
  };
}

/** Finishes the procedural ApplianceModel knows how to render. */
export type Finish = "stainless" | "panel-ready" | "matte-black" | "white";

export interface Scheme {
  id: string;
  nameKey: string;
  conceptKey: string;
  palette: string[];
  defaultSelection: Record<SlotId, string>;
}

export type RenderMode = "realistic" | "white" | "install";
export type Lighting = "day" | "night";
