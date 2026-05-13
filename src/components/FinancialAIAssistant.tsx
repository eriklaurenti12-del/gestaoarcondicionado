import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Send, AlertTriangle, CheckCircle2, Loader2, Wand2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AISnapshot {
  // texto exibido no header de status
  headline?: string;
  // qualquer payload que o edge function entende (formato livre por contexto)
  [k: string]: any;
  issues?: { id: string; label: string; fix?: string; severity: "warn" | "error" | "info" }[];
}

// retro-compat
export interface FinancialSnapshot extends AISnapshot {
  month: string;
  cards: {
    servicos: number; produtos: number; contratos: number;
    gastosRotas: number; gastosFixos: number; saques: number;
    reservas: number; saldo: number;
    totalEntradas: number; totalDespesas: number;
  };
  counts: { records: number; manual: number; auto: number; sales: number; activeContracts: number };
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  buildSnapshot: () => Promise<AISnapshot> | AISnapshot;
  onAction?: (actionId: string) => void;
  /** "financeiro" (default) | "agenda" | "contratos" — define o prompt do edge */
  context?: "financeiro" | "agenda" | "contratos";
  /** Título do diálogo */
  title?: string;
  /** Texto-placeholder do input */
  placeholder?: string;
  /** Sumário rápido (renderizado no painel de status) */
  renderSummary?: (snap: AISnapshot) => React.ReactNode;
}

type Msg = { role: "user" | "assistant"; content: string };

export default function FinancialAIAssistant({
  open,
  onOpenChange,
  buildSnapshot,
  onAction,
  context = "financeiro",
  title,
  placeholder,
  renderSummary,
}: Props) {
  const { toast } = useToast();
  const [snapshot, setSnapshot] = useState<AISnapshot | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [snapLoading, setSnapLoading] = useState(false);
  const [diagOpen, setDiagOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      // reset transient state when closing to keep UX fluido
      setSnapshot(null);
      setMsgs([]);
      setInput("");
      setLoading(false);
      setSnapLoading(false);
      return;
    }
    let cancelled = false;
    setSnapLoading(true);
    setSnapshot(null);
    (async () => {
      try {
        const snap = await buildSnapshot();
        if (!cancelled) setSnapshot(snap);
      } catch (e: any) {
        if (!cancelled) toast({ title: "Erro ao montar diagnóstico", description: e.message, variant: "destructive" });
      } finally {
        if (!cancelled) setSnapLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, loading]);

  const callAI = async (userMsg: string, history: Msg[]) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("financial-ai-assistant", {
        body: { message: userMsg, history, snapshot, context },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha na IA");
      setMsgs((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (e: any) {
      setMsgs((m) => [...m, { role: "assistant", content: `⚠️ ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next);
    await callAI(text, msgs);
  };

  const runAutoDiagnose = async () => {
    if (!snapshot) return;
    const next = [...msgs, { role: "user" as const, content: "Diagnostique e me mostre o que corrigir." }];
    setMsgs(next);
    await callAI(next[next.length - 1].content, msgs);
  };

  const finalTitle = title || (
    context === "agenda" ? "Assistente IA da Agenda" :
    context === "contratos" ? "Assistente IA dos Contratos" :
    "Assistente IA do Financeiro"
  );

  // Default summary (financeiro) — outras abas passam renderSummary próprio
  const defaultSummary = (snap: AISnapshot) => {
    if (snap.cards) {
      return (
        <div className="grid grid-cols-2 gap-1 text-[11px]">
          <span>Entradas: <b>R$ {Number(snap.cards.totalEntradas || 0).toFixed(2)}</b></span>
          <span>Despesas: <b>R$ {Number(snap.cards.totalDespesas || 0).toFixed(2)}</b></span>
          <span>Saldo: <b className={snap.cards.saldo < 0 ? "text-red-600" : "text-emerald-600"}>R$ {Number(snap.cards.saldo || 0).toFixed(2)}</b></span>
          <span>Contratos: <b>R$ {Number(snap.cards.contratos || 0).toFixed(2)}</b></span>
        </div>
      );
    }
    if (snap.headline) return <p className="text-[11px] text-muted-foreground">{snap.headline}</p>;
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {finalTitle}
          </DialogTitle>
        </DialogHeader>

        {snapshot && (
          <div className="border rounded-md bg-muted/30">
            <button
              type="button"
              onClick={() => setDiagOpen((v) => !v)}
              className="w-full flex items-center justify-between p-2 text-xs font-medium"
            >
              <span className="flex items-center gap-2">
                {(snapshot.issues?.length ?? 0) === 0 ? (
                  <><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Tudo certo</>
                ) : (
                  <><AlertTriangle className="h-4 w-4 text-amber-600" /> {snapshot.issues!.length} ponto(s) para revisar</>
                )}
              </span>
              <span className="text-muted-foreground">{diagOpen ? "ocultar" : "mostrar"}</span>
            </button>
            {diagOpen && (
              <div className="px-3 pb-3 space-y-2">
                {(renderSummary || defaultSummary)(snapshot)}
                {(snapshot.issues?.length ?? 0) > 0 && (
                  <ul className="space-y-1 text-xs">
                    {snapshot.issues!.map((i) => (
                      <li key={i.id} className="flex items-start gap-2">
                        <AlertTriangle className={`h-3.5 w-3.5 mt-0.5 ${i.severity === "error" ? "text-red-600" : "text-amber-600"}`} />
                        <div className="flex-1">
                          <div>{i.label}</div>
                          {i.fix && onAction && (
                            <Button size="sm" variant="link" className="h-auto p-0 text-xs" onClick={() => onAction(i.id)}>
                              <Wand2 className="h-3 w-3 mr-1" /> {i.fix}
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <Button size="sm" variant="outline" className="w-full" onClick={runAutoDiagnose} disabled={loading}>
                  <Sparkles className="h-3.5 w-3.5 mr-1" /> Pedir explicação detalhada à IA
                </Button>
              </div>
            )}
          </div>
        )}

        <ScrollArea className="flex-1 min-h-[200px] border rounded-md p-2" ref={scrollRef as any}>
          {msgs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              {placeholder || 'Pergunte sobre o estado atual...'}
            </p>
          ) : (
            <div className="space-y-2">
              {msgs.map((m, i) => (
                <div key={i} className={`text-sm rounded-md px-2 py-1.5 ${m.role === "user" ? "bg-primary/10 ml-8" : "bg-muted mr-8"}`}>
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="bg-muted mr-8 rounded-md px-2 py-1.5 text-sm flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> pensando...
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder="Pergunte algo sobre esta aba..."
            disabled={loading}
          />
          <Button onClick={send} disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
