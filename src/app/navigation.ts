import {
  LayoutDashboard,
  Users,
  CreditCard,
  Cable,
  Building2,
  Target,
  Megaphone,
  ClipboardList,
} from "lucide-react";

export const navGroups = [
  {
    label: "Command",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard },
      { name: "People / CRM", href: "/people", icon: Users },
      { name: "Ads Dashboard", href: "/ads", icon: Megaphone },
      { name: "Corporate Dashboard", href: "/corporate", icon: Building2 },
      { name: "To Do", href: "/todo", icon: ClipboardList },
      { name: "Payments & Transactions", href: "/transactions", icon: CreditCard },
      { name: "Connections", href: "/connections", icon: Cable },
    ],
  },
];
