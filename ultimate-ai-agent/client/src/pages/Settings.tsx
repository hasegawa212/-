import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

export default function Settings() {
  const [apiKey, setApiKey] = useState("");
  const [defaultModel, setDefaultModel] = useState("gpt-4o-mini");
  const [saved, setSaved] = useState(false);

  const { data: health } = trpc.health.useQuery();

  const handleSave = () => {
    // Settings would typically be saved to the server
    localStorage.setItem("settings.defaultModel", defaultModel);
    if (apiKey) {
      localStorage.setItem("settings.apiKeySet", "true");
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-muted-foreground">
          Configure your AI agent platform
        </p>
      </div>

      {/* API Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>API Configuration</CardTitle>
          <CardDescription>
            Configure your OpenAI API key and default model
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">
              OpenAI API Key
            </label>
            <Input
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Set via OPENAI_API_KEY environment variable on the server for production use.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">
              Default Model
            </label>
            <select
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              className="w-full bg-background border rounded-md px-3 py-2 text-sm"
            >
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            </select>
          </div>

          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            {saved ? "Saved!" : "Save Settings"}
          </Button>
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>Current system health and status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">API Server</span>
              <span
                className={`text-sm font-medium ${
                  health?.status === "ok"
                    ? "text-green-500"
                    : "text-red-500"
                }`}
              >
                {health?.status === "ok" ? "Connected" : "Disconnected"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Server Time</span>
              <span className="text-sm text-muted-foreground">
                {health?.timestamp || "N/A"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Database</span>
              <span className="text-sm font-medium text-green-500">
                SQLite (Local)
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Ultimate AI Agent Platform v1.0.0
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Built with React, Express, tRPC, Drizzle ORM, and OpenAI.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
