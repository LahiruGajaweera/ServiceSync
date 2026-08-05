import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User } from 'lucide-react';
import api from '../services/api';

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { text: "Hi there! I'm the ServiceSync assistant. How can I help you today?", isBot: true }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    setMessages(prev => [...prev, { text: userMessage, isBot: false }]);
    setInput("");
    setIsLoading(true);

    try {
      // Use the api instance which points to the backend
      const response = await api.post('/chatbot/message', { message: userMessage });
      setMessages(prev => [...prev, { 
        text: response.data.reply, 
        isBot: true, 
        jobData: response.data.job_data 
      }]);
    } catch (error) {
      console.error("Chatbot API Error:", error);
      setMessages(prev => [...prev, { text: "Sorry, I'm having trouble connecting to the server. Please try again later.", isBot: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen ? (
        <div className="bg-white rounded-2xl shadow-2xl w-80 sm:w-96 flex flex-col h-[500px] border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="bg-blue-600 text-white p-4 flex justify-between items-center shadow-md z-10">
            <div className="flex items-center gap-2">
              <Bot size={24} className="text-blue-100" />
              <div>
                <h3 className="font-semibold text-lg leading-tight">ServiceSync Bot</h3>
                <p className="text-blue-200 text-xs">Always here to help</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-blue-100 hover:text-white hover:bg-blue-700 p-1 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto bg-gray-50 flex flex-col gap-3">
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.isBot ? 'justify-start' : 'justify-end'}`}>
                <div className={`flex max-w-[85%] gap-2 ${msg.isBot ? 'flex-row' : 'flex-row-reverse'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.isBot ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-600'}`}>
                    {msg.isBot ? <Bot size={16} /> : <User size={16} />}
                  </div>
                  <div className={`p-3 rounded-2xl text-sm ${msg.isBot ? 'bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm' : 'bg-blue-600 text-white rounded-tr-none shadow-md'}`}>
                    {/* Render basic markdown-like bold text **text** */}
                    {msg.text.split(/(\*\*.*?\*\*)/).map((part, i) => {
                      if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={i}>{part.slice(2, -2)}</strong>;
                      }
                      return <span key={i}>{part}</span>;
                    })}
                    {msg.jobData && (
                      <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3 w-full shadow-sm">
                        <div className="flex justify-between items-start mb-2 gap-2">
                           <span className="font-bold text-gray-800 text-[13px]">{msg.jobData.job_id}</span>
                           <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-full font-bold whitespace-nowrap">
                             {msg.jobData.status.replace(/_/g, " ").toUpperCase()}
                           </span>
                        </div>
                        <div className="text-[12px] text-gray-600 space-y-1">
                          <p><span className="font-semibold text-gray-700">Device:</span> {msg.jobData.device_brand} {msg.jobData.device_model}</p>
                          <p><span className="font-semibold text-gray-700">Issue:</span> {msg.jobData.fault_category?.replace(/_/g, " ")}</p>
                          {msg.jobData.estimated_cost != null && (
                            <p><span className="font-semibold text-gray-700">Est. Cost:</span> LKR {Number(msg.jobData.estimated_cost).toLocaleString()}</p>
                          )}
                        </div>
                        <a href={`/track/${msg.jobData.job_id}`} className="mt-2 block text-[12px] text-blue-600 hover:underline font-medium text-right">
                          View full details →
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex max-w-[85%] gap-2 flex-row">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-100 text-blue-600">
                    <Bot size={16} />
                  </div>
                  <div className="p-3 bg-white border border-gray-200 text-gray-500 rounded-2xl rounded-tl-none shadow-sm text-sm flex gap-1 items-center">
                    <span className="animate-bounce inline-block w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                    <span className="animate-bounce inline-block w-1.5 h-1.5 bg-gray-400 rounded-full" style={{ animationDelay: '0.2s' }}></span>
                    <span className="animate-bounce inline-block w-1.5 h-1.5 bg-gray-400 rounded-full" style={{ animationDelay: '0.4s' }}></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-gray-100">
            <form onSubmit={handleSend} className="flex gap-2 items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 bg-gray-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-full px-4 py-2.5 text-sm outline-none transition-all"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-full p-2.5 flex items-center justify-center transition-colors shadow-sm"
              >
                <Send size={18} className={input.trim() && !isLoading ? 'ml-0.5' : ''} />
              </button>
            </form>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all transform hover:scale-105 flex items-center justify-center animate-in zoom-in"
        >
          <MessageCircle size={28} />
        </button>
      )}
    </div>
  );
}
