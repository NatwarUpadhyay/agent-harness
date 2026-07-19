import {
  LayoutDashboard, FolderKanban, Workflow, Bot, Brain, Database, BookOpen,
  Search, Boxes, FileText, Wrench, Plug, ShieldCheck, Activity, Beaker,
  Scale, FileStack, Rocket, FlaskConical, Settings, Cable, Library, Coins,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";


export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "Core",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/projects", label: "Projects", icon: FolderKanban },
      { to: "/library", label: "Library", icon: Library },
    ],

  },
  {
    label: "Agent system",
    items: [
      { to: "/harness", label: "Harness", icon: Workflow },
      { to: "/agents", label: "Agents", icon: Bot },
      { to: "/planner", label: "Planner", icon: Brain },
      { to: "/memory", label: "Memory", icon: Database },
      { to: "/context", label: "Context", icon: BookOpen },
      { to: "/retriever", label: "Retriever", icon: Search },
    ],
  },
  {
    label: "Configuration",
    items: [
      { to: "/models", label: "Models", icon: Boxes },
      { to: "/prompts", label: "Prompt library", icon: FileText },
      { to: "/tools", label: "Tools", icon: Wrench },
      { to: "/mcp", label: "MCP", icon: Plug },
      { to: "/integrations", label: "Integrations", icon: Cable },
    ],
  },
  {
    label: "Quality",
    items: [
      { to: "/evaluations", label: "Evaluations", icon: ShieldCheck },
      { to: "/observability", label: "Observability", icon: Activity },
      { to: "/experiments", label: "Experiments", icon: Beaker },
      { to: "/policies", label: "Policies", icon: Scale },
      { to: "/datasets", label: "Datasets", icon: FileStack },
      { to: "/usage", label: "Usage & Cost", icon: Coins },
    ],
  },
  {
    label: "Growth",
    items: [
      { to: "/deployments", label: "Deployments", icon: Rocket },
      { to: "/research", label: "Research", icon: FlaskConical },
    ],
  },
  {
    label: "System",
    items: [{ to: "/settings", label: "Settings", icon: Settings }],
  },
];

export const allNavItems = navGroups.flatMap((g) => g.items);
