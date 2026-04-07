import "dotenv/config";
import path from "path";

function required(name: string): string {
  const val = process.env[name];
  if (!val)
    throw new Error(`Missing required env var: ${name}. See .env.example`);
  return val;
}

export const config = {
  vaultPath: required("OBSIDIAN_VAULT_PATH"),
  userName: process.env.USER_NAME ?? "User",
  dailyNoteTemplate:
    process.env.DAILY_NOTE_TEMPLATE ?? "Templates/Daily Rundown.md",
  jiraBaseUrl: process.env.JIRA_BASE_URL ?? "",
  jiraEmail: process.env.JIRA_EMAIL ?? "",
  jiraApiToken: process.env.JIRA_API_TOKEN ?? "",
  chatPort: process.env.CHAT_PORT ?? "4001",
  port: process.env.PORT ?? "4000",
};

// Derived paths
export const DAILY_NOTES_DIR = path.join(config.vaultPath, "Daily");
export const TASKS_DIR = path.join(config.vaultPath, "Tasks");
export const TEMPLATE_PATH = path.join(
  config.vaultPath,
  config.dailyNoteTemplate
);
export const BETS_DIR = path.join(config.vaultPath, "Product/Bets");
export const CLIENTS_DIR = path.join(config.vaultPath, "Product/Clients");
export const PARTNERS_DIR = path.join(config.vaultPath, "Product/Partners");
export const MEETINGS_DIR = path.join(config.vaultPath, "Daily/meetings");

// Intelligence / Business directories
export const INTEL_DIR = path.join(config.vaultPath, "Business/Competitive Intelligence");
export const COMPETITORS_DIR = path.join(INTEL_DIR, "competitors");
export const BRIEFINGS_DIR = path.join(INTEL_DIR, "briefings/daily");
export const MARKET_SIGNALS_DIR = path.join(INTEL_DIR, "market/signals");
export const PARTNERSHIPS_DIR = path.join(config.vaultPath, "Business/Partnerships");
export const STRATEGY_DIR = path.join(config.vaultPath, "Business/Strategy");
