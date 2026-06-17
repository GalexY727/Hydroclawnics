This is a second-pass polish/refinement task for `@hydroclawnics/frontend/`.

The previous refactor improved the Hydroclawnics Farm Overview structure, but the UI is still too vertically spacious and uneven. Do not do a full redesign. Keep the current two-pane layout, resizable Operations Feed, smart search, compact pod concept, and existing dark Hydroclawnics identity. Focus on density, spacing, hierarchy, and scanability.

Primary goal:
Make the Farm Overview feel like a polished operational dashboard where the pod grid appears much earlier, priority pods are easier to scan, and no single summary/incident section consumes unnecessary vertical space.

Current issues to fix:

* The Farm Health summary block is much too tall.
* The top summary cards have inconsistent spacing and feel oversized.
* The Zone Status section is acceptable conceptually, but it takes more vertical space than necessary.
* The Active Incident section is too large for one incident.
* The blue “VERIFYING” badge/label in the incident section feels too prominent and visually distracting.
* The pod grid starts too far down the screen.
* Pod cards are oddly large relative to their small amount of information.
* There is too much empty vertical space inside pod cards.
* Spacing between sections is inconsistent.
* The search row is better than the old filters, but it can be tighter and less visually heavy.
* The Operations Feed is improved, but nested cards and spacing can still be tightened slightly.

Refinement requirements:

1. Compress the top dashboard summary

* Replace the large Farm Health panel with a shorter, denser summary strip.
* The farm health percentage should remain visible, but the container should not dominate the page.
* Prefer a single-row or two-row compact layout instead of a large block.
* Keep these values visible:

  * health percentage
  * operational status
  * total pods
  * stable pods
  * active incidents
  * mode
  * connection
  * last sync
* Reduce vertical padding and card height.
* The summary should feel like a dashboard status header, not a hero section.

Target feel:
A user should understand farm status quickly, then immediately move on to zones/incidents/pods.

2. Tighten Zone Status

* Keep zone status near the top, but make each zone tile shorter.
* Reduce internal padding.
* Keep zone name, pod count, status badge, and issue summary.
* Avoid large empty areas.
* Make all zone tiles equal height.
* Use consistent spacing between zone tiles.
* If necessary, use a more compact horizontal layout.

3. Convert Active Incident into a compact alert row

* The Active Incident area should be much shorter.
* It should read like a high-priority operational alert, not a large content card.
* Put the status badge inline near the title instead of giving it a large visual area.
* Make the “VERIFYING” badge smaller and less dominant.
* Preserve:

  * incident title
  * pod/crop/zone/reservoir
  * short evidence/action/result summary
  * View Pod
  * View Evidence
  * Acknowledge
* Arrange actions on the right if there is room.
* On narrow widths, actions may wrap beneath, but the card should still stay compact.
* Do not duplicate the full Operations Feed content here.

4. Move pod grid higher

* The pod grid should begin noticeably earlier on the screen.
* Reduce vertical gaps between:

  * summary
  * zone status
  * active incident
  * search
  * pod grid
* The search row should sit close to the pod grid.
* On a typical desktop viewport, at least the first row of pod cards should be clearly visible without needing the page to feel top-heavy.

5. Make pod cards smaller and denser

* Pod cards should be compact operational tiles.
* Reduce pod card min-height substantially.
* Remove unnecessary empty space.
* Use tighter typography and spacing.
* Keep only:

  * crop icon if already present
  * pod id
  * crop + zone
  * small status badge
  * issue summary or Healthy
  * 1–2 key metrics
  * reservoir id if useful
* Avoid large vertical gaps between lines.
* Avoid making every card feel like a large panel.
* Healthy cards should be even quieter and slightly more compact if possible.
* Critical/warning cards can have a stronger top border or accent, but should not become huge.

Suggested pod card density:

* Critical/warning card target height: roughly 120–150px.
* Healthy card target height: roughly 100–130px.
* Use responsive grid columns, but avoid cards stretching vertically just because the grid container has space.

6. Improve grid layout behavior

* The pod grid should use consistent gaps.
* Cards should align cleanly.
* Avoid awkwardly large cards caused by flex/grid stretching.
* Use CSS grid with sensible minmax values if appropriate.
* Avoid fixed heights that cause text clipping, but use min/max constraints so cards remain compact.
* The grid should feel dense but readable.

7. Tighten search row

* Keep the unified smart search.
* Reduce its height and visual weight.
* The search input should be prominent enough to find, but not compete with incident/pod content.
* The visible count, help button, simulate fault control, and ready state should align cleanly.
* Remove any unnecessary dropdown/control that is not part of the new search-first model unless still needed for demo functionality.

8. Slightly tighten Operations Feed

* Do not redesign it fully.
* Reduce nested-card feel where possible.
* Tighten spacing inside feed sections.
* Keep AI Sentinel only in Operations Feed.
* Make the feed readable but less bulky.
* Event rows should be compact and easy to scan.
* Active incident card in the feed can remain, but should not feel heavier than the main incident alert.

9. Consistent spacing system

* Audit the CSS spacing.
* Use a small set of consistent spacing values instead of many one-off margins.
* Section gaps should feel intentional.
* Card padding should be consistent by density:

  * summary/status strips: compact
  * zone tiles: compact
  * incident alert: compact-medium
  * pod cards: compact
  * operations feed cards: compact
* Avoid random vertical whitespace.

10. Visual hierarchy rules

* The most visually important elements should be:

  1. Farm health/status
  2. Active incident
  3. Critical/warning pod cards
  4. Operations Feed current AI activity
  5. Healthy pods
* The current UI makes the farm summary and incident container too visually large. Reduce their footprint without hiding them.
* Critical pod cards should be easy to spot through color/accent and ordering, not through oversized card dimensions.

Acceptance criteria:

* Farm Health summary is significantly shorter than before.
* Active Incident section is significantly shorter than before.
* “VERIFYING” badge is smaller and less visually dominant.
* Pod grid begins higher on the page.
* Pod cards are substantially shorter and denser.
* Empty space inside pod cards is reduced.
* Spacing between sections is consistent.
* Search row is compact and aligned.
* Operations Feed remains resizable and still contains AI Sentinel exclusively.
* The dashboard still looks like Hydroclawnics, but feels more polished, professional, and operational.
* No text overlaps, clips awkwardly, or overflows at common desktop and narrower viewport sizes.

Implementation guidance:

* Inspect the existing components and CSS from the previous refactor.
* Prefer CSS/layout refinements over large component rewrites unless a component structure is causing the spacing problems.
* Do not reintroduce the old filter row.
* Do not move AI Sentinel back into the main dashboard.
* Do not create a landing page, hero layout, decorative background, or marketing-style composition.
* After changes, run the app locally and visually inspect the Farm Overview at a desktop viewport.
* Also check a narrower viewport to ensure the compressed layout does not break.
* Summarize the files changed and what was tightened.
