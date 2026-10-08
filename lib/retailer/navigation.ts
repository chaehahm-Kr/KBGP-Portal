export type RetailerRole = "owner" | "buyer" | "store_manager" | "employee" | "accounting";

export interface NavSubItem {
  key: string;
  name: string;
  href: string;
  roles: RetailerRole[];
  badge?: string;
}

export interface NavItem {
  key: string;
  name: string;
  href: string;
  icon: string;
  roles: RetailerRole[];
  badge?: string;
  isBottomNav?: boolean;
  subItems?: NavSubItem[];
}

export const RETAILER_NAV_ITEMS: NavItem[] = [
  {
    key: "home",
    name: "Dashboard",
    href: "/",
    icon: "home",
    roles: ["owner", "buyer", "store_manager", "employee", "accounting"],
    isBottomNav: true,
  },
  {
    key: "products",
    name: "Products",
    href: "/products",
    icon: "package",
    roles: ["owner", "buyer", "store_manager", "employee", "accounting"],
    isBottomNav: true,
  },
  {
    key: "weeklyCheck",
    name: "Weekly Check",
    href: "/check",
    icon: "clipboard-check",
    roles: ["owner", "store_manager", "employee"],
    badge: "Active",
    isBottomNav: true,
  },
  {
    key: "orders",
    name: "Orders",
    href: "/orders",
    icon: "shopping-cart",
    roles: ["owner", "buyer", "store_manager", "accounting"],
    isBottomNav: true,
  },
  {
    key: "sales",
    name: "Sales & Reorder",
    href: "/sales",
    icon: "trending-up",
    roles: ["owner", "buyer", "accounting"],
    isBottomNav: false,
  },
  {
    key: "tags",
    name: "Price Tags",
    href: "/tags",
    icon: "tag",
    roles: ["owner", "buyer", "store_manager", "employee"],
    isBottomNav: false,
  },
  {
    key: "stores",
    name: "Stores",
    href: "/stores",
    icon: "store",
    roles: ["owner", "buyer", "store_manager"],
    isBottomNav: false,
  },
  {
    key: "training",
    name: "Training",
    href: "/training",
    icon: "graduation-cap",
    roles: ["owner", "buyer", "store_manager", "employee", "accounting"],
    isBottomNav: false,
  },
  {
    key: "helpSupport",
    name: "Help & Support",
    href: "/help",
    icon: "help-circle",
    roles: ["owner", "buyer", "store_manager", "employee", "accounting"],
    isBottomNav: false,
    subItems: [
      {
        key: "helpCenter",
        name: "Help Center",
        href: "/help",
        roles: ["owner", "buyer", "store_manager", "employee", "accounting"],
      },
      {
        key: "support",
        name: "Support",
        href: "/support",
        roles: ["owner", "buyer", "store_manager", "employee", "accounting"],
      },
    ],
  },
  {
    key: "account",
    name: "Account",
    href: "/account",
    icon: "user",
    roles: ["owner", "buyer", "store_manager", "employee", "accounting"],
    isBottomNav: false,
  },
];

export function getNavItemsForRole(role: string = "owner"): NavItem[] {
  const normalizedRole = (role.toLowerCase().replace(/ /g, "_") as RetailerRole) || "owner";
  return RETAILER_NAV_ITEMS
    .filter((item) => item.roles.includes(normalizedRole) || normalizedRole === "owner")
    .map((item) => {
      if (item.subItems) {
        return {
          ...item,
          subItems: item.subItems.filter(
            (sub) => sub.roles.includes(normalizedRole) || normalizedRole === "owner"
          ),
        };
      }
      return item;
    });
}

export function getBottomNavItems(role: string = "owner"): NavItem[] {
  const items = getNavItemsForRole(role).filter((item) => item.isBottomNav);
  return items.slice(0, 4);
}
