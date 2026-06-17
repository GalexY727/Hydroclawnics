This task is for `@hydroclawnics/frontend/`.

Before implementing, read `guidance.md` and apply it as the general frontend design guidance. This file is the Hydroclawnics-specific product brief and should take priority when there is a product-specific requirement.

You are refactoring the Hydroclawnics Farm Overview dashboard, an AI-assisted hydroponics monitoring interface. This is an operational dashboard, not a landing page. It should feel quiet, technical, trustworthy, scan-friendly, and built for repeated use.

The current Farm Overview page is visually cluttered. Too many cards, borders, filters, metrics, and duplicated AI/incident panels compete for attention. Refactor the page so a user can understand the system state quickly, identify what needs attention, and drill into detail only when needed.

Primary outcome:
Create a cleaner, more polished Farm Overview dashboard with a stronger attention hierarchy, compact pod cards, a unified search/filter system, and a resizable Operations Feed.

Product hierarchy:
The page should answer these questions in order:

1. Is the farm okay?
2. What needs attention right now?
3. Which zones or pods are affected?
4. What is the AI currently doing?
5. What happened recently?

Core layout requirements:

* Use a two-pane dashboard layout.
* Left/main pane: farm summary, zone status, active incident summary, pod search, pod grid.
* Right pane: Operations Feed.
* Remove AI Sentinel from the main/left dashboard area.
* AI Sentinel should exist only inside the Operations Feed.
* Make the Operations Feed resizable by dragging its left edge.
* Support practical width ranges similar to 80/20, 70/30, and 60/40.
* Persist the user’s selected feed width in local storage if reasonable.
* Add min/max constraints so neither pane becomes unusable.
* On smaller screens, collapse the Operations Feed into a drawer, toggleable panel, or stacked section instead of forcing a cramped two-column layout.

Attention and visual hierarchy:

* Reduce excessive borders and nested cards.
* Do not put cards inside cards unless the existing architecture absolutely requires it.
* Healthy/stable information should feel calm and compact.
* Critical/warning/verifying information should be visually clear and easy to find.
* Use whitespace, typography, contrast, and status color intentionally.
* Keep the dark Hydroclawnics technical/sci-fi identity, but make it more refined and less noisy.
* Use consistent spacing, radii, badge styles, section headers, and card density.
* Avoid huge hero-style UI; this is a dense operational tool.
* Avoid decorative gradients, blobs, or purely aesthetic elements that do not improve scanning.

Farm summary:
Create a cleaner top summary for:

* farm health percentage
* operational status
* total pods
* stable pods
* active incidents
* mode
* connection status
* last sync

This section should be easy to scan and should not duplicate detailed incident or AI feed content.

Zone status:
Redesign zone status so it communicates meaning, not just progress bars.
Each zone should show:

* zone name
* pod count
* health/status
* short issue summary when unhealthy

Example structure:

* North Bay — Healthy — 12 pods
* East Rack — Critical — pH issue
* South Bench — Critical — pH issue
* Research Rail — Warning — humidity verifying

Active incident summary:
Keep a focused active incident card/banner in the main pane.
It should show:

* incident title
* affected pod
* crop
* zone
* reservoir
* status such as Critical, Warning, Verifying, or Resolved
* short evidence/action/verification summary when available

Include actions if they fit the current app structure:

* View Pod
* View Evidence
* Acknowledge

Do not repeat the full Operations Feed inside this card.

Pod grid:
Redesign pod cards into compact overview cards.
Default pod ordering should prioritize:

1. critical pods
2. warning/verifying pods
3. recently changed pods
4. healthy pods

Healthy pod cards should be compact and visually quiet.
Critical/warning pod cards should show only the readings relevant to the issue, plus maybe one secondary metric.

Avoid showing every metric on every card by default. Do not show pH, EC, air temp, humidity, full ranges, bars, reservoir action text, and status blocks all at once for every pod.

Suggested compact card content:

