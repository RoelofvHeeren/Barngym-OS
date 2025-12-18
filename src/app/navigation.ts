import {
  LayoutDashboard,
  Users,
  CreditCard,
  Cable,
  Building2,
  Target,
  Megaphone,
  ClipboardList,
  Bot,
  Video, // Added Video icon
} from "lucide-react";

export const navGroups = [
  {
    label: "Command",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard },
      { name: "Content Studio", href: "/content", icon: Video }, // Added Content Studio link
      { name: "People / CRM", href: "/people", icon: Users },
      { name: "Ads Dashboard", href: "/ads", icon: Megaphone },
      { name: "Corporate Dashboard", href: "/corporate", icon: Building2 },
      { name: "Goals", href: "/dashboard/goals", icon: Target },
      { name: "Barn Assistant", href: "/dashboard/assistant", icon: Bot },
      { name: "To Do", href: "/todo", icon: ClipboardList },
      { name: "Payments & Transactions", href: "/transactions", icon: CreditCard },
      { name: "Connections", href: "/connections", icon: Cable },
    ],
  },
];
