import React, { useState, useMemo, useCallback } from 'react';
import {
  Play, Webhook, Clock, Zap, MessageSquare, Brain, Languages, Sparkles,
  GitBranch, Repeat, Timer, Merge, Filter, ShieldAlert, Code, FileText,
  Split, Calculator, Globe, Hash, Mail, Database, FileInput, FileOutput,
  Rss, Search, ChevronDown, ChevronRight, GripVertical,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  allNodeTypes,
  categoryLabels,
  getCategoryBgClass,
  getCategoryTextClass,
  getCategoryBgLightClass,
  type NodeCategory,
  type NodeTypeDef,
} from './nodeTypes';

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  Play, Webhook, Clock, Zap, MessageSquare, Brain, Languages, Sparkles,
  GitBranch, Repeat, Timer, Merge, Filter, ShieldAlert, Code, FileText,
  Split, Calculator, Globe, Hash, Mail, Database, FileInput, FileOutput,
  Rss,
};

const categories: NodeCategory[] = ['trigger', 'ai', 'logic', 'data', 'integration'];

export default function NodePalette() {
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<NodeCategory>>(new Set());

  const filteredByCategory = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const grouped: Record<NodeCategory, NodeTypeDef[]> = {
      trigger: [],
      ai: [],
      logic: [],
      data: [],
      integration: [],
    };
    for (const nt of allNodeTypes) {
      if (q && !nt.label.toLowerCase().includes(q) && !nt.description.toLowerCase().includes(q) && !nt.type.toLowerCase().includes(q)) {
        continue;
      }
      grouped[nt.category].push(nt);
    }
    return grouped;
  }, [searchQuery]);

  const toggleCategory = useCallback((cat: NodeCategory) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, nodeType: string) => {
    e.dataTransfer.setData('application/workflow-node-type', nodeType);
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  return (
    <div className="w-64 h-full flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
          Node Palette
        </h3>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            className="pl-8 h-8 text-xs"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Scrollable node list */}
      <div className="flex-1 overflow-y-auto">
        {categories.map((cat) => {
          const items = filteredByCategory[cat];
          if (items.length === 0) return null;

          const isCollapsed = collapsedCategories.has(cat);

          return (
            <div key={cat}>
              {/* Category header */}
              <button
                onClick={() => toggleCategory(cat)}
                className={`
                  w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold
                  ${getCategoryTextClass(cat)}
                  hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
                `}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                <span>{categoryLabels[cat]}</span>
                <span className="ml-auto text-[10px] text-gray-400 font-normal">
                  {items.length}
                </span>
              </button>

              {/* Node cards */}
              {!isCollapsed && (
                <div className="px-2 pb-2 space-y-1">
                  {items.map((nt) => {
                    const IconComp = iconMap[nt.icon] ?? Code;
                    return (
                      <div
                        key={nt.type}
                        draggable
                        onDragStart={(e) => handleDragStart(e, nt.type)}
                        className={`
                          flex items-start gap-2 px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing
                          border border-transparent
                          ${getCategoryBgLightClass(cat)}
                          hover:border-gray-300 dark:hover:border-gray-600
                          transition-all hover:shadow-sm
                          group
                        `}
                      >
                        <div className={`mt-0.5 flex-shrink-0 rounded p-1 ${getCategoryBgClass(cat)}`}>
                          <IconComp className="h-3 w-3 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-medium text-gray-800 dark:text-gray-200 truncate">
                            {nt.label}
                          </div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight line-clamp-2">
                            {nt.description}
                          </div>
                        </div>
                        <GripVertical className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* No results */}
        {searchQuery && Object.values(filteredByCategory).every((arr) => arr.length === 0) && (
          <div className="px-3 py-8 text-center">
            <Search className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-xs text-gray-400">
              No nodes match "{searchQuery}"
            </p>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700">
        <p className="text-[10px] text-gray-400 text-center">
          Drag nodes onto the canvas to add them
        </p>
      </div>
    </div>
  );
}
