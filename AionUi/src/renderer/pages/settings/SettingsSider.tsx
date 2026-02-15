import FlexFullContainer from '@/renderer/components/FlexFullContainer';
import { isElectronDesktop } from '@/renderer/utils/platform';
import { Communication, Computer, Earth, Gemini, Info, LinkCloud, Robot, Shield, System, Toolkit } from '@icon-park/react';
import classNames from 'classnames';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/renderer/components/ui/tooltip';

const SettingsSider: React.FC<{ collapsed?: boolean }> = ({ collapsed = false }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const isDesktop = isElectronDesktop();

  const menus = useMemo(() => {
    const items = [
      {
        label: t('settings.hivemind', { defaultValue: 'Hivemind' }),
        icon: <Communication />,
        path: 'hivemind',
      },
      {
        label: t('settings.gemini'),
        icon: <Gemini />,
        path: 'gemini',
      },
      {
        label: t('settings.model'),
        icon: <LinkCloud />,
        path: 'model',
      },
      {
        label: t('settings.assistants', { defaultValue: 'Assistants' }),
        icon: <Robot />,
        path: 'agent',
      },
      {
        label: t('settings.tools'),
        icon: <Toolkit />,
        path: 'tools',
      },
      {
        label: t('settings.security'),
        icon: <Shield />,
        path: 'security',
      },
      {
        label: t('settings.display'),
        icon: <Computer />,
        path: 'display',
      },
    ];

    items.push({
      label: t('settings.webui'),
      icon: isDesktop ? <Earth /> : <Communication />,
      path: 'webui',
    });

    items.push(
      {
        label: t('settings.system'),
        icon: <System />,
        path: 'system',
      },
      {
        label: t('settings.about'),
        icon: <Info />,
        path: 'about',
      }
    );

    return items;
  }, [t, isDesktop]);

  return (
    <TooltipProvider>
      <div className={classNames('hive-settings-sider flex-1 settings-sider flex flex-col gap-6px', { 'settings-sider--collapsed': collapsed })}>
        {menus.map((item) => {
          const isSelected = pathname.includes(item.path);
          const menuItem = (
            <div
              className={classNames('hive-settings-sider__item settings-sider__item px-12px py-8px rd-10px flex justify-start items-center group cursor-pointer relative overflow-hidden shrink-0 transition-colors', {
                'hive-settings-sider__item--active !bg-aou-2': isSelected,
              })}
              onClick={() => {
                Promise.resolve(navigate(`/settings/${item.path}`, { replace: true })).catch((error) => {
                  console.error('Navigation failed:', error);
                });
              }}
            >
              {React.cloneElement(item.icon, {
                theme: 'outline',
                size: '20',
                className: 'mt-2px ml-2px mr-8px flex',
              })}
              <FlexFullContainer className='h-24px'>
                <div className='hive-settings-sider__item-label settings-sider__item-label text-nowrap overflow-hidden inline-block w-full text-14px lh-24px whitespace-nowrap text-t-primary'>{item.label}</div>
              </FlexFullContainer>
            </div>
          );

          return collapsed ? (
            <Tooltip key={item.path} delayDuration={0}>
              <TooltipTrigger asChild>{menuItem}</TooltipTrigger>
              <TooltipContent side='right'>
                <p>{item.label}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <React.Fragment key={item.path}>{menuItem}</React.Fragment>
          );
        })}
      </div>
    </TooltipProvider>
  );
};

export default SettingsSider;
