export type RetailerRole = "owner" | "buyer" | "store_manager" | "employee" | "accounting";

export interface NavItem {
  name: string;
  href: string;
  icon: string;
  roles: RetailerRole[];
  badge?: string;
  isBottomNav?: boolean;
}

export const RETAILER_NAV_ITEMS: NavItem[] = [
  {
    name: "Home",
    href: "/",
    icon: "home",
    roles: ["owner", "buyer", "store_manager", "employee", "accounting"],
    isBottomNav: true,
  },
  {
    name: "Products",
    href: "/products",
    icon: "package",
    roles: ["owner", "buyer", "store_manager", "employee", "accounting"],
    isBottomNav: true,
  },
  {
    name: "Weekly Check",
    href: "/check",
    icon: "clipboard-check",
    roles: ["owner", "store_manager", "employee"],
    badge: "Active",
    isBottomNav: true,
  },
  {
    name: "Orders",
    href: "/orders",
    icon: "shopping-cart",
    roles: ["owner", "buyer", "store_manager", "accounting"],
    isBottomNav: true,
  },
  {
    name: "Sales & Reorder",
    href: "/sales",
    icon: "trending-up",
    roles: ["owner", "buyer", "accounting"],
    isBottomNav: false,
  },
  {
    name: "Stores",
    href: "/stores",
    icon: "store",
    roles: ["owner", "buyer", "store_manager"],
    isBottomNav: false,
  },
  {
    name: "Training",
    href: "/training",
    icon: "graduation-cap",
    roles: ["owner", "buyer", "store_manager", "employee", "accounting"],
    isBottomNav: false,
  },
  {
    name: "Account",
    href: "/account",
    icon: "user",
    roles: ["owner", "buyer", "store_manager", "employee", "accounting"],
    isBottomNav: false,
  },
];

export function getNavItemsForRole(role: string = "owner"): NavItem[] {
  const normalizedRole = (role.toLowerCase().replace(/ /g, "_") as RetailerRole) || "owner";
  return RETAILER_NAV_ITEMS.filter((item) =>
    item.roles.includes(normalizedRole) || normalizedRole === "owner"
  );
}

export function getBottomNavItems(role: string = "owner"): NavItem[] {
  const items = getNavItemsForRole(role).filter((item) => item.isBottomNav);
  return items.slice(0, 4);
}
