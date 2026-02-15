/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, List, Database } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const MonitorLayout: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/monitor',
      label: t('monitor.nav.dashboard', { defaultValue: 'Dashboard' }),
      icon: LayoutDashboard,
    },
    {
      key: '/monitor/cache',
      label: t('monitor.nav.cache', { defaultValue: 'Cache' }),
      icon: Database,
    },
    {
      key: '/monitor/tasks',
      label: t('monitor.nav.tasks', { defaultValue: 'Tasks' }),
      icon: List,
    },
  ];

  const selectedKey = menuItems.some((item) => item.key === location.pathname) ? location.pathname : '/monitor';

  return (
    <div className='flex h-full'>
      {/* Sidebar */}
      <aside className='w-[220px] border-r border-border bg-background flex-shrink-0'>
        <div className='p-4'>
          <h2 className='text-base font-semibold mb-3'>{t('monitor.title', { defaultValue: 'Gateway Monitor' })}</h2>
          <nav className='space-y-1'>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = selectedKey === item.key;
              return (
                <button key={item.key} onClick={() => navigate(item.key)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left ${isActive ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}`}>
                  <Icon className='h-4 w-4' />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Content */}
      <main className='flex-1 p-5 overflow-auto'>
        <Outlet />
      </main>
    </div>
  );
};

export default MonitorLayout;
