/**
 * SearchView - Search through conversation messages
 */
import React, { useState } from 'react';
import { Input, List, Empty, Spin, Tag } from '@arco-design/web-react';
import { IconSearch } from '@arco-design/web-react/icon';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMemory } from '@/renderer/context/MemoryContext';

type Message = {
  id: string;
  conversation_id: string;
  content: string;
  type: string;
  created_at: number;
};

const SearchView: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const { searchResults, isLoading, searchMemory } = useMemory();

  const handleSearch = async () => {
    if (!query.trim()) return;
    await searchMemory(query);
  };

  return (
    <div className='h-full flex flex-col p-16px'>
      {/* Search Input */}
      <Input.Search
        placeholder={t('memory.search.placeholder')}
        value={query}
        onChange={setQuery}
        onSearch={handleSearch}
        prefix={<IconSearch />}
        size='large'
        className='mb-24px'
        loading={isLoading}
      />

      {/* Results */}
      <div className='flex-1 overflow-y-auto'>
        {isLoading ? (
          <div className='flex items-center justify-center h-full'>
            <Spin />
          </div>
        ) : searchResults.length === 0 ? (
          <Empty description={t('memory.search.noResults')} />
        ) : (
          <List
            dataSource={searchResults}
            render={(item: Message) => (
              <List.Item
                key={item.id}
                className='hover:bg-fill-2 cursor-pointer rd-6px p-12px'
                onClick={() => navigate(`/conversation/${item.conversation_id}`)}
              >
                <div className='w-full'>
                  <div className='flex items-center gap-8px mb-8px'>
                    <Tag size='small'>{item.type}</Tag>
                    <span className='text-12px text-t-secondary'>
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className='text-14px text-t-primary line-clamp-3'>{item.content}</div>
                </div>
              </List.Item>
            )}
          />
        )}
      </div>
    </div>
  );
};

export default SearchView;
