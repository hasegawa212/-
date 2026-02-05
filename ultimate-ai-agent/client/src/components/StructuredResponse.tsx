import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface StructuredResponseProps {
  content: string;
  className?: string;
}

export default function StructuredResponse({
  content,
  className,
}: StructuredResponseProps) {
  return (
    <div className={cn("prose prose-sm max-w-none dark:prose-invert", className)}>
      <ReactMarkdown
        components={{
          code({ className: codeClassName, children, ...props }) {
            const match = /language-(\w+)/.exec(codeClassName || "");
            const isInline = !match;

            if (isInline) {
              return (
                <code
                  className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <div className="relative group">
                <div className="absolute top-2 right-2 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {match[1]}
                </div>
                <pre className="bg-muted/50 border rounded-lg p-4 overflow-x-auto">
                  <code className={codeClassName} {...props}>
                    {children}
                  </code>
                </pre>
              </div>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className="border bg-muted px-3 py-2 text-left font-medium">
                {children}
              </th>
            );
          },
          td({ children }) {
            return <td className="border px-3 py-2">{children}</td>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
