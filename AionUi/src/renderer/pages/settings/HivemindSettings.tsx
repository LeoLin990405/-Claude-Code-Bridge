/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import SettingsPageWrapper from './components/SettingsPageWrapper';
import HivemindModalContent from '@/renderer/components/SettingsModal/contents/HivemindModalContent';

const HivemindSettings: React.FC = () => {
  return (
    <SettingsPageWrapper contentClassName='max-w-1000px'>
      <HivemindModalContent />
    </SettingsPageWrapper>
  );
};

export default HivemindSettings;
