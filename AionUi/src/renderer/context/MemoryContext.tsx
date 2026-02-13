/**
 * MemoryContext - State management for Memory Hub
 *
 * Manages conversation sessions, search results, and context information
 */
import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { ipcBridge } from '@/common';

interface Conversation {
  id: string;
  name: string;
  type: 'gemini' | 'acp' | 'codex' | 'openclaw-gateway' | 'hivemind';
  created_at: number;
  updated_at: number;
  message_count?: number;
  createTime?: number;
  modifyTime?: number;
}

interface Message {
  id: string;
  conversation_id: string;
  content: string;
  type: string;
  position: 'left' | 'right' | 'center' | 'pop';
  created_at: number;
  createdAt?: number;
}

interface MemoryContextValue {
  sessions: Conversation[];
  currentSession: Conversation | null;
  searchResults: Message[];
  isLoading: boolean;
  error: string | null;

  loadSessions: () => Promise<void>;
  searchMemory: (query: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  setCurrentSession: (session: Conversation | null) => void;
  exportToObsidian: (sessionId: string) => Promise<void>;
}

const MemoryContext = createContext<MemoryContextValue | undefined>(undefined);

export const MemoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [sessions, setSessions] = useState<Conversation[]>([]);
  const [currentSession, setCurrentSession] = useState<Conversation | null>(null);
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await ipcBridge.database.getUserConversations.invoke({ page: 0, pageSize: 1000 });

      // Convert to internal format with proper timestamps
      const formattedSessions: Conversation[] = result.map((conv: any) => ({
        ...conv,
        created_at: conv.createTime || conv.created_at || Date.now(),
        updated_at: conv.modifyTime || conv.updated_at || Date.now(),
      }));

      setSessions(formattedSessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
      console.error('Failed to load sessions:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const searchMemory = useCallback(async (query: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const results = await ipcBridge.database.searchMessages.invoke({ query, page: 0, pageSize: 100 });

      // Convert to internal format with proper timestamps
      const formattedResults: Message[] = results.map((msg: any) => ({
        ...msg,
        created_at: msg.createdAt || msg.created_at || Date.now(),
      }));

      setSearchResults(formattedResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      console.error('Search failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteSession = useCallback(
    async (id: string) => {
      try {
        const success = await ipcBridge.conversation.remove.invoke({ id });

        if (success) {
          setSessions((prev) => prev.filter((s) => s.id !== id));
          if (currentSession?.id === id) {
            setCurrentSession(null);
          }
        } else {
          setError('Failed to delete session');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete session');
        console.error('Failed to delete session:', err);
      }
    },
    [currentSession]
  );

  const exportToObsidian = useCallback(
    async (sessionId: string) => {
      try {
        setIsLoading(true);
        setError(null);

        // Find the session
        const session = sessions.find((s) => s.id === sessionId);
        if (!session) {
          throw new Error('Session not found');
        }

        // Fetch conversation messages
        const messages = await ipcBridge.database.getConversationMessages.invoke({
          conversation_id: sessionId,
          page: 0,
          pageSize: 1000,
        });

        // Generate Markdown content (cast TMessage[] to Message[] with created_at)
        const markdown = generateConversationMarkdown(session, messages as unknown as Message[]);

        // Create safe filename (remove special characters)
        const safeTitle = session.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5-_ ]/g, '_');
        const timestamp = new Date(session.created_at).toISOString().split('T')[0];
        const fileName = `${timestamp}_${safeTitle}.md`;
        const filePath = `/Users/leo/Documents/Obsidian-Vaults/Knowledge-Hub/Conversations/${fileName}`;

        // Write file using fs bridge
        const encoder = new TextEncoder();
        const data = encoder.encode(markdown);
        await ipcBridge.fs.writeFile.invoke({ path: filePath, data });

        // Open in Obsidian
        const result = await ipcBridge.obsidian.open.invoke({
          vault: 'Knowledge-Hub',
          path: `Conversations/${fileName}`,
        });

        if (result.success) {
          return;
        } else {
          throw new Error(result.error || 'Failed to open in Obsidian');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Export failed');
        console.error('Export to Obsidian failed:', err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [sessions]
  );

  /**
   * Generate Markdown content for a conversation
   */
  const generateConversationMarkdown = (conversation: Conversation, messages: Message[]): string => {
    const lines: string[] = [];

    // Frontmatter
    lines.push('---');
    lines.push(`title: ${conversation.name}`);
    lines.push(`type: ${conversation.type}`);
    lines.push(`created: ${new Date(conversation.created_at).toISOString()}`);
    lines.push(`updated: ${new Date(conversation.updated_at).toISOString()}`);
    lines.push(`conversation_id: ${conversation.id}`);
    lines.push(`message_count: ${messages.length}`);
    lines.push('tags:');
    lines.push('  - conversation');
    lines.push(`  - ${conversation.type}`);
    lines.push('---');
    lines.push('');

    // Title and metadata
    lines.push(`# ${conversation.name}`);
    lines.push('');
    lines.push(`**Type**: ${conversation.type}`);
    lines.push(`**Created**: ${new Date(conversation.created_at).toLocaleString()}`);
    lines.push(`**Messages**: ${messages.length}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Messages
    messages.forEach((msg, index) => {
      const role = msg.position === 'left' ? '🤖 Assistant' : '👤 User';
      const timestamp = new Date(msg.created_at).toLocaleString();

      lines.push(`## Message ${index + 1} - ${role}`);
      lines.push('');
      lines.push(`*${timestamp}*`);
      lines.push('');
      lines.push(msg.content);
      lines.push('');
      lines.push('---');
      lines.push('');
    });

    return lines.join('\n');
  };

  const value: MemoryContextValue = {
    sessions,
    currentSession,
    searchResults,
    isLoading,
    error,
    loadSessions,
    searchMemory,
    deleteSession,
    setCurrentSession,
    exportToObsidian,
  };

  return <MemoryContext.Provider value={value}>{children}</MemoryContext.Provider>;
};

export const useMemory = (): MemoryContextValue => {
  const context = useContext(MemoryContext);
  if (!context) {
    throw new Error('useMemory must be used within MemoryProvider');
  }
  return context;
};
