export type TaskUrgency = "high" | "medium" | "low" | null;

export interface Task {
  id: string;
  text: string;
  description: string;
  completed: boolean;
  betSlug: string | null;
  jiraKey: string | null;
  clientSlug: string | null;
  partnerSlug: string | null;
  urgency: TaskUrgency;
  category: string;
  createdDate: string;
  completedDate: string | null;
  lineIndex: number;
}

export interface ActivityEntry {
  category: string;
  text: string;
}

export interface DailyActivity {
  created: ActivityEntry[];
  completed: ActivityEntry[];
}
