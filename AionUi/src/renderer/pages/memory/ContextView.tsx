/**
 * ContextView - Display and manage active conversation context
 */
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card';
import { Button } from '@/renderer/components/ui/button';
import { Badge } from '@/renderer/components/ui/badge';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type ContextInfo = {
  conversation_id: string;
  message_count: number;
  token_count: number;
  last_updated: number;
  messages: Array<{
    id: string;
    content: string;
    type: string;
    created_at: number;
  }>;
};

const ContextView: React.FC = () => {
  const { t } = useTranslation();
  const [contextInfo] = useState<ContextInfo | null>(null);

  const handleClearContext = async () => {
    try {
      // TODO: Call IPC bridge to clear context
      // await window.electronAPI.conversation.clearContext(currentSession.id);
      console.log('Clear context');
    } catch (error) {
      console.error('Failed to clear context:', error);
    }
  };

  if (!contextInfo) {
    return (
      <div className='flex items-center justify-center h-full text-muted-foreground'>
        {t('memory.context.noActive')}
      </div>
    );
  }

  return (
    <div className='p-16px h-full overflow-y-auto'>
      {/* Stats Cards */}
      <div
        className='grid gap-16px mb-24px'
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
      >
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{contextInfo.message_count || 0}</div>
            <div className="text-sm text-muted-foreground">{t('memory.context.messages')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{contextInfo.token_count || 0}</div>
            <div className="text-sm text-muted-foreground">{t('memory.context.tokens')}</div>
          </CardContent>
        </Card>
        <Card className="flex items-center justify-center">
          <CardContent>
            <Button variant="destructive" onClick={handleClearContext} className="gap-2">
              <Trash2 size={16} />
              {t('memory.context.clear')}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Context Messages */}
      {contextInfo.messages && contextInfo.messages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('memory.context.active')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {contextInfo.messages.map((item) => (
                <div key={item.id} className="border-b last:border-0 pb-3 last:pb-0">
                  <div className='flex items-center gap-8px mb-8px'>
                    <Badge variant="outline">{item.type}</Badge>
                    <span className='text-12px text-t-secondary'>
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className='text-14px text-t-primary line-clamp-2'>{item.content}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ContextView;
