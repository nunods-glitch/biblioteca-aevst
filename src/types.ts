export interface Student {
  process_number: number;
  name: string;
  gender: string;
  class_number: number;
  grade: number;
  class: string;
}

export interface UsageLog {
  id: number;
  process_number: number;
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
  area: string;
  activity: string;
}

export interface OccupancyResponse {
  date: string;
  currentTime: string;
  activeLogs: UsageLog[];
  allTodayLogs: UsageLog[];
  spaces: Space[];
  todayTotalCount: number;
  activeCount: number;
}
