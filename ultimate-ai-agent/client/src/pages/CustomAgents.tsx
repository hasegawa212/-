import { useState } from "react";
import { Plus, Trash2, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

export default function CustomAgents() {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [temperature, setTemperature] = useState(0.7);

  const { data: agents, refetch } = trpc.agents.list.useQuery();
  const createMutation = trpc.agents.create.useMutation({
    onSuccess: () => {
      resetForm();
      refetch();
    },
  });
  const deleteMutation = trpc.agents.delete.useMutation({
    onSuccess: () => refetch(),
  });

  const resetForm = () => {
    setName("");
    setDescription("");
    setSystemPrompt("");
    setModel("gpt-4o-mini");
    setTemperature(0.7);
    setShowForm(false);
  };

  const handleCreate = () => {
    if (!name.trim() || !systemPrompt.trim()) return;
    createMutation.mutate({
      id: name.toLowerCase().replace(/\s+/g, "-"),
      name: name.trim(),
      description: description.trim(),
      systemPrompt: systemPrompt.trim(),
      model,
      temperature,
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Custom Agents</h2>
          <p className="text-muted-foreground">
            Create and manage specialized AI agents
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          New Agent
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Agent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Agent name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Textarea
              placeholder="System prompt - define the agent's behavior and personality"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={4}
            />
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block">Model</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-background border rounded-md px-3 py-2 text-sm"
                >
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block">
                  Temperature: {temperature}
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                Create Agent
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {agents?.map((agent) => (
          <Card key={agent.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{agent.name}</CardTitle>
                  <CardDescription className="mt-1">
                    {agent.description}
                  </CardDescription>
                </div>
              </div>
              {!["general-assistant", "code-assistant", "creative-writer", "data-analyst"].includes(agent.id) && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate({ id: agent.id })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary">{agent.model}</Badge>
                <Badge variant="outline">temp: {agent.temperature}</Badge>
                {agent.isActive ? (
                  <Badge>Active</Badge>
                ) : (
                  <Badge variant="destructive">Inactive</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
