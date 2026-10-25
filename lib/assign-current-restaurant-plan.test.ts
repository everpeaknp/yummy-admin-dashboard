import { beforeEach, describe, expect, it, vi } from "vitest";
import { assignRestaurantPlanDirectly, getPublicBillingCatalog } from "./backend-api";
import { assignCurrentRestaurantPlan } from "./assign-current-restaurant-plan";

vi.mock("./backend-api", () => ({
  assignRestaurantPlanDirectly: vi.fn(),
  getPublicBillingCatalog: vi.fn(),
}));

describe("assignCurrentRestaurantPlan", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getPublicBillingCatalog).mockResolvedValue({
      data: { plans: [{ id: 4, name: "Premium", current_version: { id: 12, version_number: 3, status: "published" } }] },
    } as never);
  });

  it("submits the current published version and confirms the assignment", async () => {
    vi.mocked(assignRestaurantPlanDirectly).mockResolvedValue({ data: { plan_version_id: 12 } } as never);

    const version = await assignCurrentRestaurantPlan(119, 4, 12, { token: "test" });

    expect(version.id).toBe(12);
    expect(assignRestaurantPlanDirectly).toHaveBeenCalledWith(119, { plan_version_id: 12, duration_months: 12 }, { token: "test" });
  });

  it("reports a backend version mismatch instead of claiming success", async () => {
    vi.mocked(assignRestaurantPlanDirectly).mockResolvedValue({ data: { plan_version_id: 4 } } as never);

    await expect(assignCurrentRestaurantPlan(119, 4, 12, {})).rejects.toThrow("backend assigned a different plan version");
  });
});
