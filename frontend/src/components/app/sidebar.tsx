import { useRef, useState } from "react";
import { Database, Eraser, FileUp, KeyRound, Loader2, Music2, Plug, Settings2 } from "lucide-react";
import type { AppConfig, LLMSettings, Provider, Source } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SchemaExplorer } from "./schema-explorer";

export type SourceMode = "chinook" | "upload" | "connection";

interface Props {
  config: AppConfig | null;
  llm: LLMSettings;
  setLlm: (s: LLMSettings) => void;
  mode: SourceMode;
  setMode: (m: SourceMode) => void;
  source: Source | null;
  loadingSource: boolean;
  onUpload: (files: File[]) => void;
  onConnect: (url: string) => void;
  onClear: () => void;
}

const field = "w-full rounded-lg border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function Section({ icon: Icon, title, children }: { icon: typeof Database; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="label-mono flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-primary" /> {title}
      </h3>
      {children}
    </section>
  );
}

/** Model settings, data source, schema explorer and clear chat. */
export function Sidebar(p: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [drag, setDrag] = useState(false);
  const models = p.config?.models[p.llm.provider] ?? [p.llm.model];
  const serverKey = p.config?.server_keys[p.llm.provider];

  const setProvider = (provider: Provider) =>
    p.setLlm({ ...p.llm, provider, model: p.config?.default_models[provider] ?? p.config?.models[provider][0] ?? "" });

  const modes: { id: SourceMode; label: string; icon: typeof Database }[] = [
    { id: "chinook", label: "Chinook demo", icon: Music2 },
    { id: "upload", label: "Upload files", icon: FileUp },
    { id: "connection", label: "Connection", icon: Plug },
  ];

  return (
    <div className="space-y-8">
      <Section icon={Settings2} title="Model">
        <div className="grid grid-cols-2 gap-1 rounded-xl border bg-muted p-1">
          {(["gemini", "openai"] as Provider[]).map((prov) => (
            <button
              key={prov}
              onClick={() => setProvider(prov)}
              className={cn("rounded-lg py-1.5 text-sm font-medium transition-colors", p.llm.provider === prov ? "bg-primary text-primary-foreground shadow" : "hover:bg-accent")}
            >
              {prov === "gemini" ? "Gemini" : "OpenAI"}
            </button>
          ))}
        </div>
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Model</span>
          <select className={field} value={p.llm.model} onChange={(e) => p.setLlm({ ...p.llm, model: e.target.value })}>
            {models.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="flex items-center gap-1 text-muted-foreground">
            <KeyRound className="h-3.5 w-3.5" /> API key
          </span>
          <input
            type="password"
            className={field}
            value={p.llm.apiKey}
            placeholder={serverKey ? "Using the server's key" : p.llm.provider === "gemini" ? "Paste a Gemini key" : "sk-..."}
            onChange={(e) => p.setLlm({ ...p.llm, apiKey: e.target.value })}
            autoComplete="off"
          />
          <span className="block text-[11px] text-muted-foreground">Kept in this browser tab only and sent straight to your API.</span>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="flex justify-between text-muted-foreground">
            Temperature <span className="font-mono">{p.llm.temperature.toFixed(2)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={p.llm.temperature}
            onChange={(e) => p.setLlm({ ...p.llm, temperature: Number(e.target.value) })}
            className="w-full accent-[var(--primary)]"
          />
        </label>
      </Section>

      <Section icon={Database} title="Data source">
        <div className="grid grid-cols-3 gap-1.5">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => p.setMode(m.id)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-[11px] font-medium transition-all",
                p.mode === m.id ? "border-primary bg-accent text-accent-foreground" : "hover:border-primary/50",
              )}
            >
              <m.icon className="h-4 w-4" /> {m.label}
            </button>
          ))}
        </div>

        {p.mode === "upload" && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              if (e.dataTransfer.files.length) p.onUpload([...e.dataTransfer.files]);
            }}
            onClick={() => fileRef.current?.click()}
            className={cn("cursor-pointer rounded-xl border-2 border-dashed p-5 text-center text-sm transition-colors", drag ? "border-primary bg-accent" : "hover:border-primary/60")}
          >
            <FileUp className="mx-auto mb-2 h-6 w-6 text-primary" />
            Drop CSV / Excel files or <span className="font-semibold text-primary">browse</span>
            <div className="mt-1 text-[11px] text-muted-foreground">Each file or sheet becomes a table · max {p.config?.max_upload_mb ?? 50} MB</div>
            <input
              ref={fileRef}
              type="file"
              multiple
              hidden
              accept=".csv,.xlsx,.xls"
              onChange={(e) => {
                if (e.target.files?.length) p.onUpload([...e.target.files]);
                e.target.value = "";
              }}
            />
          </div>
        )}

        {p.mode === "connection" && (
          <details open className="rounded-xl border p-3 text-sm">
            <summary className="cursor-pointer font-medium">Advanced</summary>
            <form
              className="mt-3 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (url.trim()) p.onConnect(url.trim());
              }}
            >
              <input type="password" className={field} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="postgresql+psycopg2://user:pass@host/db" />
              <p className="text-[11px] text-muted-foreground">Use a read-only database user. PostgreSQL, MySQL and SQLite are supported.</p>
              <button className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground">Connect</button>
            </form>
          </details>
        )}
      </Section>

      <Section icon={Database} title="Schema explorer">
        {p.loadingSource ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading schema…
          </div>
        ) : (
          <SchemaExplorer source={p.source} />
        )}
      </Section>

      <button onClick={p.onClear} className="flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium hover:border-primary hover:text-primary">
        <Eraser className="h-4 w-4" /> Clear chat
      </button>
    </div>
  );
}
