import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { API, formatApiError } from "@/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, PaperPlaneTilt, Plus, FileText, Trash, CaretDown, CaretRight } from "@phosphor-icons/react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

export default function WorkspaceDetail() {
  const { id } = useParams();
  const [ws, setWs] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [currentConv, setCurrentConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [docs, setDocs] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef();
  const scrollRef = useRef();

  const loadWs = async () => {
    const [w, c, d] = await Promise.all([
      api.get(`/workspaces/${id}`),
      api.get(`/workspaces/${id}/conversations`),
      api.get(`/workspaces/${id}/documents`),
    ]);
    setWs(w.data); setConversations(c.data); setDocs(d.data);
    if (c.data.length > 0 && !currentConv) {
      selectConv(c.data[0]);
    }
  };
  useEffect(() => { loadWs(); }, [id]);

  const selectConv = async (conv) => {
    setCurrentConv(conv);
    const { data } = await api.get(`/conversations/${conv.id}/messages`);
    setMessages(data);
  };

  const newConv = async () => {
    const { data } = await api.post(`/workspaces/${id}/conversations`, { title: "New conversation" });
    setConversations([data, ...conversations]);
    setCurrentConv(data);
    setMessages([]);
  };

  const deleteConv = async (cid) => {
    if (!window.confirm("Delete conversation?")) return;
    await api.delete(`/conversations/${cid}`);
    if (currentConv?.id === cid) { setCurrentConv(null); setMessages([]); }
    const { data } = await api.get(`/workspaces/${id}/conversations`);
    setConversations(data);
  };

  const send = async () => {
    if (!input.trim() || sending) return;
    let conv = currentConv;
    if (!conv) {
      const { data } = await api.post(`/workspaces/${id}/conversations`, { title: "New conversation" });
      conv = data;
      setConversations((c) => [data, ...c]);
      setCurrentConv(data);
    }
    const userMsg = { id: "local-" + Date.now(), role: "user", content: input };
    setMessages((m) => [...m, userMsg]);
    const msg = input;
    setInput("");
    setSending(true);
    try {
      const { data } = await api.post(`/conversations/${conv.id}/chat`, { message: msg });
      setMessages((m) => [...m, data.assistant]);
      if (conv.title.startsWith("New conversation")) {
        const { data: convs } = await api.get(`/workspaces/${id}/conversations`);
        setConversations(convs);
        const updated = convs.find((c) => c.id === conv.id);
        if (updated) setCurrentConv(updated);
      }
    } catch (e) {
      toast.error(formatApiError(e));
      setMessages((m) => [...m, { id: "err-" + Date.now(), role: "assistant", content: "❌ " + formatApiError(e) }]);
    } finally { setSending(false); }
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const uploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post(`/workspaces/${id}/documents`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`Indexed ${file.name}`);
      const { data } = await api.get(`/workspaces/${id}/documents`);
      setDocs(data);
    } catch (er) { toast.error(formatApiError(er)); }
    finally { e.target.value = ""; }
  };

  const deleteDoc = async (docId) => {
    await api.delete(`/workspaces/${id}/documents/${docId}`);
    const { data } = await api.get(`/workspaces/${id}/documents`);
    setDocs(data);
  };

  if (!ws) return <div className="p-8 font-mono text-sm text-muted-foreground">[ loading... ]</div>;

  return (
    <div className="h-screen flex flex-col">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/workspaces" className="text-muted-foreground hover:text-white"><ArrowLeft size={16} /></Link>
          <div className="min-w-0">
            <div className="mono-label">// workspace</div>
            <div className="text-lg font-medium truncate">{ws.name}</div>
          </div>
        </div>
        <div className="font-mono text-[11px] text-muted-foreground">{docs.length} docs · {ws.asset_ids?.length || 0} tools</div>
      </div>

      <div className="flex-1 grid grid-cols-[260px_1fr_300px] overflow-hidden">
        {/* Conversations sidebar */}
        <div className="border-r border-border flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border">
            <Button className="w-full rounded-sm gap-2" onClick={newConv} data-testid="new-conversation"><Plus size={14} /> New chat</Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.map((c) => (
              <div key={c.id} className={`px-3 py-2.5 cursor-pointer border-b border-border/50 hover:bg-neutral-900 ${currentConv?.id === c.id ? "bg-neutral-900" : ""}`}
                onClick={() => selectConv(c)} data-testid={`conv-${c.id}`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="text-sm truncate">{c.title}</div>
                  <button onClick={(e) => { e.stopPropagation(); deleteConv(c.id); }} className="text-muted-foreground hover:text-red-400 shrink-0"><Trash size={12} /></button>
                </div>
                <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{new Date(c.created_at).toLocaleString()}</div>
              </div>
            ))}
            {conversations.length === 0 && <div className="p-4 text-xs text-muted-foreground font-mono">[ no conversations ]</div>}
          </div>
        </div>

        {/* Chat main */}
        <div className="flex flex-col overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-6 space-y-6" data-testid="chat-messages">
            {messages.length === 0 && !sending && (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-sm">
                  <div className="mono-label">// ready</div>
                  <div className="text-lg mt-2">Ask the agent anything about your attached assets.</div>
                  <div className="text-xs text-muted-foreground mt-2">Tool calls, RAG context, and reasoning traces will appear here.</div>
                </div>
              </div>
            )}
            {messages.map((m) => <MessageBubble key={m.id} m={m} />)}
            {sending && (
              <div className="flex justify-start">
                <div className="font-mono text-xs text-muted-foreground">
                  [ thinking<span className="caret">_</span> ]
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border p-4">
            <div className="flex gap-2 items-end">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Ask the agent... (Shift+Enter for newline)"
                rows={2}
                className="bg-neutral-900 resize-none font-mono text-sm"
                data-testid="chat-input"
              />
              <Button onClick={send} disabled={sending || !input.trim()} className="rounded-sm h-auto px-4 py-3" data-testid="send-button">
                <PaperPlaneTilt size={16} />
              </Button>
            </div>
          </div>
        </div>

        {/* Docs sidebar */}
        <div className="border-l border-border flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="mono-label">// rag documents</div>
            <input ref={fileInputRef} type="file" onChange={uploadFile} className="hidden" accept=".pdf,.txt,.md,.docx" />
            <button onClick={() => fileInputRef.current.click()} className="text-muted-foreground hover:text-white" data-testid="upload-doc">
              <Plus size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {docs.length === 0 && <div className="text-xs text-muted-foreground font-mono">[ no documents uploaded ]</div>}
            {docs.map((d) => (
              <div key={d.id} className="border border-border p-3 flex items-start gap-2" data-testid={`doc-${d.id}`}>
                <FileText size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{d.filename}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{(d.size / 1024).toFixed(1)} KB</div>
                </div>
                <button onClick={() => deleteDoc(d.id)} className="text-muted-foreground hover:text-red-400"><Trash size={12} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ m }) {
  const [traceOpen, setTraceOpen] = useState(false);
  const isUser = m.role === "user";
  const trace = m.trace || [];
  const toolEvents = trace.filter((t) => t.type === "tool_call" || t.type === "tool_result");

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] ${isUser ? "bg-neutral-900 border border-border rounded-lg p-4" : "p-4"}`}>
        {!isUser && (
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 border border-border flex items-center justify-center">
              <span className="font-mono text-[9px]">AI</span>
            </div>
            <span className="mono-label">// agent</span>
          </div>
        )}
        <div className="prose prose-invert prose-chat max-w-none text-sm">
          <ReactMarkdown>{m.content || ""}</ReactMarkdown>
        </div>
        {toolEvents.length > 0 && (
          <div className="mt-3 border-l-2 border-primary/40 pl-3">
            <button onClick={() => setTraceOpen(!traceOpen)} className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-white" data-testid="toggle-trace">
              {traceOpen ? <CaretDown size={12} /> : <CaretRight size={12} />}
              {toolEvents.filter(t => t.type === "tool_call").length} tool call(s)
            </button>
            {traceOpen && (
              <div className="mt-2 space-y-2">
                {trace.map((t, i) => {
                  if (t.type === "tool_call") {
                    return (
                      <div key={i} className="border border-border bg-neutral-950 p-2">
                        <div className="flex items-center gap-2">
                          <span className="method-POST text-[9px] font-mono px-1.5 py-0.5 rounded-sm">CALL</span>
                          <span className="font-mono text-xs text-primary">{t.name}</span>
                        </div>
                        <pre className="mt-1 font-mono text-[11px] text-muted-foreground overflow-x-auto">{JSON.stringify(t.args, null, 2)}</pre>
                      </div>
                    );
                  }
                  if (t.type === "tool_result") {
                    const r = t.result || {};
                    const ok = r.ok !== false;
                    return (
                      <div key={i} className="border border-border bg-neutral-950 p-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-sm ${ok ? "method-GET" : "method-DELETE"}`}>
                            {ok ? "OK" : "ERR"} {r.status_code ?? ""}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground truncate">{r.url || t.name}</span>
                        </div>
                        <pre className="mt-1 font-mono text-[11px] text-muted-foreground overflow-x-auto max-h-40">{typeof r.body === "string" ? r.body.slice(0, 800) : JSON.stringify(r.body, null, 2).slice(0, 2000)}</pre>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
