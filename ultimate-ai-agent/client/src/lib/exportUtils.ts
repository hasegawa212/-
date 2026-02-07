interface MessageExport {
  id: number;
  role: string;
  content: string;
  createdAt: string;
}

export function exportAsJSON(messages: MessageExport[], filename?: string) {
  const data = {
    exportedAt: new Date().toISOString(),
    messageCount: messages.length,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.createdAt,
    })),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  downloadBlob(blob, filename || `chat-export-${Date.now()}.json`);
}

export function exportAsCSV(messages: MessageExport[], filename?: string) {
  const header = "Role,Content,Timestamp\n";
  const rows = messages
    .map((m) => {
      const content = m.content.replace(/"/g, '""').replace(/\n/g, " ");
      return `"${m.role}","${content}","${m.createdAt}"`;
    })
    .join("\n");

  const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, filename || `chat-export-${Date.now()}.csv`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
