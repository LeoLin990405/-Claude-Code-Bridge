/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Alert } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';

interface HivemindRoutingInfoProps {
  requestedProvider: string | null;
  actualProvider: string | null;
}

const HivemindRoutingInfo: React.FC<HivemindRoutingInfoProps> = ({ requestedProvider, actualProvider }) => {
  const { t } = useTranslation();

  if (!actualProvider && !requestedProvider) {
    return <Alert className='mb-8px' type='info' content={t('hivemind.autoRouteDescription')} showIcon />;
  }

  if (requestedProvider && actualProvider && requestedProvider !== actualProvider) {
    return <Alert className='mb-8px' type='warning' content={t('hivemind.routeMismatch', { requested: requestedProvider, actual: actualProvider })} showIcon />;
  }

  const effective = actualProvider || requestedProvider;
  if (!effective) {
    return null;
  }

  return <Alert className='mb-8px' type='success' content={t('hivemind.routeConfirmed', { provider: effective })} showIcon />;
};

export default HivemindRoutingInfo;
