import { EventEmitter } from "events";
import { executeNodeByType } from "./executor.js";

export interface WorkflowDefinition {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: Record<string, unknown>;
  settings: {
    errorHandling: "stop" | "skip" | "retry";
    maxRetries: number;
    timeout: number;
  };
}

export interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  condition?: string;
}

export interface ExecutionContext {
  workflowId: string;
  nodeOutputs: Map<string, unknown>;
  variables: Record<string, unknown>;
  errors: Map<string, string>;
  status: Map<string, "pending" | "running" | "success" | "error" | "skipped">;
}

export interface ExecutionResult {
  workflowId: string;
  status: "completed" | "failed" | "partial";
  startedAt: string;
  completedAt: string;
  nodeResults: Map<string, NodeResult>;
  error?: string;
}

export interface NodeResult {
  nodeId: string;
  status: "success" | "error" | "skipped";
  output: unknown;
  error?: string;
  startedAt: string;
  completedAt: string;
  duration: number;
}

export interface NodeOutput {
  data: unknown;
  metadata?: Record<string, unknown>;
}

export class WorkflowEngine extends EventEmitter {
  async executeWorkflow(
    workflow: WorkflowDefinition,
    triggerData: unknown = {}
  ): Promise<ExecutionResult> {
    const startedAt = new Date().toISOString();
    const nodeResults = new Map<string, NodeResult>();

    const context: ExecutionContext = {
      workflowId: workflow.id,
      nodeOutputs: new Map(),
      variables: { ...workflow.variables, trigger: triggerData },
      errors: new Map(),
      status: new Map(),
    };

    for (const node of workflow.nodes) {
      context.status.set(node.id, "pending");
    }

    const executionOrder = this.topologicalSort(workflow);
    const layers = this.buildExecutionLayers(executionOrder, workflow);

    let workflowError: string | undefined;
    let hasFailed = false;
    let hasSkipped = false;

    try {
      for (const layer of layers) {
        if (hasFailed && workflow.settings.errorHandling === "stop") {
          for (const nodeId of layer) {
            context.status.set(nodeId, "skipped");
            nodeResults.set(nodeId, {
              nodeId,
              status: "skipped",
              output: null,
              startedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              duration: 0,
            });
            hasSkipped = true;
          }
          continue;
        }

        const layerPromises = layer.map(async (nodeId) => {
          const node = workflow.nodes.find((n) => n.id === nodeId);
          if (!node) return;

          if (!this.evaluateIncomingConditions(node, workflow, context)) {
            context.status.set(nodeId, "skipped");
            nodeResults.set(nodeId, {
              nodeId,
              status: "skipped",
              output: null,
              startedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              duration: 0,
            });
            hasSkipped = true;
            return;
          }

          const inputs = this.gatherInputs(node, workflow, context);
          const result = await this.executeNodeWithRetry(
            node,
            inputs,
            context,
            workflow.settings
          );

          nodeResults.set(nodeId, result);

          if (result.status === "error") {
            hasFailed = true;
          }
          if (result.status === "skipped") {
            hasSkipped = true;
          }
        });

        await Promise.all(layerPromises);
      }
    } catch (err) {
      workflowError =
        err instanceof Error ? err.message : "Unknown workflow error";
    }

    const completedAt = new Date().toISOString();
    let status: ExecutionResult["status"] = "completed";
    if (workflowError || hasFailed) {
      status = hasSkipped || hasFailed ? "partial" : "failed";
      if (
        workflowError ||
        (hasFailed && workflow.settings.errorHandling === "stop")
      ) {
        status = "failed";
      }
    }

    const result: ExecutionResult = {
      workflowId: workflow.id,
      status,
      startedAt,
      completedAt,
      nodeResults,
      error: workflowError,
    };

    this.emit("workflow_complete", result);
    return result;
  }

  private async executeNodeWithRetry(
    node: WorkflowNode,
    inputs: Record<string, unknown>,
    context: ExecutionContext,
    settings: WorkflowDefinition["settings"]
  ): Promise<NodeResult> {
    const maxAttempts =
      settings.errorHandling === "retry" ? settings.maxRetries + 1 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await this.executeNode(node, inputs, context, settings);
      if (result.status === "success" || attempt === maxAttempts) {
        if (
          result.status === "error" &&
          settings.errorHandling === "skip"
        ) {
          return { ...result, status: "skipped" };
        }
        return result;
      }
    }

