import { useState } from "react";
import { Plus, Trash2, FileText, Upload } from "lucide-react";
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
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";

export default function RAGManager() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [source, setSource] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data: documents, refetch } = trpc.rag.list.useQuery();

  const uploadMutation = trpc.rag.upload.useMutation({
    onSuccess: () => {
      setTitle("");
      setContent("");
      setSource("");
      setShowForm(false);
      refetch();
    },
  });

  const deleteMutation = trpc.rag.delete.useMutation({
    onSuccess: () => refetch(),
  });

  const handleUpload = () => {
    if (!title.trim() || !content.trim()) return;
    uploadMutation.mutate({
      title: title.trim(),
      content: content.trim(),
      source: source.trim() || undefined,
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">RAG Manager</h2>
          <p className="text-muted-foreground">
            Manage documents for retrieval-augmented generation
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} gap-2>
          <Plus className="h-4 w-4" />
          Add Document
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Document</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Document title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Input
              placeholder="Source URL (optional)"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
            <Textarea
              placeholder="Paste document content here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
            />
            <div className="flex gap-2">
              <Button
                onClick={handleUpload}
                disabled={uploadMutation.isPending}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {documents?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                No documents uploaded yet. Add documents to enhance AI responses.
              </p>
            </CardContent>
          </Card>
        ) : (
          documents?.map((doc) => (
            <Card key={doc.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{doc.title}</CardTitle>
                  <CardDescription>
                    {doc.source && <span>{doc.source} | </span>}
                    {formatDate(doc.createdAt)}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate({ id: doc.id })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {doc.content}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
