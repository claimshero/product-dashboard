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
  date: string;
  lineIndex: number;
}
