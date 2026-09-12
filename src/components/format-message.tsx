type MarkdownMessageProps = {
  content: string;
  className?: string;
};

function toWhatsAppText(content: string) {
  return content
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[a-z]*\n?/gi, "").replace(/```/g, "").trim())
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\*\*([^*]+)\*\*/g, "*$1*")
    .replace(/__([^_]+)__/g, "_$1_")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderWhatsAppText(content: string) {
  return toWhatsAppText(content).split(/(\*[^*\n]+\*|_[^_\n]+_)/g).map((part, index) => {
    if (part.startsWith("*") && part.endsWith("*")) {
      return <strong key={index}>{part.slice(1, -1)}</strong>;
    }
    if (part.startsWith("_") && part.endsWith("_")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <span key={index}>{part}</span>;
  });
}

export function MarkdownMessage({ content, className }: MarkdownMessageProps) {
  return (
    <div className={`whitespace-pre-wrap break-words ${className || ""}`}>
      {renderWhatsAppText(content)}
    </div>
  );
}
