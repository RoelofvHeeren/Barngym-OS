"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { navGroups } from "../navigation";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="glass-panel hidden w-[280px] flex-col justify-between lg:flex">
      <div>
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <Image
              src="/barn-gym-logo.png"
              alt="Barn Gym logo"
              width={80}
              height={80}
              priority
              className="rounded-3xl border border-emerald-900/20 bg-white/80 p-2 object-contain"
            />
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted">Barn Gym</p>
              <h1 className="text-2xl font-semibold text-primary">OS Control Hub</h1>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted">
            Premium internal OS for finance + people ops.
          </p>
        </div>

        {navGroups.map((group) => (
          <div key={group.label} className="mb-8">
            <p className="mb-3 text-xs uppercase tracking-[0.35em] text-muted">
              {group.label}
            </p>
            <nav className="flex flex-col gap-2">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-sm font-medium transition ${isActive
                        ? "border-emerald-800/30 bg-emerald-50 text-primary"
                        : "border-emerald-900/10 bg-transparent text-muted hover:border-emerald-900/30 hover:bg-emerald-50/70 hover:text-primary"
                      }`}
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-2xl ${isActive ? "bg-emerald-600/10 text-primary" : "bg-emerald-900/5 text-muted"}`}>
                      <Icon size={18} />
                    </span>
                    <span className="leading-tight">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>
    </aside>
  );
}

export default Sidebar;
