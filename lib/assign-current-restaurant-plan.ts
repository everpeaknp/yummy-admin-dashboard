import {
  assignRestaurantPlanDirectly,
  getPublicBillingCatalog,
} from "./backend-api";

export async function assignCurrentRestaurantPlan(
  restaurantId: number,
  planId: number,
  durationMonths: number,
  options: Parameters<typeof getPublicBillingCatalog>[0],
) {
  const catalog = await getPublicBillingCatalog(options);
  const plan = catalog.data?.plans?.find((item) => item.id === planId);
  const version = plan?.current_version;
  if (!version || version.status !== "published" || (version.effective_from && new Date(version.effective_from).getTime() > Date.now())) {
    throw new Error(`${plan?.name || "This plan"} has no current published version. Refresh the plan catalog.`);
  }
  const assignment = await assignRestaurantPlanDirectly(
    restaurantId,
    { plan_version_id: version.id, duration_months: durationMonths },
    options,
  );
  if (assignment.data?.plan_version_id !== version.id) {
    throw new Error("The backend assigned a different plan version. Check the current access and billing audit log before trying again.");
  }
  return version;
}
