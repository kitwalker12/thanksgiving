export const CATEGORIES = [
  { id: "main", label: "Mains" },
  { id: "side", label: "Sides" },
  { id: "dessert", label: "Desserts" },
  { id: "drink", label: "Drinks" },
  { id: "supplies", label: "Supplies" },
  { id: "other", label: "Other" },
] as const;

export type Category = (typeof CATEGORIES)[number]["id"];

export type Claim = {
  id: string;
  guestName: string;
  quantity: number;
  note: string;
};

export type Item = {
  id: string;
  name: string;
  category: Category;
  details: string;
  needed: number;
  source: "host" | "guest";
  claims: Claim[];
};

export type PotluckEvent = {
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  timeZone: string;
  placeName: string;
  placeAddress: string;
  notes: string;
};

export type Potluck = {
  event: PotluckEvent;
  items: Item[];
};

export function takenCount(item: Item): number {
  return item.claims.reduce((sum, claim) => sum + claim.quantity, 0);
}

export function spotsLeft(item: Item): number {
  return Math.max(0, item.needed - takenCount(item));
}

export function categoryLabel(category: Category): string {
  return CATEGORIES.find((entry) => entry.id === category)?.label ?? "Other";
}

export function namesMatch(left: string, right: string): boolean {
  const a = left.replace(/\s+/g, " ").trim().toLocaleLowerCase();
  const b = right.replace(/\s+/g, " ").trim().toLocaleLowerCase();
  return a.length > 0 && a === b;
}
