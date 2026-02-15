/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Tag } from '@arco-design/web-react';

interface SyncStatusBadgeProps {
  totalSkills: number;
  syncedSkills: number;
  errors: number;
}

const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({ totalSkills, syncedSkills, errors }) => {
  if (totalSkills === 0) {
    return <Tag color='gray'>No Skills</Tag>;
  }

  if (errors > 0) {
    return <Tag color='red'>Errors: {errors}</Tag>;
  }

  if (syncedSkills > 0) {
    return (
      <Tag color='green'>
        Synced: {syncedSkills}/{totalSkills}
      </Tag>
    );
  }

  return <Tag color='orange'>Pending Sync</Tag>;
};

export default SyncStatusBadge;
