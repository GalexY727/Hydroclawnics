This is a focused 3D view interaction polish task for `@hydroclawnics/frontend/`.

Do not rebuild the 3D farm scene from scratch. Preserve the existing digital twin scene, camera modes, plant health coloring, AI-change toasts, pod data, and current visual identity. This is a refinement pass focused on making the 3D view more useful and less disruptive.

Primary goal:
Make the 3D Farm view feel more like an operational digital twin by improving pod selection, contextual information, controls, and flow-line visibility.

Current context:

* The 3D view already has Top and Angled camera modes.
* Plant colors already change based on health status.
* Plants already have toasts/latest AI-change information.
* Hovering a pod currently shows a tooltip.
* Clicking a pod currently opens the full pod modal immediately.
* There is a water/flow-line visual system, but it currently feels visually prominent without enough meaning.
* The X button closes the 3D view, but this is somewhat redundant because users can click off / navigate away.

Required changes:

1. Change pod click behavior

* Do not open the full pod modal immediately when a pod is clicked.
* Instead, clicking a pod should select it.
* The selected pod should be reflected in a contextual info panel.
* Add a clear “View Full Pod” action inside that panel.
* Clicking “View Full Pod” should open the existing full pod modal/details view.
* Preserve existing modal functionality; just move it one step deeper.

2. Make the top-left card contextual
   The top-left Digital Twin card should no longer feel static or decorative.

It should have three states:

Default state, when no pod is hovered or selected:

* Farm model title
* total pods mapped
* active spatial alerts
* current AI scan target if available

Hover state:

* show lightweight pod preview while hovering
* pod id
* crop
* zone
* health/status
* pH and EC if available
* latest AI/telemetry note if available

Selected state:

* show persistent selected pod details
* pod id
* crop
* zone
* reservoir if available
* health/status
* important metrics
* latest AI change/toast text if available
* “View Full Pod” button

Hover should be temporary.
Click selection should persist until another pod is selected, the selection is cleared, or the user leaves the view.

3. Keep hover tooltip lightweight

* Preserve hover feedback, but avoid making it feel like a large modal.
* If the top-left panel is handling hover details, simplify the floating hover tooltip if appropriate.
* Do not show redundant large information in both places.
* Tooltip text should be polished and readable:

  * use “Tomato · Zone 2” instead of “tomato / Zone 2”
  * use “Healthy · Stable” instead of raw slash-separated text
  * keep pH/EC on one compact line where possible

4. Add “Show Flow Lines” option

* Add a visible but compact control for flow lines.
* Default flow lines to hidden/off unless the current app already relies on them for a specific active incident.
* The control can be a toggle, checkbox, or compact button depending on existing UI patterns.
* Label it clearly as “Flow lines” or “Show flow lines.”
* When off, hide or strongly mute the water/flow-line visuals.
* When on, show the existing flow-line system.
* Do not invent a complex flow-rate visualization unless the data already exists.
* This should be a simple visibility/overlay control, not a full new feature.

5. Improve top-right controls
   Current controls are roughly:
   Top | Angled | Fault | Reset | X

Refine the grouping and clarity:

* Keep Top and Angled camera controls.
* Keep Reset camera functionality.
* Keep Fault overlay/control if it is already meaningful.
* Add the Flow Lines control near overlay controls.
* The X close button should be removed if safe, or made much more subtle with a tooltip like “Close 3D view.”
* Do not let the X visually compete with core controls.

Suggested control grouping:

* View: Top | Angled
* Overlays: Faults | Flow lines
* Reset

Use the existing design system/components where possible.

6. Selection and status clarity

* Selected pod should have a clear visual ring/outline distinct from hover.
* AI scan target should remain visually distinct if currently implemented.
* Warning/critical/healthy plant coloring should remain unchanged unless minor polish is necessary.
* Avoid adding excessive glow or animation.
* The scene should remain readable and performant.

7. Code quality

* Inspect the existing 3D view components before changing behavior.
* Reuse current pod modal/details logic.
* Reuse current hover, toast, selected pod, and pod health data if present.
* Avoid bloating the implementation.
* Do not add a large new dependency for this.
* Keep state management simple and local unless existing app architecture suggests otherwise.

8. Scene quality

Inspect whether the project uses React Three Fiber, Drei, Three.js helpers, or postprocessing packages. Use existing Three.js/Drei utilities where available. Prioritize lighting, shadows/contact grounding, camera controls, billboard labels, distance-aware label visibility, and clear status rings. Do not add heavy postprocessing or large dependencies unless already installed. Keep performance stable with instancing where repeated pod/plant geometry exists.
Prioritize lightweight Three.js polish: better lighting, subtle contact shadows, billboard labels, distance-aware label visibility, cleaner status rings, and camera constraints. Avoid heavy postprocessing, high-poly geometry, excessive animations, or new large dependencies. Use instancing if repeated pod/plant geometry causes performance issues. Preserve smooth interaction on normal laptops.

Acceptance criteria:

* Clicking a pod selects it instead of immediately opening the full pod modal.
* The top-left panel updates for default, hover, and selected pod states.
* A selected pod panel includes a “View Full Pod” button that opens the existing full pod modal.
* Hover behavior remains useful but not redundant or oversized.
* Flow lines are hidden or muted by default and can be toggled on with a “Show Flow Lines” / “Flow lines” control.
* Top/Angled camera modes still work.
* Reset camera still works.
* Fault overlay/control still works if it existed before.
* Plant health coloring remains intact.
* AI-change toasts/latest AI-change information remains intact.
* The X close control is removed or made visually subtle.
* The 3D view feels more like an operational digital twin and less like a purely decorative scene.
* No obvious layout overlap, broken controls, or console errors.

After implementation:

* Run the app locally.
* Inspect the 3D Farm view in both Top and Angled modes.
* Test hover, click selection, View Full Pod, flow-line toggle, fault overlay, and reset.
* Summarize files changed, behavior changed, and any limitations.
