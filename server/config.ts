import "dotenv/config";
import os from "os";
import path from "path";

// Dual-vault configuration
// - Personal vault: local-only. Contains Daily notes, Tasks, raw meeting notes.
// - Claimable vault: team-shared via Obsidian Sync. Contains Product, Business,
//   Reference, Templates, Agents.
// OBSIDIAN_VAULT_PATH is a legacy fallback used for either vault if the
// dedicated var is not set. Remove once the physical vault split is complete.
const legacyVaultPath = process.env.OBSIDIAN_VAULT_PATH;
const personalVaultPath =
  process.env.OBSIDIAN_PERSONAL_VAULT_PATH ?? legacyVaultPath;
const claimableVaultPath =
  process.env.OBSIDIAN_CLAIMABLE_VAULT_PATH ?? legacyVaultPath;

if (!personalVaultPath) {
  throw new Error(
    "Missing required env var: OBSIDIAN_PERSONAL_VAULT_PATH (or OBSIDIAN_VAULT_PATH as a transitional fallback). See .env.example"
  );
}
if (!claimableVaultPath) {
  throw new Error(
    "Missing required env var: OBSIDIAN_CLAIMABLE_VAULT_PATH (or OBSIDIAN_VAULT_PATH as a transitional fallback). See .env.example"
  );
}

export const config = {
  personalVaultPath,
  claimableVaultPath,
  userName: process.env.USER_NAME ?? "User",
  dailyNoteTemplate:
    process.env.DAILY_NOTE_TEMPLATE ?? "Templates/Daily Rundown.md",
  jiraBaseUrl: process.env.JIRA_BASE_URL ?? "",
  jiraEmail: process.env.JIRA_EMAIL ?? "",
  jiraApiToken: process.env.JIRA_API_TOKEN ?? "",
  chatPort: process.env.CHAT_PORT ?? "4001",
  port: process.env.PORT ?? "4000",
};

// Personal vault paths
export const DAILY_NOTES_DIR = path.join(personalVaultPath, "Daily");
export const TASKS_DIR = path.join(personalVaultPath, "Tasks");
export const MEETINGS_DIR = path.join(personalVaultPath, "Daily/meetings");

// Claimable vault paths
export const TEMPLATE_PATH = path.join(
  claimableVaultPath,
  config.dailyNoteTemplate
);
export const BETS_DIR = path.join(claimableVaultPath, "Product/Bets");
export const STRATEGY_DIR = path.join(claimableVaultPath, "Product/Strategy");
export const CLIENTS_DIR = path.join(claimableVaultPath, "Business/Clients");
export const PARTNERS_DIR = path.join(claimableVaultPath, "Business/Partners");
export const COMPETITORS_DIR = path.join(
  claimableVaultPath,
  "Business/Competitors"
);
export const BUSINESS_CONTEXT_DIR = path.join(
  claimableVaultPath,
  "Business/Context"
);
export const BRIEFINGS_DIR = path.join(
  claimableVaultPath,
  "Business/Briefings/daily"
);
export const WEEKLY_BRIEFINGS_DIR = path.join(
  claimableVaultPath,
  "Business/Briefings/weekly"
);
export const MARKET_SIGNALS_DIR = path.join(
  claimableVaultPath,
  "Business/Market/signals"
);

// Persistent app data (outside vault)
export const APP_SUPPORT_DIR = path.join(
  os.homedir(),
  "Library/Application Support/work-dashboard"
);
export const ATTACHMENTS_DIR = path.join(APP_SUPPORT_DIR, "attachments");
