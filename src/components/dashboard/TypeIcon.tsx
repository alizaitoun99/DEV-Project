import { Code, File, ImageIcon, LinkIcon, Sparkles, StickyNote, Terminal } from "lucide-react";

export const TYPE_STYLES = {
  snippet: { icon: Code, color: "text-blue-500", border: "border-l-blue-500" },
  prompt: { icon: Sparkles, color: "text-violet-500", border: "border-l-violet-500" },
  command: { icon: Terminal, color: "text-orange-500", border: "border-l-orange-500" },
  note: { icon: StickyNote, color: "text-yellow-300", border: "border-l-yellow-300" },
  file: { icon: File, color: "text-gray-500", border: "border-l-gray-500" },
  image: { icon: ImageIcon, color: "text-pink-500", border: "border-l-pink-500" },
  link: { icon: LinkIcon, color: "text-emerald-500", border: "border-l-emerald-500" },
};

export function getTypeStyle(typeId: string) {
  return TYPE_STYLES[typeId as keyof typeof TYPE_STYLES] ?? TYPE_STYLES.file;
}

interface TypeIconProps {
  typeId: string;
  label: string;
}

export function TypeIcon({ typeId, label }: TypeIconProps) {
  const { icon: Icon, color } = getTypeStyle(typeId);
  return <span role="img" aria-label={label} className={`inline-flex shrink-0 ${color}`}><Icon aria-hidden="true" className="size-5" /></span>;
}
