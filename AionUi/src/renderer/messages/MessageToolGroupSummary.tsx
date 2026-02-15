import { Badge } from '@/renderer/components/ui/badge';
import { ChevronDown, ChevronRight } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import type { IMessageAcpToolCall, IMessageToolGroup } from '../../common/chatLib';
import './MessageToolGroupSummary.css';

type StatusType = 'default' | 'success' | 'error' | 'processing';

const ToolGroupMapper = (m: IMessageToolGroup) => {
  return m.content.map(({ name, callId, description, confirmationDetails, status }) => {
    let desc = description.slice(0, 100);
    const type = confirmationDetails?.type;
    if (type === 'edit') desc = confirmationDetails.fileName;
    if (type === 'exec') desc = confirmationDetails.command;
    if (type === 'info') desc = confirmationDetails.urls?.join(';') || confirmationDetails.title;
    if (type === 'mcp') desc = confirmationDetails.serverName + ':' + confirmationDetails.toolName;
    return {
      key: callId,
      name: name,
      desc,
      status: (status === 'Success' ? 'success' : status === 'Error' ? 'error' : status === 'Canceled' ? 'default' : 'processing') as StatusType,
    };
  });
};

const ToolAcpMapper = (message: IMessageAcpToolCall) => {
  const update = message.content.update;
  if (!update) return;
  return {
    key: update.toolCallId,
    name: update.rawInput?.description || update.title,
    desc: update.rawInput?.command || update.kind,
    status: update.status === 'completed' ? 'success' : update.status === 'failed' ? 'error' : ('default' as StatusType),
  };
};

const MessageToolGroupSummary: React.FC<{ messages: Array<IMessageToolGroup | IMessageAcpToolCall> }> = ({ messages }) => {
  const [showMore, setShowMore] = useState(() => {
    if (!messages.length) return false;
    return messages.some((m) => (m.type === 'tool_group' && m.content.some((t) => t.status !== 'Success' && t.status !== 'Error' && t.status !== 'Canceled')) || (m.type === 'acp_tool_call' && m.content.update.status !== 'completed'));
  });
  const tools = useMemo(() => {
    return messages
      .map((m) => {
        if (m.type === 'tool_group') return ToolGroupMapper(m);
        return ToolAcpMapper(m);
      })
      .flat()
      .filter(Boolean);
  }, [messages]);

  const getStatusVariant = (status: StatusType) => {
    switch (status) {
      case 'success':
        return 'default';
      case 'error':
        return 'destructive';
      case 'processing':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className='hive-tool-summary'>
      <div className='flex items-center gap-10px color-#86909C cursor-pointer hive-tool-summary__toggle' onClick={() => setShowMore(!showMore)}>
        <Badge variant='outline' className='text-[#86909C] border-[#86909C]'>
          View Steps
        </Badge>
        {showMore ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </div>
      {showMore && (
        <div className='p-l-20px flex flex-col gap-8px pt-8px hive-tool-summary__list'>
          {tools.map((item) => {
            if (!item) return null;
            return (
              <div key={item.key} className='flex flex-row color-#86909C gap-12px items-center'>
                <Badge variant={getStatusVariant(item.status)} className={item.status === 'processing' ? 'badge-breathing' : ''}>
                  {item.status === 'processing' && <span className='mr-1'>●</span>}
                </Badge>
                <span>{`${item.name}(${item.desc})`} </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default React.memo(MessageToolGroupSummary);
