import { useState } from "react";
import { Plus, Trash2, GitBranch, Play } from "lucide-react";
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
import { formatDate } from "@/lib/utils";

export default function Workflows() {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: workflows, refetch } = trpc.workflows.list.useQuery();
  const createMutation = trpc.workflows.create.useMutation({
    onSuccess: () => {
      setName("");
      setDescription("");
      setShowForm(false);
      refetch();
    },
  });
  const deleteMutation = trpc.workflows.delete.useMutation({
    onSuccess: () => refetch(),
  });

  const handleCreate = () => {
    if (!name.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      description: description.trim(),
      steps: [
        {
          id: "step-1",
          type: "llm",
          config: { model: "gpt-4o-mini", prompt: "Process input" },
        },
      ],
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Workflows</h2>
          <p className="text-muted-foreground">
            Design and manage automated AI pipelines
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          New Workflow
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Workflow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Workflow name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Textarea
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                Create
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {workflows?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <GitBranch className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                No workflows created yet. Design your first AI pipeline.
              </p>
            </CardContent>
          </Card>
        ) : (
          workflows?.map((wf) => (
            <Card key={wf.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{wf.name}</CardTitle>
                  <CardDescription>
                    {wf.description || "No description"} |{" "}
                    {(wf.steps as unknown[]).length} steps |{" "}
                    {formatDate(wf.createdAt)}
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  <Badge>{wf.isActive ? "Active" : "Inactive"}</Badge>
                  <Button variant="ghost" size="icon">
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate({ id: wf.id })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
