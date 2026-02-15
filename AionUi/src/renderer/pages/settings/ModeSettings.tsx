/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import ModelModalContent from '@/renderer/components/SettingsModal/contents/ModelModalContent';
import SettingsPageWrapper from './components/SettingsPageWrapper';
import ModelSettings from './ModelSettings';

const ModeSettings: React.FC = () => {
  return (
    <SettingsPageWrapper contentClassName='max-w-1100px'>
      <ModelSettings />
      <ModelModalContent />
    </SettingsPageWrapper>
  );
};

export default ModeSettings;
