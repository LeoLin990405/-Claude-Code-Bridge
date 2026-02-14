/**
 * Memory Hub - Main Page
 *
 * Unified interface for managing conversation history, memory search, and context
 */
import React, { useState } from 'react';
import { Card, CardContent } from '@/renderer/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/renderer/components/ui/tabs';
import { useTranslation } from 'react-i18next';
import SessionsList from './SessionsList';
import SearchView from './SearchView';
import ContextView from './ContextView';

const MemoryHub: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('sessions');

  return (
    <div className='size-full flex flex-col bg-1 p-24px overflow-hidden'>
      {/* Header */}
      <div className='mb-24px'>
        <h1 className='text-24px font-bold text-t-primary mb-8px'>
          {t('memory.title')}
        </h1>
        <p className='text-14px text-t-secondary'>
          {t('memory.subtitle')}
        </p>
      </div>

      {/* Main Content */}
      <Card className='flex-1 min-h-0'>
        <CardContent className="p-0 h-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="px-4 pt-2">
              <TabsTrigger value='sessions'>{t('memory.tabs.sessions')}</TabsTrigger>
              <TabsTrigger value='search'>{t('memory.tabs.search')}</TabsTrigger>
              <TabsTrigger value='context'>{t('memory.tabs.context')}</TabsTrigger>
            </TabsList>
            <TabsContent value='sessions' className="flex-1 overflow-hidden">
              <SessionsList />
            </TabsContent>
            <TabsContent value='search' className="flex-1 overflow-hidden">
              <SearchView />
            </TabsContent>
            <TabsContent value='context' className="flex-1 overflow-hidden">
              <ContextView />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default MemoryHub;
