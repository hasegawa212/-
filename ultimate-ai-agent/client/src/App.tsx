import { Routes, Route } from "react-router-dom";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import Chat from "./pages/Chat";
import Analytics from "./pages/Analytics";
import RAGManager from "./pages/RAGManager";
import CustomAgents from "./pages/CustomAgents";
import Memory from "./pages/Memory";
import Workflows from "./pages/Workflows";
import Settings from "./pages/Settings";

function App() {
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
    </Routes>
  );
}

export default App;