    return {
      nodeId: node.id,
      status: "error",
      output: null,
      error: "Exhausted all retry attempts",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      duration: 0,
    };
  }

  private async executeNode(
    node: WorkflowNode,
    inputs: Record<string, unknown>,
    context: ExecutionContext,
    settings: WorkflowDefinition["settings"]
  ): Promise<NodeResult> {
    const nodeStartedAt = new Date().toISOString();
    const startTime = Date.now();

    context.status.set(node.id, "running");
    this.emit("node_start", { nodeId: node.id, type: node.type });

    try {
      const output = await executeNodeByType(
        node.type,
        node.config,
        inputs,
        context,
        settings.timeout
      );

      const completedAt = new Date().toISOString();
      const duration = Date.now() - startTime;

      context.nodeOutputs.set(node.id, output);
      context.status.set(node.id, "success");

      const result: NodeResult = {
        nodeId: node.id,
        status: "success",
        output,
        startedAt: nodeStartedAt,
        completedAt,
        duration,
      };

      this.emit("node_complete", result);
      return result;
    } catch (err) {
      const completedAt = new Date().toISOString();
      const duration = Date.now() - startTime;
      const errorMessage =
        err instanceof Error ? err.message : "Unknown node error";

      context.errors.set(node.id, errorMessage);
      context.status.set(node.id, "error");

      const result: NodeResult = {
        nodeId: node.id,
        status: "error",
        output: null,
        error: errorMessage,
        startedAt: nodeStartedAt,
        completedAt,
        duration,
      };

      this.emit("node_error", result);
      return result;
    }
  }

  private gatherInputs(
    node: WorkflowNode,
    workflow: WorkflowDefinition,
    context: ExecutionContext
  ): Record<string, unknown> {
    const inputs: Record<string, unknown> = {};
    const incomingEdges = workflow.edges.filter((e) => e.target === node.id);

    for (const edge of incomingEdges) {
      const key = edge.sourceHandle || edge.source;
      inputs[key] = context.nodeOutputs.get(edge.source);
    }

    inputs._variables = context.variables;
    return inputs;
  }

  private evaluateIncomingConditions(
    node: WorkflowNode,
    workflow: WorkflowDefinition,
    context: ExecutionContext
  ): boolean {
    const incomingEdges = workflow.edges.filter((e) => e.target === node.id);

    if (incomingEdges.length === 0) return true;

    for (const edge of incomingEdges) {
      if (!edge.condition) continue;

      const sourceOutput = context.nodeOutputs.get(edge.source);
      try {
        const conditionFn = new Function(
          "output",
          "variables",
          `return (${edge.condition})`
        );
        if (!conditionFn(sourceOutput, context.variables)) {
          return false;
        }
      } catch {
        return false;
      }
    }

    return true;
  }

  topologicalSort(workflow: WorkflowDefinition): string[] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const node of workflow.nodes) {
      inDegree.set(node.id, 0);
      adjacency.set(node.id, []);
    }

    for (const edge of workflow.edges) {
      adjacency.get(edge.source)!.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }

    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) queue.push(nodeId);
    }

    const sorted: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);

      for (const neighbor of adjacency.get(current) || []) {
        const newDegree = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    if (sorted.length !== workflow.nodes.length) {
      throw new Error("Workflow contains a cycle and cannot be executed");
    }

    return sorted;
  }

  // Groups nodes into parallel execution layers based on dependency depth
  private buildExecutionLayers(
    sorted: string[],
    workflow: WorkflowDefinition
  ): string[][] {
    const depth = new Map<string, number>();

    for (const nodeId of sorted) {
      const incomingEdges = workflow.edges.filter((e) => e.target === nodeId);
      if (incomingEdges.length === 0) {
        depth.set(nodeId, 0);
      } else {
        let maxParentDepth = 0;
        for (const edge of incomingEdges) {
          const parentDepth = depth.get(edge.source) || 0;
          maxParentDepth = Math.max(maxParentDepth, parentDepth);
        }
        depth.set(nodeId, maxParentDepth + 1);
      }
    }

    const layerMap = new Map<number, string[]>();
    for (const [nodeId, d] of depth) {
      if (!layerMap.has(d)) layerMap.set(d, []);
      layerMap.get(d)!.push(nodeId);
    }

    const maxDepth = Math.max(...Array.from(layerMap.keys()), -1);
    const layers: string[][] = [];
    for (let i = 0; i <= maxDepth; i++) {
      layers.push(layerMap.get(i) || []);
    }

    return layers;
  }
}
