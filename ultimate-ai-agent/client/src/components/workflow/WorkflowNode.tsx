import React, { useCallback, useMemo } from 'react';
import {
  Play, Webhook, Clock, Zap, MessageSquare, Brain, Languages, Sparkles,
  GitBranch, Repeat, Timer, Merge, Filter, ShieldAlert, Code, FileText,
  Split, Calculator, Globe, Hash, Mail, Database, FileInput, FileOutput,
  Rss,
} from 'lucide-react';
import { getNodeTypeDef, getCategoryBgClass, getCategoryTextClass, type NodeCategory } from './nodeTypes';

// Map icon name strings to actual lucide components
const iconMap: Record<string, React.FC<{ className?: string }>> = {
  Play, Webhook, Clock, Zap, MessageSquare, Brain, Languages, Sparkles,
  GitBranch, Repeat, Timer, Merge, Filter, ShieldAlert, Code, FileText,
  Split, Calculator, Globe, Hash, Mail, Database, FileInput, FileOutput,
  Rss,
};

export interface WorkflowNodeData {
  id: string;
  type: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
}

export interface WorkflowNodeProps {
  node: WorkflowNodeData;
  isSelected: boolean;
  onStartConnect: (nodeId: string, portId: string, portType: 'output', event: React.MouseEvent) => void;
  onEndConnect: (nodeId: string, portId: string, portType: 'input') => void;
}

const NODE_WIDTH = 200;

export default function WorkflowNode({ node, isSelected, onStartConnect, onEndConnect }: WorkflowNodeProps) {
  const typeDef = useMemo(() => getNodeTypeDef(node.type), [node.type]);

  const category: NodeCategory = typeDef?.category ?? 'data';
  const label = typeDef?.label ?? node.type;
  const iconName = typeDef?.icon ?? 'Code';
  const IconComp = iconMap[iconName] ?? Code;

  // Determine output ports
  const outputPorts = useMemo(() => {
    if (node.type === 'logic_if') {
      return [
        { id: 'true', label: 'true' },
        { id: 'false', label: 'false' },
      ];
    }
    return [{ id: 'output', label: '' }];
  }, [node.type]);

  // Key config preview values (show first 2 non-empty config values)
  const configPreview = useMemo(() => {
    if (!typeDef) return [];
    const entries: { label: string; value: string }[] = [];
    for (const field of typeDef.configFields) {
      const val = node.config[field.key];
      if (val !== undefined && val !== '' && val !== null) {
        let display = String(val);
        if (display.length > 30) display = display.slice(0, 27) + '...';
        entries.push({ label: field.label, value: display });
        if (entries.length >= 2) break;
      }
    }
    return entries;
  }, [typeDef, node.config]);

  const handleInputMouseUp = useCallback(() => {
    onEndConnect(node.id, 'input', 'input');
  }, [node.id, onEndConnect]);

  const handleOutputMouseDown = useCallback(
    (portId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onStartConnect(node.id, portId, 'output', e);
    },
    [node.id, onStartConnect]
  );

  return (
    <div
      className={`
        relative select-none rounded-lg shadow-md border bg-white dark:bg-gray-900
        ${isSelected ? 'ring-2 ring-blue-500 border-blue-400' : 'border-gray-200 dark:border-gray-700'}
      `}
      style={{ width: NODE_WIDTH }}
      data-node-id={node.id}
    >
      {/* Header bar */}
      <div
        className={`
          flex items-center gap-2 px-3 py-2 rounded-t-lg cursor-grab active:cursor-grabbing
          ${getCategoryBgClass(category)} text-white
        `}
        data-drag-handle="true"
      >
        <IconComp className="h-4 w-4 flex-shrink-0" />
        <span className="text-xs font-semibold truncate">{label}</span>
      </div>

      {/* Body */}
      <div className="px-3 py-2 min-h-[24px]">
        {configPreview.length > 0 ? (
          <div className="space-y-1">
            {configPreview.map((item) => (
              <div key={item.label} className="flex flex-col">
                <span className={`text-[10px] font-medium ${getCategoryTextClass(category)}`}>
                  {item.label}
                </span>
                <span className="text-[10px] text-gray-600 dark:text-gray-400 truncate">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-[10px] text-gray-400 italic">No config</span>
        )}
      </div>

      {/* Input port (left side) */}
      <div
        className="absolute -left-[6px] top-1/2 -translate-y-1/2 z-10"
        onMouseUp={handleInputMouseUp}
      >
        <div
          className="w-3 h-3 rounded-full border-2 border-gray-400 bg-white dark:bg-gray-800
                     hover:border-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900
                     transition-colors cursor-crosshair"
          title="Input"
        />
      </div>

      {/* Output ports (right side) */}
      {outputPorts.map((port, idx) => {
        // Position each port evenly spaced on the right side
        const totalPorts = outputPorts.length;
        const spacing = totalPorts === 1 ? 50 : 30 + (idx * 40);
        return (
          <div
            key={port.id}
            className="absolute -right-[6px] z-10 flex items-center"
            style={{ top: `${spacing}%`, transform: 'translateY(-50%)' }}
            onMouseDown={(e) => handleOutputMouseDown(port.id, e)}
          >
            {port.label && (
              <span className="text-[9px] text-gray-500 mr-1 select-none pointer-events-none">
                {port.label}
              </span>
            )}
            <div
              className="w-3 h-3 rounded-full border-2 border-gray-400 bg-white dark:bg-gray-800
                         hover:border-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900
                         transition-colors cursor-crosshair"
              title={`Output: ${port.label || 'default'}`}
            />
          </div>
        );
      })}
    </div>
  );
}

export { NODE_WIDTH };
