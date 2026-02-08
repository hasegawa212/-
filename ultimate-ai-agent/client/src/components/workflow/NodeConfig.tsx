import React, { useMemo, useCallback } from 'react';
import {
  Play, Webhook, Clock, Zap, MessageSquare, Brain, Languages, Sparkles,
  GitBranch, Repeat, Timer, Merge, Filter, ShieldAlert, Code, FileText,
  Split, Calculator, Globe, Hash, Mail, Database, FileInput, FileOutput,
  Rss, Trash2, Copy, X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  getNodeTypeDef,
  getCategoryBgClass,
  getCategoryTextClass,
  getCategoryBorderClass,
  type ConfigFieldDef,
} from './nodeTypes';
import type { WorkflowNodeData } from './WorkflowNode';

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  Play, Webhook, Clock, Zap, MessageSquare, Brain, Languages, Sparkles,
  GitBranch, Repeat, Timer, Merge, Filter, ShieldAlert, Code, FileText,
  Split, Calculator, Globe, Hash, Mail, Database, FileInput, FileOutput,
  Rss,
};

export interface NodeConfigProps {
  node: WorkflowNodeData;
  onConfigChange: (nodeId: string, config: Record<string, unknown>) => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
  onClose: () => void;
}

export default function NodeConfig({
  node,
  onConfigChange,
  onDeleteNode,
  onDuplicateNode,
  onClose,
}: NodeConfigProps) {
  const typeDef = useMemo(() => getNodeTypeDef(node.type), [node.type]);

  const category = typeDef?.category ?? 'data';
  const label = typeDef?.label ?? node.type;
  const iconName = typeDef?.icon ?? 'Code';
  const IconComp = iconMap[iconName] ?? Code;
  const configFields = typeDef?.configFields ?? [];

  const getFieldValue = useCallback(
    (field: ConfigFieldDef): string | number | boolean => {
      const val = node.config[field.key];
      if (val !== undefined && val !== null) return val as string | number | boolean;
      if (field.default !== undefined) return field.default;
      if (field.type === 'boolean') return false;
      if (field.type === 'number') return 0;
      return '';
    },
    [node.config]
  );

  const handleFieldChange = useCallback(
    (key: string, value: unknown) => {
      onConfigChange(node.id, { ...node.config, [key]: value });
    },
    [node.id, node.config, onConfigChange]
  );

  const renderField = useCallback(
    (field: ConfigFieldDef) => {
      const value = getFieldValue(field);

      switch (field.type) {
        case 'string':
          return (
            <Input
              className="h-8 text-xs"
              value={String(value)}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              placeholder={field.label}
            />
          );

        case 'number':
          return (
            <Input
              className="h-8 text-xs"
              type="number"
              value={Number(value)}
              onChange={(e) => handleFieldChange(field.key, parseFloat(e.target.value) || 0)}
              placeholder={field.label}
            />
          );

        case 'boolean':
          return (
            <label className="flex items-center gap-2 cursor-pointer">
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(value)}
                onClick={() => handleFieldChange(field.key, !value)}
                className={`
                  relative w-9 h-5 rounded-full transition-colors
                  ${Boolean(value) ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}
                `}
              >
                <span
                  className={`
                    absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow
                    ${Boolean(value) ? 'translate-x-4' : 'translate-x-0'}
                  `}
                />
              </button>
              <span className="text-xs text-gray-600 dark:text-gray-300">
                {Boolean(value) ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          );

        case 'select':
          return (
            <select
              className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={String(value)}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
            >
              {(field.options ?? []).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          );

        case 'code':
          return (
            <Textarea
              className="text-xs font-mono min-h-[80px] resize-y"
              value={String(value)}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              placeholder={field.label}
              rows={4}
            />
          );

        case 'json':
          return (
            <Textarea
              className="text-xs font-mono min-h-[80px] resize-y"
              value={String(value)}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              placeholder={`{ "key": "value" }`}
              rows={4}
            />
          );

        default:
          return (
            <Input
              className="h-8 text-xs"
              value={String(value)}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
            />
          );
      }
    },
    [getFieldValue, handleFieldChange]
  );

  return (
    <div className="w-80 h-full flex flex-col bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className={`flex items-center gap-2 px-4 py-3 border-b ${getCategoryBorderClass(category)} border-b-2`}>
        <div className={`rounded p-1.5 ${getCategoryBgClass(category)}`}>
          <IconComp className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
            {label}
          </h3>
          <p className={`text-[10px] ${getCategoryTextClass(category)}`}>
            {node.type}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          title="Close"
        >
          <X className="h-4 w-4 text-gray-400" />
        </button>
      </div>

      {/* Description */}
      {typeDef?.description && (
        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800">
          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
            {typeDef.description}
          </p>
        </div>
      )}

      {/* Config fields */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {configFields.length === 0 ? (
          <p className="text-xs text-gray-400 italic text-center py-4">
            This node has no configurable fields.
          </p>
        ) : (
          configFields.map((field) => (
            <div key={field.key}>
              <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">
                {field.label}
              </label>
              {renderField(field)}
            </div>
          ))
        )}
      </div>

      {/* Footer actions */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
        {/* Node ID */}
        <p className="text-[10px] text-gray-400 font-mono truncate mb-2" title={node.id}>
          ID: {node.id}
        </p>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => onDuplicateNode(node.id)}
          >
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Duplicate
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => onDeleteNode(node.id)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
