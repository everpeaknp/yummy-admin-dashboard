# Graph Report - yummy-admin-dashboard  (2026-10-07)

## Corpus Check
- 67 files · ~197,181 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: (none) 1, .ico 1, .css 1)

## Summary
- 673 nodes · 1638 edges · 31 communities (21 shown, 10 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.87)
- Token cost: 4,735 input · 2,243 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30

## God Nodes (most connected - your core abstractions)
1. `backendRequest()` - 68 edges
2. `LegacySubscriptionsPage()` - 48 edges
3. `LegacyPlansPage()` - 45 edges
4. `PaymentsPage()` - 39 edges
5. `SubscriptionDesk()` - 39 edges
6. `backendFetch()` - 36 edges
7. `RestaurantSubscriptionCard()` - 31 edges
8. `getStoredAuthSession()` - 31 edges
9. `react` - 30 edges
10. `SettingsPage()` - 23 edges

## Surprising Connections (you probably didn't know these)
- `Yummy Logo` --references--> `Yummy Admin Dashboard`  [INFERRED]
  public/yummy_logo.png → README.md
- `DashboardBannersPage()` --calls--> `canManageRestaurants()`  [EXTRACTED]
  app/dashboard/banners/page.tsx → lib/auth.ts
- `DashboardBannersPage()` --calls--> `getStoredAuthSession()`  [EXTRACTED]
  app/dashboard/banners/page.tsx → lib/auth.ts
- `HelpCenterAdminPage()` --calls--> `canManageRestaurants()`  [EXTRACTED]
  app/dashboard/help-center/page.tsx → lib/auth.ts
- `HelpCenterAdminPage()` --calls--> `getStoredAuthSession()`  [EXTRACTED]
  app/dashboard/help-center/page.tsx → lib/auth.ts

## Import Cycles
- None detected.

## Communities (31 total, 10 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (63): PlansPage(), SubscriptionsPage(), ASSIGNMENT_TERMS, AssignmentHistory(), currentVersion(), daysRemaining(), FeatureOverrides(), formatDate() (+55 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (50): HotelsPage(), loadHotels(), MetricCard(), OverviewPage(), loadDashboard(), palette, PencilIcon(), titleCase() (+42 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (54): DashboardLayout(), getAuthServerSnapshot(), getAuthSnapshot(), subscribeToAuthChanges(), accessToken(), emptyForm, Field(), SmsCreditsPage() (+46 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (50): accessToken(), accountLabel(), Alert(), dateInput(), Denied(), displayDate(), effectiveSubscriptionStatus(), errorMessage() (+42 more)

### Community 4 - "Community 4"
Cohesion: 0.04
Nodes (45): eslintConfig, dependencies, lucide-react, next, react, react-dom, recharts, devDependencies (+37 more)

### Community 5 - "Community 5"
Cohesion: 0.10
Nodes (42): Alert(), contractSubtotal(), Denied(), displayDate(), downloadCsv(), EMPTY_INVOICE_FORM, Field(), invoiceAccountLabel() (+34 more)

### Community 6 - "Community 6"
Cohesion: 0.05
Nodes (43): AdminDashboardV2Response, AttendanceEntitlementUpdatePayload, BackendClientOptions, BillingAccountRestaurantsReplacePayload, BillingAccountUpdatePayload, BillingAddonAssignmentsPayload, BillingAddonCreatePayload, BillingAddonUpdatePayload (+35 more)

### Community 7 - "Community 7"
Cohesion: 0.10
Nodes (39): AccessDenied(), ActionButton(), Alert(), CheckField(), dateTimeInput(), draftPrice(), emptyPlanForm, EntitlementField() (+31 more)

### Community 8 - "Community 8"
Cohesion: 0.10
Nodes (33): EMPTY_ADMIN_FORM, EMPTY_ROLE_FORM, EMPTY_USER_FORM, formatDate(), groupPermissions(), ROLE_FALLBACK, SettingsPage(), checkHealth() (+25 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (21): DELETE(), GET(), getBackendBaseUrl(), HOP_BY_HOP_HEADERS, PATCH(), POST(), proxyRequest(), PUT() (+13 more)

### Community 10 - "Community 10"
Cohesion: 0.10
Nodes (31): dateInput(), dateTimeInput(), emptyCbms, emptyForm, fieldLabel(), FormState, inputClass(), RestaurantCompliancePage() (+23 more)

### Community 11 - "Community 11"
Cohesion: 0.13
Nodes (26): BillingAddonCatalog(), Button(), dateInput(), Entitlement(), Field(), iso(), MiniField(), Props (+18 more)

### Community 12 - "Community 12"
Cohesion: 0.13
Nodes (24): blankGuide, blankVideo, ContentList(), ContentRow(), Editor(), HelpCenterAdminPage(), Input(), Loading() (+16 more)

### Community 13 - "Community 13"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 14 - "Community 14"
Cohesion: 0.19
Nodes (16): ActionDraft, actionDraftFor(), actionValidation(), BannerActionType, DashboardBannersPage(), emptyDraft, errorMessage(), imageInputLabel() (+8 more)

### Community 15 - "Community 15"
Cohesion: 0.26
Nodes (12): getGoogleMapsUrl(), getInitials(), getSetupSummary(), LeadInsightsPage(), fetchActivityPage(), fetchData(), getLead(), getLeadActivity() (+4 more)

### Community 16 - "Community 16"
Cohesion: 0.33
Nodes (9): LeadsPage(), addLeadRecipient(), getLeadRecipients(), getLeads(), LeadRead, LeadRecipientRead, markLeadsAsRead(), removeLeadRecipient() (+1 more)

### Community 17 - "Community 17"
Cohesion: 0.25
Nodes (8): backendFetch(), getAdminDashboardV2(), getBuiltInRoles(), getHelpCenter(), getPermissionsCatalog(), getRestaurantAdmins(), getRoles(), getUsers()

### Community 18 - "Community 18"
Cohesion: 0.25
Nodes (3): initialRestaurants, Restaurant, restaurantsStore

### Community 19 - "Community 19"
Cohesion: 0.40
Nodes (4): kpiData, payments, restaurants, revenueData

### Community 20 - "Community 20"
Cohesion: 0.67
Nodes (3): Bulk Menu Import, Menu Cache Invalidation, Import Validation and Preview

## Knowledge Gaps
- **170 isolated node(s):** `HOP_BY_HOP_HEADERS`, `RESPONSE_HEADERS_TO_STRIP`, `UploadDraft`, `BannerActionType`, `ActionDraft` (+165 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 186 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Community 1` to `Community 0`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 11`, `Community 12`, `Community 14`, `Community 15`, `Community 16`?**
  _High betweenness centrality (0.141) - this node is a cross-community bridge._
- **What connects `HOP_BY_HOP_HEADERS`, `RESPONSE_HEADERS_TO_STRIP`, `UploadDraft` to the rest of the system?**
  _170 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06826923076923076 - nodes in this community are weakly interconnected._
- **Why does `next` connect `Community 9` to `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 10`, `Community 15`, `Community 16`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.062003968253968256 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `Community 1` to `Community 0`, `Community 2`, `Community 4`, `Community 9`, `Community 12`, `Community 14`, `Community 15`, `Community 16`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08907103825136611 - nodes in this community are weakly interconnected._