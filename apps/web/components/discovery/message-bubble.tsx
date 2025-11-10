/**
 * Message Bubble Component
 *
 * Displays a single message in the discovery chat interface.
 * Supports both user and assistant messages with different styling.
 */

import { cn } from '@/lib/utils';

export interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isStreaming?: boolean;
}

export function MessageBubble({ role, content, timestamp, isStreaming = false }: MessageBubbleProps) {
  const isUser = role === 'user';

  // Format timestamp to readable time
  const formattedTime = new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div
      className={cn(
        'flex w-full mb-4',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-4 py-3 shadow-sm',
          isUser
            ? 'bg-primary text-primary-foreground ml-auto'
            : 'bg-muted text-foreground mr-auto'
        )}
      >
        {/* Message Content */}
        <div className={cn(
          'prose prose-sm max-w-none',
          isUser ? 'prose-invert' : ''
        )}>
          {isStreaming ? (
            <div className="flex items-center gap-2">
              <span>{content}</span>
              <span className="inline-block w-2 h-4 bg-current animate-pulse" />
            </div>
          ) : (
            <MessageContent content={content} />
          )}
        </div>

        {/* Timestamp */}
        <div
          className={cn(
            'text-xs mt-2 opacity-70',
            isUser ? 'text-primary-foreground' : 'text-muted-foreground'
          )}
        >
          {formattedTime}
        </div>
      </div>
    </div>
  );
}

/**
 * Message Content with Markdown Support
 * Handles basic markdown formatting in messages
 */
function MessageContent({ content }: { content: string }) {
  // Simple markdown parsing for bold, italic, code, and line breaks
  const formatted = content
    .split('\n')
    .map((line, i) => {
      // Bold: **text**
      let formatted = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      // Italic: *text*
      formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
      // Inline code: `code`
      formatted = formatted.replace(/`(.+?)`/g, '<code class="px-1 py-0.5 rounded bg-muted text-sm">$1</code>');

      return <p key={i} dangerouslySetInnerHTML={{ __html: formatted }} />;
    });

  return <div className="space-y-2">{formatted}</div>;
}
