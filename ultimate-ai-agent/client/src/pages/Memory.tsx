import { useState } from "react";
import { Plus, Trash2, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function Memory() {
  const [showForm, setShowForm] = useState(false);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [type, setType] = useState<"fact" | "preference" | "context">("fact");

  const { data: memories, refetch } = trpc.memory.list.useQuery();
  const storeMutation = trpc.memory.store.useMutation({
    onSuccess: () => {
      setKey("");
      setValue("");
      setShowForm(false);
      refetch();
    },
  });
  const deleteMutation = trpc.memory.delete.useMutation({
    onSuccess: () => refetch(),
  });

  const handleStore = () => {
    if (!key.trim() || !value.trim()) return;
    storeMutation.mutate({
      conversationId: null,
      key: key.trim(),
      value: value.trim(),
      type,
    });
  };

  const typeColors = {
    fact: "default",
    preference: "secondary",
    context: "outline",
  } as const;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Memory Manager</h2>
          <p className="text-muted-foreground">
            Manage AI conversation memory and knowledge
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Memory
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Store Memory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Key (e.g., user_name, preferred_language)"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
            <Input
              placeholder="Value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <select
              value={type}
              onChange={(e) =>
                setType(e.target.value as "fact" | "preference" | "context")
              }
              className="w-full bg-background border rounded-md px-3 py-2 text-sm"
            >
              <option value="fact">Fact</option>
              <option value="preference">Preference</option>
              <option value="context">Context</option>
            </select>
            <div className="flex gap-2">
              <Button onClick={handleStore} disabled={storeMutation.isPending}>
                Store
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {memories?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Brain className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                No memories stored yet. Add knowledge to enhance AI context.
              </p>
            </CardContent>
          </Card>
        ) : (
          memories?.map((memory) => (
            <Card key={memory.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{memory.key}</span>
                    <Badge variant={typeColors[memory.type as keyof typeof typeColors]}>
                      {memory.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{memory.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(memory.createdAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate({ id: memory.id })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
