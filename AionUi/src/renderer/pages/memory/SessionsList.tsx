/**
 * SessionsList - Display conversation sessions grouped by time
 */
import React, { useEffect, useState } from 'react';
import { Button } from '@/renderer/components/ui/button';
import { Badge } from '@/renderer/components/ui/badge';
import { Avatar, AvatarFallback } from '@/renderer/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/renderer/components/ui/dialog';
import { Trash2, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMemory } from '@/renderer/context/MemoryContext';

type Conversation = {
  id: string;
  name: string;
  type: 'gemini' | 'acp' | 'codex' | 'openclaw-gateway' | 'hivemind';
  created_at: number;
  updated_at: number;
  message_count?: number;
};

const SessionsList: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sessions, isLoading, loadSessions, deleteSession, exportToObsidian } = useMemory();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const handleExport = async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await exportToObsidian(sessionId);
    } catch (error: any) {
      console.error(error);
    }
  };

  const confirmDelete = (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setSessionToDelete(sessionId);
    setDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (sessionToDelete) {
      void deleteSession(sessionToDelete);
      setSessionToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const groupSessionsByDate = (sessions: Conversation[]) => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    return {
      today: sessions.filter((s) => now - s.updated_at < oneDayMs),
      yesterday: sessions.filter((s) => {
        const diff = now - s.updated_at;
        return diff >= oneDayMs && diff < 2 * oneDayMs;
      }),
      lastWeek: sessions.filter((s) => {
        const diff = now - s.updated_at;
        return diff >= 2 * oneDayMs && diff < 7 * oneDayMs;
      }),
      older: sessions.filter((s) => now - s.updated_at >= 7 * oneDayMs),
    };
  };

  const renderGroup = (title: string, items: Conversation[]) => {
    if (items.length === 0) return null;

    return (
      <div key={title} className='mb-24px'>
        <h3 className='text-14px font-semibold text-t-secondary mb-12px'>{title}</h3>
        <div className='space-y-2'>
          {items.map((item: Conversation) => (
            <div key={item.id} className='hover:bg-fill-2 cursor-pointer rounded-md p-12px border flex items-center justify-between group' onClick={() => navigate(`/conversation/${item.id}`)}>
              <div className='flex items-center gap-3'>
                <Avatar className='h-10 w-10'>
                  <AvatarFallback>{item.type[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <div className='font-medium'>{item.name}</div>
                  <div className='flex items-center gap-8px text-sm'>
                    <Badge variant='default'>{item.type}</Badge>
                    <Badge variant='outline'>{item.message_count || 0} messages</Badge>
                    <span className='text-12px text-t-secondary'>{new Date(item.updated_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                <Button variant='ghost' size='icon' onClick={(e) => handleExport(item.id, e)}>
                  <ExternalLink size={16} />
                </Button>
                <Button variant='ghost' size='icon' onClick={(e) => confirmDelete(item.id, e)}>
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-full'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return <div className='flex flex-col items-center justify-center h-full text-muted-foreground'>{t('memory.sessions.empty')}</div>;
  }

  const grouped = groupSessionsByDate(sessions);

  return (
    <>
      <div className='overflow-y-auto h-full p-16px'>
        {renderGroup(t('memory.sessions.today'), grouped.today)}
        {renderGroup(t('memory.sessions.yesterday'), grouped.yesterday)}
        {renderGroup(t('memory.sessions.lastWeek'), grouped.lastWeek)}
        {renderGroup(t('memory.sessions.older'), grouped.older)}
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('memory.sessions.confirmDelete')}</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteDialogOpen(false)}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button variant='destructive' onClick={handleDelete}>
              {t('common.delete', { defaultValue: 'Delete' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SessionsList;
