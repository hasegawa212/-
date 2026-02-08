import React, { useState, useCallback, useMemo } from 'react';
import {
  Play, CheckCircle2, XCircle, SkipForward, Loader2,
  ChevronDown, ChevronRight, Clock, Timer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ---- Types ----

export type NodeExecutionStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped';

export interface NodeExecutionResult {
  nodeId: string;
  nodeLabel: string;
  status: NodeExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  output?: unknown;
  error?: string;
}

export interface ExecutionResult {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  nodeResults: NodeExecutionResult[];
}

export interface ExecutionPanelProps {
  executionResult: ExecutionResult | null;
  isRunning: boolean;
  onRunWorkflow: () => void;
}

// ---- Status icon helper ----

function StatusIcon({ status }: { status: NodeExecutionStatus }) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />;
    case 'skipped':
      return <SkipForward className="h-4 w-4 text-gray-400 flex-shrink-0" />;
    case 'running':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin flex-shrink-0" />;
    case 'pending':
    default:
      return <Clock className="h-4 w-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />;
  }
}

function statusLabel(status: NodeExecutionStatus): string {
  const labels: Record<NodeExecutionStatus, string> = {
    pending: 'Pending',
    running: 'Running',
    success: 'Success',
    error: 'Error',
    skipped: 'Skipped',
  };
  return labels[status];
}

function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTimestamp(ts?: string): string {
  if (!ts) return '-';
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    }).format(new Date(ts));
  } catch {
    return ts;
  }
}

// ---- JSON Viewer ----

function JsonViewer({ data }: { data: unknown }) {
  const formatted = useMemo(() => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, [data]);

  return (
    <pre className="text-[10px] font-mono bg-gray-50 dark:bg-gray-900 rounded p-2 overflow-auto max-h-40 text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
      {formatted}
    </pre>
  );
}

// ---- Node Execution Row ----

function NodeExecutionRow({ result }: { result: NodeExecutionResult }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasOutput = result.output !== undefined && result.output !== null;
  const hasError = !!result.error;

  return (
    <div className="border border-gray-100 dark:border-gray-800 rounded">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
      >
        <StatusIcon status={result.status} />
        <span className="text-xs font-medium text-gray-700 dark:text-gray-200 flex-1 truncate">
          {result.nodeLabel}
        </span>
        <span className="text-[10px] text-gray-400 flex-shrink-0">
          {formatDuration(result.durationMs)}
        </span>
        {(hasOutput || hasError) && (
          isExpanded
            ? <ChevronDown className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
        )}
      </button>

      {isExpanded && (hasOutput || hasError) && (
        <div className="px-3 pb-2 space-y-1.5">
          {/* Timestamps */}
          <div className="flex gap-4 text-[10px] text-gray-400">
            {result.startedAt && (
              <span>Start: {formatTimestamp(result.startedAt)}</span>
            )}
            {result.completedAt && (
              <span>End: {formatTimestamp(result.completedAt)}</span>
            )}
          </div>

          {/* Error message */}
          {hasError && (
            <div className="text-[11px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded px-2 py-1.5">
              {result.error}
            </div>
          )}

          {/* Output data */}
          {hasOutput && (
            <div>
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                Output:
              </span>
              <JsonViewer data={result.output} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Main Panel ----

export default function ExecutionPanel({
  executionResult,
  isRunning,
  onRunWorkflow,
}: ExecutionPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Progress calculation
  const progress = useMemo(() => {
    if (!executionResult) return 0;
    const total = executionResult.nodeResults.length;
    if (total === 0) return 0;
    const completed = executionResult.nodeResults.filter(
      (r) => r.status === 'success' || r.status === 'error' || r.status === 'skipped'
    ).length;
    return Math.round((completed / total) * 100);
  }, [executionResult]);

  const totalDuration = useMemo(() => {
    if (!executionResult?.startedAt) return null;
    if (executionResult.completedAt) {
      const ms = new Date(executionResult.completedAt).getTime() - new Date(executionResult.startedAt).getTime();
      return formatDuration(ms);
    }
    return 'Running...';
  }, [executionResult]);

  const overallStatusColor = useMemo(() => {
    if (!executionResult) return 'text-gray-400';
    switch (executionResult.status) {
      case 'completed': return 'text-green-500';
      case 'failed': return 'text-red-500';
      case 'running': return 'text-blue-500';
      default: return 'text-gray-400';
    }
  }, [executionResult]);

  return (
    <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 dark:border-gray-800">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </button>

        <Timer className="h-4 w-4 text-gray-400" />
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
          Execution
        </span>

        {executionResult && (
          <>
            <span className={`text-[10px] font-medium capitalize ${overallStatusColor}`}>
              {executionResult.status}
            </span>
            {totalDuration && (
              <span className="text-[10px] text-gray-400">
                {totalDuration}
              </span>
            )}
          </>
        )}

        {/* Progress bar when running */}
        {isRunning && (
          <div className="flex-1 max-w-xs h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Timestamps */}
          {executionResult?.startedAt && (
            <span className="text-[10px] text-gray-400">
              Started: {formatTimestamp(executionResult.startedAt)}
            </span>
          )}
          {executionResult?.completedAt && (
            <span className="text-[10px] text-gray-400">
              Ended: {formatTimestamp(executionResult.completedAt)}
            </span>
          )}

          <Button
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={onRunWorkflow}
            disabled={isRunning}
          >
            {isRunning ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                Run Workflow
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Execution timeline */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto px-4 py-2 max-h-64">
          {!executionResult ? (
            <div className="flex flex-col items-center justify-center py-6 text-gray-400">
              <Play className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-xs">
                No execution yet. Click "Run Workflow" to start.
              </p>
            </div>
          ) : executionResult.nodeResults.length === 0 ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 text-blue-400 animate-spin mr-2" />
              <span className="text-xs text-gray-400">Preparing execution...</span>
            </div>
          ) : (
            <div className="space-y-1">
              {executionResult.nodeResults.map((result, idx) => (
                <NodeExecutionRow key={`${result.nodeId}-${idx}`} result={result} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
