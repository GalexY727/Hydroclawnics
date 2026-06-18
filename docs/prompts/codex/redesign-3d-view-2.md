This is a focused follow-up for the existing 3D Farm view. Do not rebuild the entire scene, but the current top-down layout feels like several UI patches placed on top of each other rather than a cohesive operational digital twin. Focus on spatial organization, zone readability, and UI placement.

Current issues:

* Plant rows are too long and hard to scan.
* Zones/groups are not visually obvious.
* Labels are small and floating without strong spatial context.
* The top-left pod preview, top-right controls, bottom-left auto-tracking, and bottom-right search feel scattered rather than intentionally placed.
* The scene feels like a flat row grid instead of a meaningful farm map.

Required improvements:

1. Limit row length

* No row of plants should contain more than 8 pods.
* If a zone/group has more than 8 pods, split it into multiple shorter rows or clustered sub-rows.
* Keep pods from the same zone visually associated, but do not let them stretch endlessly across the screen.
* The result should be easier to scan at a glance.

2. Make zones visually obvious

* Add clear zone/group containers underneath the plants.
* Use subtle rectangular or island-like panels beneath each group, with:

  * muted/dark fill
  * more saturated border
  * enough contrast to define the zone
  * no excessive glow
* Think of the layout like compact “islands” or grouped platforms, similar in spirit to factory/island layouts in games like Shapez 2: distinct production areas that are spatially separated but still part of one system.
* A Roblox developer mindset is also useful here: simple readable geometry, clear group boundaries, strong spatial organization, and obvious interactive targets.

3. Improve zone labels

* Zone labels should be obvious and attached to the zone container, not floating awkwardly between rails.
* Each zone should have a readable label such as:

  * Zone 1 · R-01
  * Zone 2 · R-02
  * Zone 3 · R-03
  * Zone 4 · R-04
* Put labels near the top-left or edge of each zone island/container.
* Labels should not overlap pods, rails, or status rings.

4. Reconsider rail/flow layout

* If rails/flow lines remain visible, they should align with the new grouped zone layout.
* Flow lines should not visually dominate the plants.
* Respect the existing Flow Lines toggle.
* If flow lines are off, the zone containers and pods should still make the map understandable.

5. Reposition UI overlays

* Audit the current UI overlay positions and make them feel intentional.
* The pod preview panel should remain useful, but it should not cover important scene content.
* The search panel should not feel randomly stuck in the bottom-right if another location makes more sense.
* Auto-tracking status should feel connected to the scene or control area, not isolated.
* Top-right controls should be grouped cleanly and remain easy to use.
* Avoid placing UI on all four corners unless each placement has a clear reason.
* Consider consolidating low-priority controls/status into one bottom or side control strip if that improves coherence.

6. Preserve existing behavior

* Keep Top and Angled view modes working.
* Keep pod hover behavior.
* Keep pod click selection and View Full Pod flow.
* Keep plant health coloring.
* Keep AI-change/toast behavior.
* Keep Faults and Flow Lines overlays.
* Keep search functionality.
* Do not reintroduce immediate modal-on-click behavior.

7. Visual quality bar

* The top-down view should look like a designed digital twin map, not a spreadsheet of plants.
* Zones should be immediately understandable.
* Plant groups should feel intentionally placed.
* Rows should be short enough to scan.
* UI overlays should feel composed, not like bandaids.
* Keep the scene dark, technical, and operational, but improve clarity and polish.

Acceptance criteria:

* No plant row exceeds 8 pods.
* Zones/groups are visually separated with subtle island/container backgrounds.
* Zone labels are clear and attached to their groups.
* UI overlays are repositioned or consolidated so the view feels intentional.
* Flow lines remain optional and do not dominate the view.
* Existing 3D interactions and controls still work.
* The 3D Farm view feels significantly more cohesive and easier to understand.
* Run the app locally and inspect the 3D Farm view in top-down and angled modes before finishing. (skip if sites are hard to access. build and lint though).