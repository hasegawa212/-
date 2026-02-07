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
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="/login" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
