// types.ts - Type definitions for Sonechka.OS

export interface AppState {
  version: "1.0";
  lastSaved: string; // ISO 8601
  events: Event[];
  meta: {
    userId: string; // UUID v4
    deviceName?: string;
    lastBackup?: string;
  };
}

export type Event =
  | { type: "app_init"; ts: string }
  | { type: "ritual_step_completed"; ts: string; ritualId: string; stepId: string }
  | { type: "med_taken"; ts: string; medId: string; dose?: number }
  | { type: "eye_drop_applied"; ts: string; dropType: "systane" | "emoxipin" | "midramax" }
  | { type: "watering_done"; ts: string; plantId: string }
  | { type: "glucose_measured"; ts: string; value: number }
  | { type: "plant_profile_updated"; ts: string; plantId: string; profile: PlantProfile }
  | { type: "focus_lost"; ts: string }
  | { type: "backup_created"; ts: string; path: string };

export interface PlantProfile {
  baseInterval: [number, number]; // [minDays, maxDays]
  winterMultiplier: number;
  humidityMultiplier?: number; // for plants that react to humidity
  criticality: 1 | 2 | 3 | 4 | 5; // 1 = lowest, 5 = highest
}

export interface PlantState {
  id: string;
  name: string;
  profile: PlantProfile;
  lastWatered?: string; // ISO 8601
  nextDue: string; // ISO 8601
  riskLevel: "low" | "medium" | "high";
  isWinter: boolean;
}

export interface RitualState {
  id: string;
  name: string;
  completed: boolean;
  steps: {
    id: string;
    name: string;
    completed: boolean;
    dependencies?: string[]; // IDs of steps that must be completed before this one
  }[];
  dependencies?: string[]; // IDs of rituals that must be completed before this one
}

export interface DerivedState {
  today: string; // "26.12.2025"
  rituals: Record<string, RitualState>;
  plants: Record<string, PlantState>;
  glucose: {
    last?: { value: number; ts: string };
    status: "low" | "optimal" | "high" | "unknown";
  };
  anchors: { selfcare?: string; plants?: string; health?: string };
  overdueCount: number;
}