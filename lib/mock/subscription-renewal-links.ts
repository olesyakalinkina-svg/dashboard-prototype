import type { Subscription, SubscriptionPriceCategory } from "@/types/dashboard";
import { isValidSoldSubscription } from "@/lib/subscription-campaign/compute";
import {
  ALL_SUBSCRIPTION_PRICE_CATEGORIES,
  getSubscriptionPriceCategory,
} from "@/lib/subscription-filter-options";
import {
  RENEWAL_BASE_SEASON,
  RENEWAL_NEXT_SEASON,
} from "@/lib/subscription-renewal";

/** Target share of 2024/25 unique owners who also buy 2025/26. */
const RENEWAL_RATE = 0.62;

function groupKey(sub: Pick<Subscription, "league" | "arena">): string {
  return `${sub.league}|${sub.arena}`;
}

function compareIds(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true });
}

function sortedUnique(ids: Iterable<string>): string[] {
  return [...new Set(ids)].sort(compareIds);
}

/**
 * Relinks 2025/26 `customerId`s onto 2024/25 owners so renewal KPIs and every
 * price-category bar are non-zero — without adding sold rows (KPI sold locks stay).
 *
 * Mapping is 1:1 onto 2024/25 IDs that are not already in 2025/26, so unique
 * customer counts per league × arena are preserved.
 *
 * Groups by league × arena so default KHL / main (and VHL / MHL) each get
 * renewed, not-renewed, and new clients.
 */
export function applySeasonRenewalCustomerLinks(
  subscriptions: Subscription[],
): Subscription[] {
  const previousByGroup = new Map<string, Subscription[]>();
  const nextByGroup = new Map<string, Subscription[]>();

  for (const sub of subscriptions) {
    if (!isValidSoldSubscription(sub)) continue;
    const key = groupKey(sub);
    if (sub.season === RENEWAL_BASE_SEASON) {
      const list = previousByGroup.get(key);
      if (list) list.push(sub);
      else previousByGroup.set(key, [sub]);
    } else if (sub.season === RENEWAL_NEXT_SEASON) {
      const list = nextByGroup.get(key);
      if (list) list.push(sub);
      else nextByGroup.set(key, [sub]);
    }
  }

  const remapsByGroup = new Map<string, Map<string, string>>();
  const keys = new Set([...previousByGroup.keys(), ...nextByGroup.keys()]);

  for (const key of keys) {
    const remap = buildGroupRemap(
      previousByGroup.get(key) ?? [],
      nextByGroup.get(key) ?? [],
    );
    if (remap.size > 0) remapsByGroup.set(key, remap);
  }

  if (remapsByGroup.size === 0) return subscriptions;

  for (const sub of subscriptions) {
    if (sub.season !== RENEWAL_NEXT_SEASON) continue;
    const mapped = remapsByGroup.get(groupKey(sub))?.get(sub.customerId);
    if (mapped) sub.customerId = mapped;
  }

  return subscriptions;
}

function buildGroupRemap(
  previous: readonly Subscription[],
  next: readonly Subscription[],
): Map<string, string> {
  const previousOwners = sortedUnique(previous.map((sub) => sub.customerId));
  const nextOwners = sortedUnique(next.map((sub) => sub.customerId));
  if (previousOwners.length === 0 || nextOwners.length === 0) {
    return new Map();
  }

  const previousByCategory = new Map<SubscriptionPriceCategory, string[]>();
  for (const category of ALL_SUBSCRIPTION_PRICE_CATEGORIES) {
    previousByCategory.set(category, []);
  }
  for (const sub of previous) {
    const category = getSubscriptionPriceCategory(sub);
    const list = previousByCategory.get(category);
    if (!list) continue;
    if (!list.includes(sub.customerId)) list.push(sub.customerId);
  }
  for (const owners of previousByCategory.values()) owners.sort(compareIds);

  const already = new Set<string>();
  const nextSet = new Set(nextOwners);
  for (const id of previousOwners) {
    if (nextSet.has(id)) already.add(id);
  }

  const usedPrevious = new Set(already);
  const usedNext = new Set(already);
  const remap = new Map<string, string>();

  for (const category of ALL_SUBSCRIPTION_PRICE_CATEGORIES) {
    const owners = previousByCategory.get(category) ?? [];
    if (owners.length === 0) continue;
    if (owners.some((id) => nextSet.has(id) || usedPrevious.has(id))) {
      continue;
    }
    const prevId = owners.find((id) => !usedPrevious.has(id));
    const nextId = nextOwners.find((id) => !usedNext.has(id));
    if (!prevId || !nextId) continue;
    remap.set(nextId, prevId);
    usedPrevious.add(prevId);
    usedNext.add(nextId);
  }

  const maxRenewed = Math.max(
    usedPrevious.size,
    Math.min(
      Math.floor(previousOwners.length * RENEWAL_RATE),
      previousOwners.length - 1,
      nextOwners.length - 1,
    ),
  );
  const remainingPrevious = previousOwners.filter((id) => !usedPrevious.has(id));
  const remainingNext = nextOwners.filter((id) => !usedNext.has(id));
  const need = Math.max(0, maxRenewed - usedPrevious.size);

  for (let index = 0; index < need; index += 1) {
    const prevId = remainingPrevious[index];
    const nextId = remainingNext[index];
    if (!prevId || !nextId) break;
    remap.set(nextId, prevId);
  }

  return remap;
}
