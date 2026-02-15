/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IMessageText } from '@/common/chatLib';
import { HIVEMIND_FILES_MARKER } from '@/common/constants';
import { iconColors } from '@/renderer/theme/colors';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/renderer/components/ui/tooltip';
import { Copy } from '@icon-park/react';
import classNames from 'classnames';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CollapsibleContent from '../components/CollapsibleContent';
import FilePreview from '../components/FilePreview';
import HorizontalFileList from '../components/HorizontalFileList';
import MarkdownView from '../components/Markdown';
import { stripThinkTags, hasThinkTags } from '../utils/thinkTagFilter';

const parseFileMarker = (content: string) => {
  const markerIndex = content.indexOf(HIVEMIND_FILES_MARKER);
  if (markerIndex === -1) {
    return { text: content, files: [] as string[] };
  }
  const text = content.slice(0, markerIndex).trimEnd();
  const afterMarker = content.slice(markerIndex + HIVEMIND_FILES_MARKER.length).trim();
  const files = afterMarker
    ? afterMarker
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    : [];
  return { text, files };
};

const useFormatContent = (content: string) => {
  return useMemo(() => {
    try {
      const json = JSON.parse(content);
      const isJson = typeof json === 'object';
      return {
        json: isJson,
        data: isJson ? json : content,
      };
    } catch {
      return { data: content };
    }
  }, [content]);
};

const MessageText: React.FC<{ message: IMessageText }> = ({ message }) => {
  const contentToRender = useMemo(() => {
    const rawContent = message.content.content;
    if (typeof rawContent === 'string' && hasThinkTags(rawContent)) {
      return stripThinkTags(rawContent);
    }
    return rawContent;
  }, [message.content.content]);

  const { text, files } = parseFileMarker(contentToRender);
  const { data, json } = useFormatContent(text);
  const { t } = useTranslation();
  const [showCopyAlert, setShowCopyAlert] = useState(false);
  const isUserMessage = message.position === 'right';

  if (!message.content.content || (typeof message.content.content === 'string' && !message.content.content.trim())) {
    return null;
  }

  const handleCopy = () => {
    const baseText = json ? JSON.stringify(data, null, 2) : text;
    const fileList = files.length ? `Files:\n${files.map((path) => `- ${path}`).join('\n')}\n\n` : '';
    const textToCopy = fileList + baseText;
    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        setShowCopyAlert(true);
        setTimeout(() => setShowCopyAlert(false), 2000);
      })
      .catch((error) => {
        console.error('Copy failed:', error);
      });
  };

  const copyButton = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className='hive-message-copy-btn p-4px rd-4px cursor-pointer hover:bg-3 transition-colors opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto' onClick={handleCopy} style={{ lineHeight: 0 }}>
            <Copy theme='outline' size='16' fill={iconColors.secondary} />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('common.copy', { defaultValue: 'Copy' })}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <>
      <div className={classNames('flex flex-col group hive-message-block', isUserMessage ? 'items-end' : 'items-start')}>
        {files.length > 0 && (
          <div className={classNames('mt-6px', { 'self-end': isUserMessage })}>
            {files.length === 1 ? (
              <div className='flex items-center'>
                <FilePreview path={files[0]} onRemove={() => undefined} readonly />
              </div>
            ) : (
              <HorizontalFileList>
                {files.map((path) => (
                  <FilePreview key={path} path={path} onRemove={() => undefined} readonly />
                ))}
              </HorizontalFileList>
            )}
          </div>
        )}
        <div
          className={classNames('hive-message-bubble rd-8px [&>p:first-child]:mt-0px [&>p:last-child]:mb-0px md:max-w-780px', {
            'hive-message-bubble--user bg-aou-2 p-8px': isUserMessage,
            'hive-message-bubble--assistant': !isUserMessage,
          })}
        >
          {json ? (
            <CollapsibleContent maxHeight={200} defaultCollapsed={true}>
              <MarkdownView codeStyle={{ marginTop: 4, marginBlock: 4 }}>{`\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``}</MarkdownView>
            </CollapsibleContent>
          ) : (
            <MarkdownView codeStyle={{ marginTop: 4, marginBlock: 4 }}>{data}</MarkdownView>
          )}
        </div>
        <div
          className={classNames('h-32px flex items-center mt-4px', {
            'justify-end': isUserMessage,
            'justify-start': !isUserMessage,
          })}
        >
          {copyButton}
        </div>
      </div>
      {showCopyAlert && (
        <div className='hive-copy-alert fixed top-5 left-1/2 -translate-x-1/2 z-[9999] bg-green-500 text-white px-4 py-2 rounded-md shadow-lg flex items-center gap-2'>
          <span>{t('messages.copySuccess')}</span>
        </div>
      )}
    </>
  );
};

export default MessageText;
