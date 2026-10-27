import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  RotateCcw,
  Compass,
  AlertTriangle,
  FileText,
  TrendingDown,
  Layers,
  Zap,
  X,
} from 'lucide-react';
import { ChatMessage, UserSession } from '../types';
import { sendChatMessage } from '../api';

interface AIChatBotBubbleProps {
  session: UserSession;
}

const INITIAL_SUGGESTIONS = [
  { icon: Compass, label: '¿Dónde hay más sismos?', query: '¿Dónde hay más sismos actualmente?' },
  { icon: TrendingDown, label: '¿Lugar de menor actividad?', query: '¿Cuál es el lugar con menor actividad sísmica registrada?' },
  { icon: FileText, label: 'Reporte ejecutivo 24h', query: 'Genérame un reporte ejecutivo de la actividad sísmica de las últimas 24 horas' },
  { icon: AlertTriangle, label: 'Sismos más fuertes', query: '¿Cuáles han sido los sismos más fuertes y hubo alertas de tsunami?' },
  { icon: Layers, label: 'Anomalías Z-Score', query: '¿Cuáles son las anomalías estadísticas Z-Score detectadas?' },
];

// Sanitizer to eliminate any emojis from both static text and LLM responses
const removeEmojis = (text: string): string => {
  return text
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2B00}-\u{2BFF}\u{200D}\u{FE0F}]/gu,
      ''
    )
    .trim();
};

