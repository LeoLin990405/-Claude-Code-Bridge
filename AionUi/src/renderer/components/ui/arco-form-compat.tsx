/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Arco Design Form 兼容层
 * 用于简化从 Arco Form 到 react-hook-form 的迁移
 * Migration compatibility layer from Arco Form to react-hook-form
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

// Form 实例类型
interface FormInstance {
  getFieldValue: (name: string) => any;
  setFieldValue: (name: string, value: any) => void;
  resetFields: () => void;
  validate: () => Promise<any>;
}

// Form.Item Props
interface FormItemProps {
  label?: React.ReactNode;
  field?: string;
  required?: boolean;
  rules?: Array<{ required?: boolean; message?: string }>;
  hidden?: boolean;
  extra?: React.ReactNode;
  validateStatus?: 'success' | 'error' | 'warning';
  help?: string;
  initialValue?: any;
  children: React.ReactElement;
  className?: string;
  layout?: 'vertical' | 'horizontal';
}

// Form Props
interface FormProps {
  form?: FormInstance;
  layout?: 'vertical' | 'horizontal';
  className?: string;
  children: React.ReactNode;
  onSubmit?: (values: any) => void;
}

// 创建 Form Hook
export function useArcoForm(): [FormInstance] {
  const valuesRef = React.useRef<Record<string, any>>({});

  const formInstance: FormInstance = {
    getFieldValue: (name: string) => valuesRef.current[name],
    setFieldValue: (name: string, value: any) => {
      valuesRef.current[name] = value;
    },
    resetFields: () => {
      valuesRef.current = {};
    },
    validate: async () => valuesRef.current,
  };

  return [formInstance];
}

// Form.Item 组件
export const FormItem: React.FC<FormItemProps> = ({
  label,
  field,
  required,
  rules,
  hidden,
  extra,
  validateStatus,
  help,
  initialValue,
  children,
  className,
  layout = 'vertical',
}) => {
  if (hidden) return null;

  const isError = validateStatus === 'error';
  const errorMessage = help;

  return (
    <div className={cn('form-item mb-4', className)}>
      {label && (
        <label className={cn(
          'block text-sm font-medium mb-1.5',
          isError ? 'text-destructive' : 'text-foreground',
          required && "after:content-['*'] after:text-destructive after:ml-0.5"
        )}>
          {label}
        </label>
      )}
      <div className="form-item-control">
        {React.cloneElement(children as React.ReactElement<any>, {
          ...(children.props as Record<string, unknown>),
          className: cn(
            (children.props as { className?: string }).className,
            isError && 'border-destructive focus-visible:ring-destructive'
          ),
        })}
      </div>
      {isError && errorMessage && (
        <div className="text-sm text-destructive mt-1">{errorMessage}</div>
      )}
      {extra && <div className="text-xs text-muted-foreground mt-1">{extra}</div>}
    </div>
  );
};

// Form 组件
export const Form: React.FC<FormProps> & { 
  Item: typeof FormItem; 
  useForm: typeof useArcoForm;
  useWatch: (name?: string) => any;
} = ({ form, layout = 'vertical', className, children, onSubmit }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form && onSubmit) {
      form.validate().then(onSubmit).catch(() => {});
    }
  };

  return (
    <form 
      onSubmit={handleSubmit}
      className={cn(
        'form',
        layout === 'vertical' && 'space-y-0',
        className
      )}
    >
      {children}
    </form>
  );
};

Form.Item = FormItem;
Form.useForm = useArcoForm;
Form.useWatch = (_name?: string) => undefined;

export default Form;
