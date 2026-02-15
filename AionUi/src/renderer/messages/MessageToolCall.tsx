/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IMessageToolCall } from '@/common/chatLib';
import FileChangesPanel from '@/renderer/components/base/FileChangesPanel';
import { useDiffPreviewHandlers } from '@/renderer/hooks/useDiffPreviewHandlers';
import { parseDiff } from '@/renderer/utils/diffUtils';
import { Alert, AlertDescription } from '@/renderer/components/ui/alert';
import { MessageSearch } from '@icon-park/react';
import { createTwoFilesPatch } from 'diff';
import React, { useMemo } from 'react';
import MarkdownView from '../components/Markdown';
import { iconColors } from '@/renderer/theme/colors';

const ReplacePreview: React.FC<{ message: IMessageToolCall }> = ({ message }) => {
  const filePath = message.content.args.file_path;

  const diffText = useMemo(() => {
    return createTwoFilesPatch(filePath, filePath, message.content.args.old_string ?? '', message.content.args.new_string ?? '', '', '', { context: 3 });
  }, [filePath, message.content.args.old_string, message.content.args.new_string]);

  const fileInfo = useMemo(() => parseDiff(diffText, filePath), [diffText, filePath]);
  const displayName = filePath.split(/[/\\]/).pop() || filePath;
  const { handleFileClick, handleDiffClick } = useDiffPreviewHandlers({ diffText, displayName, filePath });

  return <FileChangesPanel title={fileInfo.fileName} files={[fileInfo]} onFileClick={handleFileClick} onDiffClick={handleDiffClick} defaultExpanded={true} />;
};

const MessageToolCall: React.FC<{ message: IMessageToolCall }> = ({ message }) => {
  if (['list_directory', 'read_file', 'write_file'].includes(message.content.name)) {
    const { absolute_path, path, file_path = absolute_path || path, status } = message.content.args;
    const OpName = message.content.name === 'read_file' ? 'ReadFile' : 'WriteFile';
    const variant = status === 'error' ? 'destructive' : status === 'success' ? 'default' : 'default';
    return (
      <Alert variant={variant} className='hive-tool-call-alert'>
        <AlertDescription>{OpName + ':' + file_path}</AlertDescription>
      </Alert>
    );
  }
  if (message.content.name === 'google_web_search') {
    return (
      <Alert className='hive-tool-call-alert'>
        <MessageSearch theme='outline' fill={iconColors.primary} className='h-4 w-4 mr-2' />
        <AlertDescription>{message.content.args.query}</AlertDescription>
      </Alert>
    );
  }
  if (message.content.name === 'run_shell_command') {
    const shellSnippet = `\`\`\`shell
${message.content.args.command}
#${message.content.args.description}`;
    return (
      <div className='hive-tool-call-markdown'>
        <MarkdownView>{shellSnippet}</MarkdownView>
      </div>
    );
  }
  if (message.content.name === 'replace') {
    return <ReplacePreview message={message} />;
  }
  return <div className='text-t-primary'>{message.content.name}</div>;
};

export default MessageToolCall;
