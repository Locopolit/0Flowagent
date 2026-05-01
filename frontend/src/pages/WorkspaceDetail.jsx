import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { API, formatApiError } from "@/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, PaperPlaneTilt, Plus, FileText, Trash, CaretDown, CaretRight, Robot, Lightning } from "@phosphor-icons/react";
import SiriOrb from "@/components/SiriOrb";
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
      <div className="px-6 py-4 border-b border-white/[0.06] glass-header flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/workspaces" className="text-white/40 hover:text-white transition-colors"><ArrowLeft size={16} /></Link>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Workspace</div>
            <div className="text-base font-semibold truncate text-white">{ws.name}</div>
          </div>
        </div>
        <div className="text-[11px] text-white/35 font-medium">{docs.length} docs · {ws.asset_ids?.length || 0} tools</div>
      </div>

      <div className="flex-1 grid grid-cols-[280px_1fr_280px] overflow-hidden">
        {/* Conversations sidebar */}
        <div className="border-r border-white/[0.06] flex flex-col overflow-hidden bg-white/[0.02]">
          <div className="p-3 border-b border-white/[0.06]">
            <Button className="w-full rounded-xl gap-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 font-medium text-[13px]" onClick={newConv} data-testid="new-conversation"><Plus size={14} /> New Chat</Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.map((c) => (
              <div key={c.id} className={`group px-3 py-3 cursor-pointer border-b border-white/[0.04] hover:bg-white/[0.04] transition-all ${currentConv?.id === c.id ? "bg-white/[0.06] border-l-2 border-l-blue-400" : "border-l-2 border-l-transparent"}`}
                onClick={() => selectConv(c)} data-testid={`conv-${c.id}`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="text-[13px] truncate font-medium text-white/80">{c.title}</div>
                  <button onClick={(e) => { e.stopPropagation(); deleteConv(c.id); }} className="text-white/20 hover:text-red-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"><Trash size={12} /></button>
                </div>
                <div className="text-[10px] text-white/30 mt-1">{new Date(c.created_at).toLocaleString()}</div>
              </div>
            ))}
            {conversations.length === 0 && <div className="p-4 text-[12px] text-white/30 text-center">No conversations yet</div>}
          </div>
        </div>

        {/* Chat main */}
        <div className="flex flex-col overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-6 space-y-6" data-testid="chat-messages">
            {messages.length === 0 && !sending && (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-md">
                  <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <SiriOrb size={48} active={false} />
                  </div>
                  <div className="text-lg font-semibold mt-2 text-white">Ready for your questions</div>
                  <div className="text-[13px] text-white/45 mt-2 leading-relaxed">
                    Ask about your backup infrastructure, run root cause analysis on failures, or check system status.
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2 justify-center">
                    {["Show failed jobs (24h)", "Run RCA", "List clients"].map((q) => (
                      <button key={q} onClick={() => { setInput(q); }} className="px-4 py-2 text-[12px] font-medium rounded-full border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/[0.15] text-white/60 hover:text-white transition-all">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {messages.map((m) => <MessageBubble key={m.id} m={m} />)}
            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/[0.06] bg-white/[0.04] backdrop-blur-sm">
                  <SiriOrb size={24} active={true} />
                  <span className="font-mono text-xs text-muted-foreground">Agent thinking...</span>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-white/[0.06] p-4 glass-header">
            <div className="flex gap-3 items-end max-w-4xl mx-auto">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Ask the agent... (Shift+Enter for newline)"
                rows={2}
                className="bg-white/[0.04] resize-none text-[13px] border-white/[0.08] focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/20 rounded-xl placeholder:text-white/30"
                data-testid="chat-input"
              />
              <Button onClick={send} disabled={sending || !input.trim()} className="rounded-xl h-auto px-5 py-3 bg-blue-500 hover:bg-blue-600 transition-colors shadow-sm" data-testid="send-button">
                <PaperPlaneTilt size={18} weight="fill" />
              </Button>
            </div>
          </div>
        </div>

        {/* Docs sidebar */}
        <div className="border-l border-white/[0.06] flex flex-col overflow-hidden bg-white/[0.02]">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Documents</div>
            <input ref={fileInputRef} type="file" onChange={uploadFile} className="hidden" accept=".pdf,.txt,.md,.docx" />
            <button onClick={() => fileInputRef.current.click()} className="text-white/30 hover:text-white transition-colors" data-testid="upload-doc">
              <Plus size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {docs.length === 0 && <div className="text-[12px] text-white/30 text-center py-4">No documents uploaded</div>}
            {docs.map((d) => (
              <div key={d.id} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 flex items-start gap-2.5" data-testid={`doc-${d.id}`}>
                <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                  <FileText size={13} className="text-blue-400" weight="fill" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] truncate text-white/80 font-medium">{d.filename}</div>
                  <div className="text-[10px] text-white/30 mt-0.5">{(d.size / 1024).toFixed(1)} KB</div>
                </div>
                <button onClick={() => deleteDoc(d.id)} className="text-white/20 hover:text-red-400 transition-colors"><Trash size={12} /></button>
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
      <div className={`max-w-[80%] ${isUser ? "bg-blue-500/10 border border-blue-500/15 rounded-2xl rounded-br-md p-4" : "bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-bl-md p-4 backdrop-blur-sm"}`}>
        {!isUser && (
          <div className="flex items-center gap-2 mb-3">
            <SiriOrb size={20} active={true} />
            <span className="text-[12px] font-medium text-blue-400 ml-1">Agent</span>
          </div>
        )}
        <div className="prose prose-invert prose-chat max-w-none text-[13px] leading-relaxed">
          <ReactMarkdown>{m.content || ""}</ReactMarkdown>
        </div>
        {toolEvents.length > 0 && (
          <div className="mt-3 border-l-2 border-blue-400/30 pl-3">
            <button onClick={() => setTraceOpen(!traceOpen)} className="flex items-center gap-1.5 text-[11px] font-medium text-blue-400/70 hover:text-blue-400 transition-colors" data-testid="toggle-trace">
              {traceOpen ? <CaretDown size={12} /> : <CaretRight size={12} />}
              <Lightning size={12} weight="fill" />
              {toolEvents.filter(t => t.type === "tool_call").length} tool call(s)
            </button>
            {traceOpen && (
              <div className="mt-2 space-y-2">
                {trace.map((t, i) => {
                  if (t.type === "tool_call") {
                    return (
                      <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5">
                        <div className="flex items-center gap-2">
                          <span className="method-POST text-[9px] font-mono px-1.5 py-0.5 rounded-md">CALL</span>
                          <span className="font-mono text-xs text-blue-400">{t.name}</span>
                        </div>
                        <pre className="mt-1.5 font-mono text-[11px] text-white/40 overflow-x-auto">{JSON.stringify(t.args, null, 2)}</pre>
                      </div>
                    );
                  }
                  if (t.type === "tool_result") {
                    const r = t.result || {};
                    const ok = r.ok !== false;
                    return (
                      <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md ${ok ? "method-GET" : "method-DELETE"}`}>
                            {ok ? "OK" : "ERR"} {r.status_code ?? ""}
                          </span>
                          <span className="font-mono text-xs text-white/40 truncate">{r.url || t.name}</span>
                        </div>
                        <pre className="mt-1.5 font-mono text-[11px] text-white/40 overflow-x-auto max-h-40">{typeof r.body === "string" ? r.body.slice(0, 800) : JSON.stringify(r.body, null, 2).slice(0, 2000)}</pre>
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
