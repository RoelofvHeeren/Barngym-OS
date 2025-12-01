import {
  LayoutDashboard,
  Users,
  CreditCard,
  Boxes,
  Cable,
  Building2,
  Target,
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
    ],
  },
  {
    label: "Phase 2",
    items: [
      { name: "Corporate Dashboard", href: "/corporate", icon: Building2 },
    ],
  },
] ;
