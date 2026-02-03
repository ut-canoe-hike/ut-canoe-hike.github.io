export interface Env {
  GOOGLE_SERVICE_ACCOUNT_EMAIL: string;
  GOOGLE_PRIVATE_KEY: string;
  SHEET_ID: string;
  CALENDAR_ID: string;
  OFFICER_PASSCODE: string;
  ALLOWED_ORIGIN: string;
  SITE_BASE_URL?: string;
}

export interface Trip {
  tripId: string;
  eventId?: string;
  title: string;
  activity?: string;
  start: string;
  end?: string;
  location?: string;
  leaderName?: string;
  leaderContact?: string;
  difficulty?: string;
  meetTime?: string;
  meetPlace?: string;
  notes?: string;
  gearAvailable?: string[];
  isAllDay?: boolean;
}

export interface TripInput {
  title: string;
  activity?: string;
  startDate: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  location?: string;
  leaderName?: string;
  leaderContact?: string;
  difficulty?: string;
  meetTime?: string;
  meetPlace?: string;
  notes?: string;
  gearAvailable?: string[];
  officerSecret: string;
}

export interface RsvpInput {
  tripId: string;
  name: string;
  contact: string;
  carpool?: string;
  gearNeeded?: string[];
  notes?: string;
}

export interface SuggestionInput {
  name: string;
  email?: string;
  willingToLead?: string;
  idea: string;
  location?: string;
  timing?: string;
  notes?: string;
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
