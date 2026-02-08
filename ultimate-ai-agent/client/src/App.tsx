import { Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import Chat from "./pages/Chat";
import Analytics from "./pages/Analytics";
import RAGManager from "./pages/RAGManager";
import CustomAgents from "./pages/CustomAgents";
import Memory from "./pages/Memory";
import Workflows from "./pages/Workflows";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import WorkflowBuilder from "./pages/WorkflowBuilder";
import WorkflowTemplates from "./pages/WorkflowTemplates";
import ExecutionHistory from "./pages/ExecutionHistory";
import AgentMarketplace from "./pages/AgentMarketplace";
import AgentCollaboration from "./pages/AgentCollaboration";
import AgentEvolution from "./pages/AgentEvolution";
import AIPlayground from "./pages/AIPlayground";
import PromptStudio from "./pages/PromptStudio";
import DocumentAnalyzer from "./pages/DocumentAnalyzer";
import ImageGenerator from "./pages/ImageGenerator";
import CodeGenerator from "./pages/CodeGenerator";
import BatchProcessor from "./pages/BatchProcessor";
import { useAuth } from "./contexts/AuthContext";

function App() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/chat/:conversationId" element={<Chat />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/rag" element={<RAGManager />} />
        <Route path="/agents" element={<CustomAgents />} />
        <Route path="/memory" element={<Memory />} />
        <Route path="/workflows" element={<Workflows />} />
        <Route path="/workflow-builder" element={<WorkflowBuilder />} />
        <Route path="/workflow-builder/:workflowId" element={<WorkflowBuilder />} />
        <Route path="/workflow-templates" element={<WorkflowTemplates />} />
        <Route path="/execution-history" element={<ExecutionHistory />} />
        <Route path="/agent-marketplace" element={<AgentMarketplace />} />
        <Route path="/agent-collaboration" element={<AgentCollaboration />} />
        <Route path="/agent-evolution" element={<AgentEvolution />} />
        <Route path="/ai-playground" element={<AIPlayground />} />
        <Route path="/prompt-studio" element={<PromptStudio />} />
        <Route path="/document-analyzer" element={<DocumentAnalyzer />} />
        <Route path="/image-generator" element={<ImageGenerator />} />
        <Route path="/code-generator" element={<CodeGenerator />} />
        <Route path="/batch-processor" element={<BatchProcessor />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="/login" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