* pod id
* crop
* zone
* status badge
* primary issue or Healthy
* 1–2 key metrics

Example critical card:
pod_014
Tomato · East Rack
Critical: pH low
pH 5.33 ↓ · EC 2462 ppm ↑

Example healthy card:
pod_01
Tomato · North Bay
Healthy
pH 6.23 · EC 976 ppm

Add click behavior for a pod detail drawer or modal where the full telemetry can live:

* all metrics
* target ranges
* recent readings
* reservoir
* AI actions
* incident history
* charts if already available or easy to preserve

Unified search/filter:
Replace the large multi-dropdown filter row with a compact smart search bar.
The search bar should support both fuzzy search and structured filter syntax.

The search should match:

* pod id
* crop
* zone
* reservoir
* status
* issue type
* metric names

Suggested placeholder:
Search pods, crops, zones… try `status:critical zone:"East Rack" crop:tomato`

Supported structured keys:

* status:critical
* status:warning
* status:healthy
* status:verifying
* zone:"East Rack"
* crop:tomato
* reservoir:R-02
* metric:ph
* issue:humidity
* sort:severity
* sort:recent

Default empty search should show critical and warning pods first.
Show the visible pod count near the search bar.
Add a small syntax help affordance, such as a tooltip or popover, but do not let it dominate the UI.

Operations Feed:
The Operations Feed should be the exclusive place for AI Sentinel.
Redesign it as a focused activity/audit panel.

Suggested sections:

* Now

  * AI Sentinel current scan
  * current verification/action
  * next check timer
* Active Incidents

  * compact incident cards
* Recent Events

  * chronological activity log
* Recent Resolved

  * compact resolved incident entries

Use event language that is easy to scan:

* 9:07 PM — Humidity recovered to 58%
* 9:04 PM — Started humidifier for Research Rail
* 9:02 PM — Humidity below target on pod_12

Avoid excessive nested cards, tiny labels, and repeated progress bars.
Detailed evidence/action/verification should appear when an incident is expanded, not always visible.

Implementation expectations:

* First inspect the existing project structure and identify the Farm Overview page/components.
* Reuse existing data structures where possible.
* Preserve existing routes/navigation tabs unless a change is necessary for the refactor.
* Keep existing simulated/demo data working.
* Avoid overengineering, but refactor into reusable components where it improves clarity.

Likely useful components:

* ResizableDashboardLayout
* FarmSummary
* ZoneStatusGrid
* ActiveIncidentSummary
* SmartPodSearch
* PodGrid
* PodCardCompact
* PodDetailDrawer
* OperationsFeed
* AISentinelFeedItem

Quality bar:

* The page should feel noticeably less cluttered.
* The eye should go first to farm health, active issues, and priority pods.
* Healthy pods should no longer compete visually with critical pods.
* The Operations Feed should feel useful but not overwhelming.
* The resizable feed should feel smooth and intentional.
* Text should not overflow or overlap at common desktop and mobile sizes.
* Controls should feel complete, not decorative.
* Keep the existing Hydroclawnics identity, but make it more polished and restrained.

Acceptance criteria:

* AI Sentinel is removed from the main dashboard area.
* AI Sentinel appears inside Operations Feed only.
* Operations Feed can be resized by dragging its left edge.
* Feed width persists across reloads if feasible.
* Layout remains usable at desktop and smaller viewport widths.
* Old filter row is removed or minimized in favor of a compact smart search bar.
* Search supports fuzzy matching and structured filter syntax.
* Empty search prioritizes critical/warning pods first.
* Pod cards are compact and less cluttered.
* Pod detail drawer/modal exposes full telemetry when a pod is selected.
* Critical/warning/active incident information is easy to find.
* The final UI feels like a polished operational dashboard, not a collection of equally loud cards.

After implementation:

* Run the app locally if the project supports it.
* Check the result in at least one desktop viewport and one narrower viewport.
* Fix obvious layout overflow, text clipping, or broken interactions.
* Summarize what changed, files modified, and any follow-up improvements.
