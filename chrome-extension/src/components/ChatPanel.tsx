import React, { useState, useRef, useEffect } from "react";
import styles from "../styles/chat.module.scss";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  annotationCount?: number;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  onAnnotateMore: () => void;
  onClose: () => void;
}

export function ChatPanel({ messages, onSend, onAnnotateMore, onClose }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className={styles.chatPanel}>
      <div className={styles.header}>
        <span className={styles.title}>Chat with Pi</span>
        <button onClick={onClose} className={styles.closeBtn}>✕</button>
      </div>
      
      <div className={styles.messages}>
        {messages.map((msg, i) => (
          <div 
            key={i} 
            className={msg.role === "user" ? styles.userMessage : styles.assistantMessage}
          >
            {msg.annotationCount != null && msg.annotationCount > 0 && (
              <span className={styles.annotationBadge}>
                {msg.annotationCount} annotation{msg.annotationCount !== 1 ? "s" : ""}
              </span>
            )}
            <div className={styles.content}>{msg.content}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={handleSubmit} className={styles.inputArea}>
        <button 
          type="button" 
          onClick={onAnnotateMore}
          className={styles.annotateBtn}
          title="Add more annotations"
        >
          + Annotate
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className={styles.input}
          autoFocus
        />
        <button 
          type="submit" 
          disabled={!input.trim()}
          className={styles.sendBtn}
        >
          Send
        </button>
      </form>
    </div>
  );
}
