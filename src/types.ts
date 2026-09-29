export interface Student {
  process_number: number;
  name: string;
  gender: string;
  class_number: number;
  grade: number;
  class: string;
}

export const LIBRARIES = [
  "Biblioteca Escola Sede",
  "Biblioteca Escola de Mosteiro",
  "Biblioteca Escola Bela Vista",
  "Biblioteca Escola de Vinha"
] as const;

export type LibraryName = typeof LIBRARIES[number];

export interface UsageLog {
  id: number;
  process_number: number;
  library?: string;
  area: string;
  activity: string;
  entry_time: string;
  exit_time: string;
  date: string;
  name?: string;
  gender?: string;
  class_number?: number;
  grade?: number;
  class?: string;
}

export interface Space {
  id: number;
  library?: string;
  area: string;
  activity: string;
}

export interface OccupancyResponse {
  date: string;
  currentTime: string;
  library: string;
  libraries: string[];
  activeLogs: UsageLog[];
  allTodayLogs: UsageLog[];
  spaces: Space[];
  todayTotalCount: number;
  activeCount: number;
}
