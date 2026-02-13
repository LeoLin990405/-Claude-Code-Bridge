/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { Button } from './button';

interface LegacyModalProps {
  title: string;
  visible: boolean;
  onOk: () => void;
  onCancel: () => void;
  children: React.ReactNode;
  okText?: string;
  cancelText?: string;
  confirmLoading?: boolean;
  width?: number | string;
}

/**
 * 兼容层组件 - 方便从 Arco Modal 迁移到 shadcn Dialog
 * Migration wrapper component - for easier transition from Arco Modal to shadcn Dialog
 * 
 * TODO: 迁移完成后可删除此组件
 * TODO: Remove this component after full migration
 */
export const LegacyModal: React.FC<LegacyModalProps> = ({
  title,
  visible,
  onOk,
  onCancel,
  children,
  okText = 'OK',
  cancelText = 'Cancel',
  confirmLoading = false,
  width = 520,
}) => {
  return (
    <Dialog open={visible} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent 
        style={{ width: typeof width === 'number' ? `${width}px` : width }}
        className="sm:max-w-[600px]"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {children}
        </div>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onCancel}
            disabled={confirmLoading}
          >
            {cancelText}
          </Button>
          <Button 
            onClick={onOk}
            disabled={confirmLoading}
          >
            {confirmLoading ? 'Loading...' : okText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
