import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/auth";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import AppLayout from "@/pages/AppLayout";
import Dashboard from "@/pages/Dashboard";
import AssetsList from "@/pages/AssetsList";
import AssetDetail from "@/pages/AssetDetail";
import LLMConfigs from "@/pages/LLMConfigs";
import WorkspacesList from "@/pages/WorkspacesList";
import WorkspaceDetail from "@/pages/WorkspaceDetail";
import Templates from "@/pages/Templates";
import "@/App.css";

function Protected({ children }) {
  const { user, ready } = useAuth();
  if (!ready) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <span className="font-mono text-muted-foreground text-sm">[ loading ]</span>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Public({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/login" element={<Public><Login /></Public>} />
        <Route path="/register" element={<Public><Register /></Public>} />
        <Route
          path="/"
          element={<Protected><AppLayout /></Protected>}
        >
          <Route index element={<Dashboard />} />
          <Route path="assets" element={<AssetsList />} />
          <Route path="assets/templates" element={<Templates />} />
          <Route path="assets/:id" element={<AssetDetail />} />
          <Route path="llm" element={<LLMConfigs />} />
          <Route path="workspaces" element={<WorkspacesList />} />
          <Route path="workspaces/:id" element={<WorkspaceDetail />} />
        </Route>
      </Routes>
    </div>
  );
}
