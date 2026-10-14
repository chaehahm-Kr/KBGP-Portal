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
    key: "shopProducts",
    name: "Shop Products",
    href: "/products",
    icon: "shopping-bag",
    roles: ["owner", "buyer", "store_manager", "employee", "accounting"],
    isBottomNav: true,
    subItems: [
      {
        key: "allProducts",
        name: "All Products",
        href: "/products",
        roles: ["owner", "buyer", "store_manager", "employee", "accounting"],
      },
      {
        key: "savedProducts",
        name: "Saved Products",
        href: "/products/saved",
        roles: ["owner", "buyer", "store_manager", "employee", "accounting"],
      },
    ],
  },
  {
    key: "myProducts",
    name: "My Products",
    href: "/sales",
    icon: "package",
    roles: ["owner", "buyer", "store_manager", "employee", "accounting"],
    isBottomNav: false,
    subItems: [
      {
        key: "productPerformance",
        name: "Product Performance",
        href: "/sales",
        roles: ["owner", "buyer", "accounting"],
      },
      {
        key: "weeklyInventory",
        name: "Weekly Inventory",
        href: "/check",
        roles: ["owner", "store_manager", "employee"],
      },
      {
        key: "priceTags",
        name: "Price Tags",
        href: "/tags",
        roles: ["owner", "buyer", "store_manager", "employee"],
      },
    ],
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
    key: "bills",
    name: "Bills & Payments",
    href: "/bills",
    icon: "credit-card",
    roles: ["owner", "buyer", "store_manager", "accounting"],
    isBottomNav: false,
  },
  {
    key: "learningCenter",
    name: "Learning Center",
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
    key: "settings",
    name: "Settings",
    href: "/account",
    icon: "settings",
    roles: ["owner", "buyer", "store_manager", "employee", "accounting"],
    isBottomNav: false,
    subItems: [
      {
        key: "accountSettings",
        name: "Account Settings",
        href: "/account",
        roles: ["owner", "buyer", "store_manager", "employee", "accounting"],
      },
      {
        key: "companySettings",
        name: "Company & Store Settings",
        href: "/settings/company",
        roles: ["owner", "buyer", "store_manager", "employee", "accounting"],
      },
      {
        key: "teamSettings",
        name: "Team & Staff",
        href: "/settings/team",
        roles: ["owner", "buyer"],
      },
      {
        key: "shippingSettings",
        name: "Shipping Addresses",
        href: "/settings/shipping",
        roles: ["owner", "buyer", "store_manager", "accounting"],
      },
      {
        key: "paymentSettings",
        name: "Payment Methods",
        href: "/settings/payments",
        roles: ["owner", "buyer", "accounting"],
      },
    ],
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
