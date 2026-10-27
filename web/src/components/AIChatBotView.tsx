import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  RotateCcw,
  Clock,
  Compass,
  AlertTriangle,
  FileText,
  TrendingDown,
  Layers,
  Zap,
} from 'lucide-react';
import { ChatMessage, UserSession } from '../types';
import { sendChatMessage } from '../api';

interface AIChatBotViewProps {
  session: UserSession;
}

const INITIAL_SUGGESTIONS = [
  { icon: Compass, label: '¿Dónde hay más sismos?', query: '¿Dónde hay más sismos actualmente?' },
  { icon: TrendingDown, label: '¿Lugar de menor actividad?', query: '¿Cuál es el lugar con menor actividad sísmica registrada?' },
  { icon: FileText, label: 'Genérame un reporte 24h', query: 'Genérame un reporte ejecutivo de la actividad sísmica de las últimas 24 horas' },
  { icon: AlertTriangle, label: 'Sismos más fuertes', query: '¿Cuáles han sido los sismos más fuertes y hubo alertas de tsunami?' },
  { icon: Layers, label: 'Anomalías detectadas', query: '¿Cuáles son las anomalías estadísticas Z-Score detectadas?' },
];

export const AIChatBotView: React.FC<AIChatBotViewProps> = ({ session }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `¡Hola **${session.username}**! Soy **SismoBot**, tu analista de datos sismológicos en tiempo real.

Estoy conectado directamente a la capa **Gold** de PostgreSQL y potenciado por el modelo **Groq \`openai/gpt-oss-120b\`**. Puedes hacerme consultas como:

* 📍 *"¿Dónde hay más sismos?"*
* 📉 *"¿Cuál es el lugar de menor actividad?"*
* 📊 *"Genérame un reporte ejecutivo"*
* ⚠️ *"¿Cuáles son los sismos más fuertes o anomalías detectadas?"*

¿En qué puedo ayudarte hoy?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      model: 'openai/gpt-oss-120b',
      latency_ms: 0,
    },
  ]);

  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (messageText?: string) => {
    const textToSend = (messageText || input).trim();
    if (!textToSend || loading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const historyPayload = messages
        .filter((m) => m.id !== 'welcome')
        .slice(-4)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await sendChatMessage(textToSend, historyPayload);

      const botMessage: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: res.model,
        latency_ms: res.latency_ms,
      };

      setMessages((prev) => [...prev, botMessage]);
      if (res.suggested_questions && res.suggested_questions.length > 0) {
        setSuggestedQuestions(res.suggested_questions);
      }
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Error de Comunicación:** ${err.message || 'No fue posible obtener respuesta.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        content: `Conversación reiniciada. ¿Qué datos sísmicos deseas consultar ahora?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: 'openai/gpt-oss-120b',
        latency_ms: 0,
      },
    ]);
    setSuggestedQuestions([]);
  };

  // Helper to format basic markdown-like structures (bold, lists, headers)
  const renderFormattedContent = (content: string) => {
    return (
      <div className="space-y-2 text-sm leading-relaxed text-slate-200">
        {content.split('\n').map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-1" />;

          // Headers
          if (trimmed.startsWith('### ')) {
            return (
              <h4 key={idx} className="text-base font-bold text-amber-400 mt-3 mb-1">
                {trimmed.replace('### ', '')}
              </h4>
            );
          }
          if (trimmed.startsWith('## ')) {
            return (
              <h3 key={idx} className="text-lg font-extrabold text-amber-300 mt-4 mb-2 border-b border-white/10 pb-1">
                {trimmed.replace('## ', '')}
              </h3>
            );
          }

          // Bullet list items
          if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
            const listText = trimmed.substring(2);
            return (
              <div key={idx} className="flex items-start space-x-2 pl-2">
                <span className="text-amber-400 mt-1.5">•</span>
                <span>{renderInlineFormatting(listText)}</span>
              </div>
            );
          }

          // Numbered lists
          const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
          if (numMatch) {
            return (
              <div key={idx} className="flex items-start space-x-2 pl-2">
                <span className="font-mono text-xs font-bold text-amber-400 mt-1">{numMatch[1]}.</span>
                <span>{renderInlineFormatting(numMatch[2])}</span>
              </div>
            );
          }

          // Regular paragraph
          return <p key={idx}>{renderInlineFormatting(trimmed)}</p>;
        })}
      </div>
    );
  };

  // Inline formatting for bold (**text**) and code (`code`)
  const renderInlineFormatting = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="font-bold text-slate-100">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={index} className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 font-mono text-xs border border-white/5">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-h-[850px] min-h-[550px] glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
      
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-900/90 border-b border-white/10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Bot className="w-6 h-6 text-slate-950 font-bold" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                SismoBot — Asistente Sísmico IA
              </h2>
              <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono font-bold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>EN VIVO (Groq LPU)</span>
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Consultas en lenguaje natural con datos fidedignos de la capa Gold
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleClearChat}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all shadow-sm"
            title="Reiniciar conversación"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Limpiar chat</span>
          </button>
        </div>
      </div>

      {/* Suggested Questions Bar (Initial or Updated) */}
      <div className="px-6 py-2.5 bg-slate-950/40 border-b border-white/5 overflow-x-auto no-scrollbar flex items-center space-x-2">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1 whitespace-nowrap mr-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Sugerencias:</span>
        </span>
        {(suggestedQuestions.length > 0 ? suggestedQuestions.map(q => ({ label: q, query: q, icon: Sparkles })) : INITIAL_SUGGESTIONS).map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={index}
              onClick={() => handleSend(item.query)}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-900/80 hover:bg-amber-500/15 border border-white/10 hover:border-amber-500/30 text-xs text-slate-300 hover:text-amber-400 whitespace-nowrap transition-all shadow-sm disabled:opacity-50"
            >
              <Icon className="w-3 h-3 text-amber-400" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Chat Messages Scrollable Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-950/30">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start space-x-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center flex-shrink-0 shadow-md">
                <Bot className="w-4 h-4 text-slate-950 font-bold" />
              </div>
            )}

            <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-lg ${
              msg.role === 'user'
                ? 'bg-gradient-to-r from-amber-600/90 to-amber-500 text-slate-950 font-medium rounded-tr-none'
                : 'bg-slate-900/95 border border-white/10 rounded-tl-none'
            }`}>
              {msg.role === 'user' ? (
                <p className="text-sm font-semibold text-slate-950">{msg.content}</p>
              ) : (
                renderFormattedContent(msg.content)
              )}

              {/* Timestamp & Telemetry Badge */}
              <div className={`mt-2 flex items-center space-x-2 text-[10px] ${
                msg.role === 'user' ? 'text-amber-950/70 justify-end' : 'text-slate-400 justify-between border-t border-white/5 pt-2'
              }`}>
                {msg.role === 'assistant' && (
                  <div className="flex items-center space-x-2">
                    {msg.model && (
                      <span className="font-mono text-amber-400/90 flex items-center space-x-1">
                        <Zap className="w-2.5 h-2.5" />
                        <span>{msg.model}</span>
                      </span>
                    )}
                    {msg.latency_ms !== undefined && msg.latency_ms > 0 && (
                      <span className="font-mono text-slate-400">
                        {msg.latency_ms}ms
                      </span>
                    )}
                  </div>
                )}
                <span className="font-mono">{msg.timestamp}</span>
              </div>
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center flex-shrink-0 text-slate-300">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {/* Loading / Typing indicator */}
        {loading && (
          <div className="flex items-start space-x-3 justify-start animate-in fade-in duration-300">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center flex-shrink-0 shadow-md">
              <Bot className="w-4 h-4 text-slate-950 font-bold" />
            </div>
            <div className="bg-slate-900/90 border border-white/10 rounded-2xl rounded-tl-none p-4 shadow-lg flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              <span className="text-xs text-slate-400 ml-2 font-mono">Consultando capa Gold con Groq AI...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input box */}
      <div className="p-4 bg-slate-900/95 border-t border-white/10">
        <div className="flex items-center space-x-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pregúntale a SismoBot: '¿dónde hay más sismos?', 'genérame un reporte', etc."
            disabled={loading}
            className="flex-1 bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all shadow-inner disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-slate-950 font-bold text-sm flex items-center space-x-2 shadow-lg shadow-amber-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Enviar</span>
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-500 text-center font-mono">
          Potenciado por Groq LPU & PostgreSQL Medallion Gold • Respuestas auditadas contra datos reales
        </p>
      </div>

    </div>
  );
};
