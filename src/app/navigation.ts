import {
  LayoutDashboard,
  Users,
  CreditCard,
  Boxes,
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
      { name: "Goals", href: "/dashboard/goals", icon: Target },
      { name: "People / CRM", href: "/people", icon: Users },
      { name: "Payments & Transactions", href: "/transactions", icon: CreditCard },
      { name: "Products & Services", href: "/products", icon: Boxes },
      { name: "Connections", href: "/connections", icon: Cable },
      { name: "Ads Dashboard", href: "/ads", icon: Megaphone },
      { name: "To Do", href: "/todo", icon: ClipboardList },
    ],
  },
  {
    label: "Phase 2",
    items: [
      { name: "Corporate Dashboard", href: "/corporate", icon: Building2 },
    ],
  },
] ;
