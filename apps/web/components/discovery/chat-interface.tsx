/**
 * Chat Interface Component
 *
 * Main chat container that manages messages, handles user input,
 * and displays the conversation with auto-scroll.
 */

'use client';

import { useEffect, useRef } from 'react';
import { MessageBubble } from './message-bubble';
import { TypingIndicator } from './typing-indicator';
import { ChatInput } from './chat-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

export function ChatInterface({
  messages,
  onSendMessage,
  isLoading = false,
  disabled = false,
  className,
}: ChatInterfaceProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Messages Area */}
      <ScrollArea className="flex-1 px-4 py-6" ref={scrollAreaRef}>
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Render Messages */}
          {messages.map((message, index) => (
            <MessageBubble
              key={`${message.timestamp}-${index}`}
              role={message.role}
              content={message.content}
              timestamp={message.timestamp}
            />
          ))}

          {/* Typing Indicator */}
          {isLoading && <TypingIndicator />}

          {/* Empty State */}
          {messages.length === 0 && !isLoading && (
            <EmptyState />
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t">
        <div className="max-w-4xl mx-auto">
          <ChatInput
            onSend={onSendMessage}
            disabled={disabled || isLoading}
            placeholder={
              isLoading
                ? 'AI is responding...'
                : 'Tell me about your business...'
            }
          />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <span className="text-3xl">💬</span>
      </div>
      <h3 className="text-lg font-semibold mb-2">
        Let&apos;s build your profile together
      </h3>
      <p className="text-muted-foreground max-w-md">
        I&apos;ll ask you questions about your business to create a comprehensive
        profile for your website. Don&apos;t worry - we&apos;ll take it step by step!
      </p>
    </div>
  );
}
