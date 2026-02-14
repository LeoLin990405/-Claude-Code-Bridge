/**
 * SearchView - Search through conversation messages
 */
import React, { useState } from 'react';
import { Input } from '@/renderer/components/ui/input';
import { Badge } from '@/renderer/components/ui/badge';
import { Search } from 'lucide-react';
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
      <div className="flex gap-2 mb-24px">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('memory.search.placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={isLoading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {isLoading ? '...' : t('memory.search.button', { defaultValue: 'Search' })}
        </button>
      </div>

      {/* Results */}
      <div className='flex-1 overflow-y-auto'>
        {isLoading ? (
          <div className='flex items-center justify-center h-full'>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            {t('memory.search.noResults')}
          </div>
        ) : (
          <div className="space-y-2">
            {(searchResults as Message[]).map((item) => (
              <div
                key={item.id}
                className='hover:bg-fill-2 cursor-pointer rounded-md p-12px border'
                onClick={() => navigate(`/conversation/${item.conversation_id}`)}
              >
                <div className='w-full'>
                  <div className='flex items-center gap-8px mb-8px'>
                    <Badge variant="outline">{item.type}</Badge>
                    <span className='text-12px text-t-secondary'>
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className='text-14px text-t-primary line-clamp-3'>{item.content}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchView;
