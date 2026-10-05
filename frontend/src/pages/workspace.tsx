import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { History, Loader2, Menu, MessageSquare, Moon, Sun, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { AppConfig, ChatMessage, LLMSettings, Provider, QueryResult, Source } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLocalState } from "@/hooks/use-local-state";
import { useTheme } from "@/hooks/use-theme";
import { Sidebar, type SourceMode } from "@/components/app/sidebar";
import { ResultCard } from "@/components/app/result-card";
import { EmptyState } from "@/components/app/empty-state";
import { ChatInput } from "@/components/app/chat-input";
import { HistoryPanel } from "@/components/app/history-panel";
import { ShaderCanvas } from "@/components/zen/shader-canvas";

type AssistantMessage = Extract<ChatMessage, { role: "assistant" }> & { sourceId?: string };
type Message = Extract<ChatMessage, { role: "user" }> | AssistantMessage;

const uid = () => Math.random().toString(36).slice(2);

/** The QueryMate app: sidebar + chat / history. */
export default function Workspace() {
  const { theme, toggle } = useTheme();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [prefs, setPrefs] = useLocalState<{ provider: Provider; model: string; temperature: number } | null>("querymate.llm", null);
  const [apiKeys, setApiKeys] = useLocalState<Record<string, string>>("querymate.keys", {}, "session");
  const [mode, setMode] = useLocalState<SourceMode>("querymate.mode", "chinook");
  const [sources, setSources] = useState<Partial<Record<SourceMode, Source>>>({});
  const [loadingSource, setLoadingSource] = useState(false);
  const [notice, setNotice] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"chat" | "history">("chat");
  const [historyKey, setHistoryKey] = useState(0);
  const [drawer, setDrawer] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const provider: Provider = prefs?.provider ?? config?.default_provider ?? "gemini";
  const llm: LLMSettings = {
    provider,
    model: prefs?.model ?? config?.default_models[provider] ?? "",
    temperature: prefs?.temperature ?? 0,
    apiKey: apiKeys[provider] ?? "",
  };
  const setLlm = (s: LLMSettings) => {
    setPrefs({ provider: s.provider, model: s.model, temperature: s.temperature });
    setApiKeys({ ...apiKeys, [s.provider]: s.apiKey });
  };
  const source = sources[mode] ?? null;

  useEffect(() => {
    api.config().then(setConfig).catch((e) => setNotice(e.message));
  }, []);

  // Load the Chinook schema the first time the demo source is selected.
  useEffect(() => {
    if (mode !== "chinook" || sources.chinook) return;
    setLoadingSource(true);
    api
      .source("chinook")
      .then((s) => setSources((prev) => ({ ...prev, chinook: s })))
      .catch((e) => setNotice(e.message))
      .finally(() => setLoadingSource(false));
  }, [mode, sources.chinook]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const loadSource = async (kind: SourceMode, load: () => Promise<Source>) => {
    setLoadingSource(true);
    setNotice("");
    try {
      const s = await load();
      setSources((prev) => ({ ...prev, [kind]: s }));
    } catch (e) {
      setNotice(`📄 ${(e as Error).message}`);
    } finally {
      setLoadingSource(false);
    }
  };

  const ask = useCallback(
    async (question: string) => {
      if (!source) return;
      setTab("chat");
      setDrawer(false);
      // Follow-ups: the last 3 successful Q&A pairs on this same data source.
      const history = messages
        .filter((m): m is AssistantMessage => m.role === "assistant" && !!m.result && !m.result.error_kind && m.sourceId === source.source_id)
        .slice(-3)
        .map((m) => ({ question: m.result!.question, sql: m.result!.sql }));
      const pendingId = uid();
      setMessages((prev) => [...prev, { id: uid(), role: "user", text: question }, { id: pendingId, role: "assistant", pending: true }]);
      setBusy(true);
      let update: Partial<AssistantMessage>;
      try {
        const result: QueryResult = await api.query(question, source.source_id, history, llm);
        update = { result, sourceId: source.source_id };
      } catch (e) {
        update = { error: e instanceof ApiError ? e.message : String(e) };
      }
      setMessages((prev) => prev.map((m) => (m.id === pendingId ? { ...(m as AssistantMessage), ...update, pending: false } : m)));
      setBusy(false);
      setHistoryKey((k) => k + 1);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, messages, llm.provider, llm.model, llm.apiKey, llm.temperature],
  );

  const explain = async (id: string, result: QueryResult) => {
    let explanation: string;
    try {
      explanation = (await api.explain(result.question, result.sql, llm)).explanation;
    } catch (e) {
      explanation = `⚠️ ${(e as Error).message}`;
    }
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...(m as AssistantMessage), explanation } : m)));
  };

  const needsKey = config && !llm.apiKey && !config.server_keys[llm.provider];

  const sidebar = (
    <Sidebar
      config={config}
      llm={llm}
      setLlm={setLlm}
      mode={mode}
      setMode={(m) => {
        setMode(m);
        setNotice("");
      }}
      source={source}
      loadingSource={loadingSource}
      onUpload={(files) => loadSource("upload", () => api.upload(files))}
      onConnect={(url) => loadSource("connection", () => api.connect(url))}
      onClear={() => setMessages([])}
    />
  );

  return (
    <div className="relative flex h-[100dvh] flex-col bg-background">
      {/* Ambient metal shader behind the whole app, dimmed so content stays readable. */}
      <div className="pointer-events-none fixed inset-0">
        <ShaderCanvas resolution={0.25} fold={1.4} scale={2.2} glow={0.25} speed={0.5} seed={3} fps={24} />
        <div className="absolute inset-0 bg-background/[0.86] backdrop-blur-[2px]" />
      </div>
      <header className="relative z-20 flex items-center gap-3 border-b bg-background/40 px-4 py-3 backdrop-blur-xl">
        <button className="rounded-lg p-2 hover:bg-accent lg:hidden" onClick={() => setDrawer(true)} aria-label="Open settings">
          <Menu className="h-5 w-5" />
        </button>
        <Link to="/" className="font-display text-lg font-bold tracking-tight">
          QueryMate<sup className="ml-0.5 text-[10px] text-primary">©</sup>
        </Link>
        <span className="label-mono hidden md:inline">/ workspace</span>
        <nav className="ml-auto flex gap-1 rounded-xl border bg-muted p-1 text-sm">
          {(
            [
              ["chat", "Chat", MessageSquare],
              ["history", "Query history", History],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn("relative flex items-center gap-1.5 rounded-lg px-3 py-1.5", tab === id ? "text-primary-foreground" : "hover:text-primary")}
            >
              {tab === id && <motion.span layoutId="tab" className="absolute inset-0 rounded-lg bg-primary" transition={{ type: "spring", bounce: 0.2 }} />}
              <Icon className="relative h-4 w-4" />
              <span className="relative hidden sm:inline">{label}</span>
            </button>
          ))}
        </nav>
        <button onClick={toggle} className="rounded-lg p-2 hover:bg-accent" aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1">
        <aside className="hidden w-80 shrink-0 overflow-y-auto border-r bg-background/50 p-5 backdrop-blur-xl lg:block">{sidebar}</aside>

        <AnimatePresence>
          {drawer && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} className="fixed inset-0 z-40 bg-black/50 lg:hidden" />
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 26, stiffness: 260 }}
                className="fixed inset-y-0 left-0 z-50 w-[min(22rem,90vw)] overflow-y-auto border-r bg-background p-5 lg:hidden"
              >
                <button className="mb-4 rounded-lg p-2 hover:bg-accent" onClick={() => setDrawer(false)} aria-label="Close settings">
                  <X className="h-5 w-5" />
                </button>
                {sidebar}
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
            <div className="mx-auto max-w-4xl space-y-5">
              {notice && <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">{notice}</div>}
              {needsKey && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  🔑 Add a {llm.provider === "gemini" ? "Gemini" : "OpenAI"} API key in the settings panel to start asking questions.
                </div>
              )}

              {tab === "history" ? (
                <HistoryPanel refreshKey={historyKey} />
              ) : !source ? (
                <div className="py-16 text-center text-muted-foreground">
                  {loadingSource ? (
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                  ) : mode === "upload" ? (
                    "📄 Upload one or more CSV / Excel files in the settings panel to start."
                  ) : mode === "connection" ? (
                    "🔌 Paste a connection string under Advanced in the settings panel."
                  ) : (
                    "Loading the demo database…"
                  )}
                </div>
              ) : messages.length === 0 ? (
                <EmptyState examples={config?.examples ?? []} onPick={ask} isDemo={mode === "chinook"} />
              ) : (
                <AnimatePresence initial={false}>
                  {messages.map((m) => (
                    <motion.div key={m.id} initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", damping: 22, stiffness: 220 }}>
                      {m.role === "user" ? (
                        <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 font-medium text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)]">{m.text}</div>
                      ) : (
                        <div className="glass glass-chroma rounded-[1.5rem] p-4 md:p-6">
                          {m.pending ? (
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <span className="flex gap-1">
                                {[0, 1, 2].map((i) => (
                                  <motion.span key={i} className="h-2 w-2 rounded-full bg-primary" animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.12 }} />
                                ))}
                              </span>
                              Thinking in SQL…
                            </div>
                          ) : m.error ? (
                            <div className="text-sm text-red-500">⚠️ {m.error}</div>
                          ) : (
                            m.result && <ResultCard result={m.result} explanation={m.explanation} onExplain={() => explain(m.id, m.result!)} />
                          )}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
              <div ref={bottomRef} />
            </div>
          </div>
          {tab === "chat" && (
            <div className="border-t bg-background/40 px-4 py-3 backdrop-blur-xl md:px-8">
              <div className="mx-auto max-w-4xl">
                <ChatInput onSend={ask} busy={busy} disabled={!source} />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
