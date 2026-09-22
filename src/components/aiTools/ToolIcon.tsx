import {
  Bot,
  ChartNoAxesCombined,
  Clapperboard,
  Compass,
  Filter,
  Gift,
  Globe,
  LayoutTemplate,
  Mail,
  Megaphone,
  MessageCircle,
  PenLine,
  Radar,
  Route,
  Settings2,
  Sparkles,
  Workflow,
  CalendarDays,
  Brain,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Compass,
  Radar,
  LayoutTemplate,
  CalendarDays,
  Sparkles,
  Clapperboard,
  PenLine,
  Megaphone,
  ChartNoAxesCombined,
  Gift,
  MessageCircle,
  Bot,
  Workflow,
  Route,
  Filter,
  Globe,
  Mail,
  Settings2,
};

export function ToolIcon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  const Icon = ICONS[name] ?? Brain;
  return <Icon size={size} className={className} strokeWidth={1.75} />;
}