export const AIChatBotBubble: React.FC<AIChatBotBubbleProps> = ({ session }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `¡Hola **${session.username}**! Soy **SismoBot**, tu analista sísmico en tiempo real.

Estoy conectado directamente a la capa **Gold** de PostgreSQL con **Groq \`openai/gpt-oss-120b\`**. Puedes preguntarme:

* *"¿Dónde hay más sismos?"*
* *"¿Cuál es el lugar de menor actividad?"*
* *"Genérame un reporte ejecutivo 24h"*
* *"¿Cuáles son los sismos más fuertes o anomalías?"*

¿En qué puedo ayudarte?`,
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

  // Auto-scroll and auto-focus when open
  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages, loading]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

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
        content: removeEmojis(res.reply),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: res.model,
        latency_ms: res.latency_ms,
      };

      setMessages((prev) => [...prev, botMessage]);
      if (res.suggested_questions && res.suggested_questions.length > 0) {
        setSuggestedQuestions(res.suggested_questions.map((q) => removeEmojis(q)));
      }
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `**Error de Comunicación:** ${err.message || 'No fue posible obtener respuesta.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
        content: `Conversación reiniciada. ¿Qué datos sísmicos de la capa Gold deseas consultar?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: 'openai/gpt-oss-120b',
        latency_ms: 0,
      },
    ]);
    setSuggestedQuestions([]);
  };

  const renderFormattedContent = (content: string) => {
    const cleanContent = removeEmojis(content);
    return (
      <div className="space-y-1.5 text-xs sm:text-[13px] leading-relaxed text-slate-800">
        {cleanContent.split('\n').map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-1" />;

          if (trimmed.startsWith('### ')) {
            return (
              <h4 key={idx} className="text-xs sm:text-sm font-bold text-slate-900 mt-2.5 mb-1">
                {trimmed.replace('### ', '')}
              </h4>
            );
          }
          if (trimmed.startsWith('## ')) {
            return (
              <h3 key={idx} className="text-sm sm:text-base font-bold text-slate-900 mt-3 mb-1 border-b border-slate-100 pb-1">
                {trimmed.replace('## ', '')}
              </h3>
            );
          }

          if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
            const listText = trimmed.substring(2);
            return (
              <div key={idx} className="flex items-start space-x-1.5 pl-1.5">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>{renderInlineFormatting(listText)}</span>
              </div>
            );
          }

          const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
          if (numMatch) {
            return (
              <div key={idx} className="flex items-start space-x-1.5 pl-1.5">
                <span className="font-mono text-xs font-bold text-blue-600 mt-0.5">{numMatch[1]}.</span>
                <span>{renderInlineFormatting(numMatch[2])}</span>
              </div>
            );
          }

          return <p key={idx}>{renderInlineFormatting(trimmed)}</p>;
        })}
      </div>
    );
  };

  const renderInlineFormatting = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="font-semibold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={index} className="px-1.5 py-0.5 rounded bg-slate-100 text-blue-700 font-mono text-[11px] border border-slate-200">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <>
      {/* High-Quality Trigger Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center space-x-3">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="hidden sm:flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200 text-xs font-semibold text-slate-800 shadow-md hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Pregúntale a SismoBot</span>
          </button>
        )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? 'Cerrar asistente SismoBot' : 'Abrir asistente SismoBot'}
          className={`w-15 h-15 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shadow-xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-100 ${
            isOpen
              ? 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 scale-95 shadow-md'
              : 'bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 text-white shadow-blue-500/30 hover:scale-105 active:scale-95'
          }`}
        >
          {isOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <div className="relative flex items-center justify-center">
              <Bot className="w-7 h-7 sm:w-8 sm:h-8" />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-blue-700 animate-ping"></span>
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white"></span>
            </div>
          )}
        </button>
      </div>

      {/* Centered Modal with Blurred Backdrop ("se abre en el centro de la pantalla, difumina el fondo") */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="chatbot-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div className="w-full max-w-2xl h-[700px] max-h-[90vh] flex flex-col rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 id="chatbot-modal-title" className="text-sm font-bold text-slate-900 tracking-tight">
                      SismoBot IA
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-mono font-medium text-emerald-700 flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>Groq LPU</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Conectado a la capa Gold &bull; Groq openai/gpt-oss-120b
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-1.5">
                <button
                  onClick={handleClearChat}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                  title="Reiniciar conversación"
                  aria-label="Reiniciar conversación"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                  title="Cerrar asistente"
                  aria-label="Cerrar asistente"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Suggestions Chips */}
            <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-100 overflow-x-auto flex items-center space-x-2 shrink-0">
              {(suggestedQuestions.length > 0
                ? suggestedQuestions.map((q) => ({ label: q, query: q, icon: Sparkles }))
                : INITIAL_SUGGESTIONS
              ).map((item, index) => {
                const Icon = item.icon;
                return (
                  <button
                    key={index}
                    onClick={() => handleSend(item.query)}
                    disabled={loading}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-200 text-xs text-slate-700 hover:text-blue-700 whitespace-nowrap transition-colors shrink-0 disabled:opacity-50 shadow-2xs font-medium"
                  >
                    <Icon className="w-3.5 h-3.5 text-blue-600" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-start space-x-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 text-white mt-0.5 shadow-xs">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[82%] rounded-2xl p-4 shadow-xs ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-tr-none'
                        : 'bg-white border border-slate-200 rounded-tl-none text-slate-800'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <p className="text-xs sm:text-[13px] text-white leading-relaxed">{msg.content}</p>
                    ) : (
                      renderFormattedContent(msg.content)
                    )}

                    <div
                      className={`mt-2 flex items-center space-x-2 text-[10px] ${
                        msg.role === 'user'
                          ? 'text-blue-100 justify-end'
                          : 'text-slate-400 justify-between border-t border-slate-100 pt-1.5'
                      }`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="flex items-center space-x-2">
                          {msg.model && (
                            <span className="font-mono text-blue-600 flex items-center space-x-1">
                              <Zap className="w-3 h-3" />
                              <span>{msg.model.split('/')[1] || msg.model}</span>
                            </span>
                          )}
                          {msg.latency_ms !== undefined && msg.latency_ms > 0 && (
                            <span className="font-mono text-slate-400">{msg.latency_ms}ms</span>
                          )}
                        </div>
                      )}
                      <span className="font-mono">{msg.timestamp}</span>
                    </div>
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center shrink-0 text-slate-600 mt-0.5">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex items-start space-x-3 justify-start animate-in fade-in duration-150">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 text-white mt-0.5 shadow-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-4 shadow-xs flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="text-xs text-slate-500 ml-1 font-mono">Analizando datos sísmicos con Groq AI...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Box */}
            <div className="p-4 bg-white border-t border-slate-200 shrink-0">
              <div className="flex items-center space-x-2.5">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Pregunta sobre sismos, regiones, reportes de 24h, anomalías Z-Score..."
                  disabled={loading}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition shadow-inner disabled:opacity-50"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || loading}
                  aria-label="Enviar mensaje a SismoBot"
                  className="p-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-xs transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
