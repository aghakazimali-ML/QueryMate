export type Provider = "gemini" | "openai";
export type ChartKind = "metric" | "line" | "bar" | "scatter" | "table";
export type Row = Record<string, unknown>;

export interface AppConfig {
  default_provider: Provider;
  models: Record<Provider, string[]>;
  default_models: Record<Provider, string>;
  server_keys: Record<Provider, boolean>;
  examples: string[];
  max_upload_mb: number;
}

export interface Chart {
  kind: ChartKind;
  x: string | null;
  y: string[];
  labels: Record<string, string>;
  value: unknown;
  label: string;
  data: Row[];
}

export interface QueryResult {
  question: string;
  sql: string;
  columns: string[];
  rows: Row[];
  row_count: number;
  summary: string;
  error: string;
  error_kind: "blocked" | "auth" | "llm" | "sql" | "timeout" | null;
  auto_fixed: boolean;
  attempts: { sql: string; error: string }[];
  tables_used: string[];
  limit_added: boolean;
  elapsed_ms: number;
  chart: Chart;
}

export interface Column {
  name: string;
  type: string;
  primary_key: boolean;
}

export interface Table {
  name: string;
  columns: Column[];
  foreign_keys: string[];
  sample: Row[];
}

export interface Source {
  source_id: string;
  kind: "chinook" | "upload" | "connection";
  label: string;
  tables: Table[];
}

export interface HistoryEntry {
  timestamp: string;
  question: string;
  sql: string;
  status: string;
  rows: number;
  time_ms: number;
  auto_fixed: boolean;
  error: string;
}

export interface LLMSettings {
  provider: Provider;
  model: string;
  apiKey: string;
  temperature: number;
}

export type ChatMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; result?: QueryResult; error?: string; pending?: boolean; explanation?: string };
