/**
 * Memory Hub - Main Page
 *
 * Unified interface for managing conversation history, memory search, and context
 */
import React, { useState } from 'react';
import { Card, Tabs } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import SessionsList from './SessionsList';
import SearchView from './SearchView';
import ContextView from './ContextView';

const { TabPane } = Tabs;

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
        <Tabs activeTab={activeTab} onChange={setActiveTab}>
          <TabPane key='sessions' title={t('memory.tabs.sessions')}>
            <SessionsList />
          </TabPane>
          <TabPane key='search' title={t('memory.tabs.search')}>
            <SearchView />
          </TabPane>
          <TabPane key='context' title={t('memory.tabs.context')}>
            <ContextView />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default MemoryHub;
