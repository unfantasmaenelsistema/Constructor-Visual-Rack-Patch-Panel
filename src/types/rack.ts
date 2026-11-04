export type DeviceCategory =
  | 'ups'
  | 'server'
  | 'switch'
  | 'patch_panel'
  | 'cable_manager'
  | 'router'
  | 'fan_tray'
  | 'pdu'
  | 'blank_panel';

export type CableColor = 'blue' | 'yellow' | 'red' | 'green' | 'purple';

export interface CableColorSpec {
  id: CableColor;
  name: string;
  hex: string;
  strokeHex: string;
  usage: string;
  normativeNote: string;
  vlanTag: string;
}

export interface RackDeviceTemplate {
  id: string;
  name: string;
  shortName: string;
  category: DeviceCategory;
  uHeight: 1 | 2;
  weightKg: number;
  heatOutputWatts: number;
  airflowDissipation: number; // positive means it cools / helps airflow
  portsCount: number;
  idealZoneLabel: string;
  idealURange: [number, number]; // [minU, maxU] in a 12U rack
  modelCode: string;
  description: string;
  didacticPrinciple: string;
}

export interface PlacedDevice {
  instanceId: string;
  templateId: string;
  bottomU: number; // 1-indexed from bottom (U1 is floor/base, U12 is top)
}

export type OutletServiceType =
  | 'workstation'
  | 'wifi_ap'
  | 'wan_uplink'
  | 'server_nas'
  | 'voip_phone';

export interface WallOutlet {
  id: string;
  code: string; // e.g. "TO-01"
  label: string; // e.g. "PC Profesor (Aula 101)"
  roomZone: string; // e.g. "Mesa Docente"
  serviceType: OutletServiceType;
  expectedColor: CableColor;
  patchPanelPort: number; // 1..24 pre-punched rear IDC Krone block port
  requiresPoE?: boolean;
}

export interface PatchCable {
  id: string;
  fromInstanceId: string;
  fromPort: number;
  toInstanceId: string;
  toPort: number;
  color: CableColor;
}

export interface ScenarioDefinition {
  id: string;
  title: string;
  level: 'Inicial' | 'Intermedio' | 'Avanzado';
  environment: string;
  summary: string;
  objectives: string[];
  recommendedTemplates: string[];
  wallOutlets: WallOutlet[];
  needsServerLink: boolean;
  needsRouterUplink: boolean;
  messyInitialRack: { templateId: string; bottomU: number }[];
  optimalRack: { templateId: string; bottomU: number }[];
}

export interface UThermalSlot {
  u: number;
  temperatureC: number;
  status: 'optimal' | 'warm' | 'hot' | 'critical';
  heatSources: string[];
  airflowBlockedByCables: boolean;
}

export interface EvaluationBreakdownItem {
  id: string;
  category: string;
  score: number;
  maxScore: number;
  status: 'pass' | 'warning' | 'fail';
  findings: string[];
  didacticTip: string;
}

export interface RackEvaluationReport {
  totalScore: number;
  gradeLabel: string;
  centerOfGravityU: number;
  totalWeightKg: number;
  maxTemperatureC: number;
  avgTemperatureC: number;
  stabilityStatus: 'stable' | 'warning' | 'tipping_hazard';
  items: EvaluationBreakdownItem[];
}
