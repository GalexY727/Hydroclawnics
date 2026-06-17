This is a focused enhancement task for `@hydroclawnics/frontend/`.

The current compact pod cards already switch their text summary to the most relevant metric when a pod has a problem. For example, a warning pod may show “Temperature high” instead of pH. Keep that behavior and extend it visually. These pods are "PodCardCompact" in @podgrid.jsx

Goal:
Add compact mini range bars to pod cards that show recent metric variation and current reading without making the cards larger or visually noisy.

Do not redesign the whole dashboard. Preserve the current two-pane layout, resizable Operations Feed, smart search, compact pod cards, and existing Hydroclawnics dark style. Focus only on improving the pod card metric display.

Concept:
These should not behave like progress bars. They should behave like compact IQR/range indicators for recent pod data.

Each pod card should normally show two mini range indicators:

* pH
* EC

If a pod has a warning or critical issue related to another metric, replace the pH indicator with the issue-relevant metric, matching the current text behavior.

Examples:

* Healthy pod: show pH + EC
* pH problem pod: show pH + EC
* Temperature warning pod: show Air temp + EC
* Humidity warning pod: show Humidity + EC
* TDS/EC problem pod: show pH + EC, or EC as the emphasized metric if the existing framework prefers that
* If the current code already chooses a primary issue metric, reuse that logic rather than creating duplicate condition trees.

Visual behavior:
Each mini indicator should show:

* a thin horizontal range track
* recent low/high or IQR-style recent variation for that pod
* a blue caret/tick/marker for the current/latest reading
* orange caret/tick markers for warning threshold boundaries
* red caret/tick markers for critical threshold boundaries
* a neutral or muted track background
* subtle center/healthy range emphasis if appropriate

Important:
The color should not come from filling the whole bar like a progress bar. The color should come from threshold markers and the current reading’s position relative to the healthy center/range.

The bar should answer:

* Where is the current value?
* How much has this pod varied recently?
* Is the current value near warning or critical thresholds?
* Is the recent range stable or drifting?

Compact card layout:
Keep the cards dense. Do not increase pod card height much.
A good layout would be:

pod_09                         WARNING
Spinach · North Bay

Temperature high
Air temp 31.8 °C ↑    [mini range indicator]
EC 902 ppm             [mini range indicator]

R-01

Or, for healthy pods:

pod_010                        HEALTHY
Tomato · East Rack

pH 6.12              [mini range indicator]
EC 1856 ppm          [mini range indicator]

R-02

Implementation expectations:

* Inspect the current pod card framework first.
* Find how the current text version chooses the primary metric for warnings/critical states.
* Reuse that logic where possible.
* Avoid bloating the code with a large custom visualization system.
* Check the repo’s existing dependencies/package.json for helpful npm packages before building from scratch.
* If a lightweight existing package is already present and appropriate, use it.
* If adding a new dependency would be excessive, implement a small reusable component with CSS and simple math.
* Prefer a reusable component such as `MetricRangeIndicator` or `MiniMetricRange`.
* Keep the component small, readable, and easy to tune.
* Do not add a charting library just for these tiny bars unless one is already installed and clearly useful.
* Avoid canvas/SVG complexity unless it meaningfully simplifies the implementation.
* A simple div/CSS or small inline SVG implementation is acceptable if clean.

Data handling:

* Use real recent pod data if the app already has recent samples/history available.
* If only the latest value and target ranges are available, create a graceful fallback:

  * show the healthy/warning/critical thresholds
  * place the current value marker
  * skip or synthesize recent low/high only if there is already mock/demo data designed for that purpose
* Do not invent complicated data structures if the app does not already support them.
* Preserve existing simulated/demo data behavior.
* If adding mock recent ranges is necessary for the demo, keep it minimal and centralized.

Threshold behavior:

* Use each metric’s known healthy range if available.
* Warning thresholds should sit just outside the healthy range.
* Critical thresholds should sit farther outside the healthy range.
* Clamp markers to the bar bounds so bad values do not break the layout.
* Handle missing values safely.
* Handle units cleanly:

  * pH
  * EC ppm
  * Air temp °C
  * Humidity %
  * any existing metric names/units already used by the app

Visual constraints:

* Bars should be thin and compact.
* They should not make healthy cards noisy.
* Blue current-value marker should be visible but not oversized.
* Orange/red threshold markers should be distinct but not neon.
* Healthy cards should remain calm.
* Warning/critical cards should still be recognized primarily through badge/accent/text hierarchy.
* Do not make every card look like a Christmas tree of colors.
* Keep the dark operational dashboard look.

Accessibility:

* Do not rely only on color.
* Keep the numeric metric text visible next to or above the bar.
* Add accessible labels/title text where reasonable, such as “pH current 6.12, recent range 5.9 to 6.3, healthy range 5.8 to 6.4.”

Acceptance criteria:

* Pod cards show two compact mini range indicators.
* Normal pods show pH and EC.
* Pods with a non-pH warning/critical issue replace the first indicator with the issue-relevant metric, matching the existing text summary logic.
* The bars represent current position and recent range/IQR, not completion progress.
* Current value is marked with a blue caret/tick.
* Warning boundaries are marked with orange carets/ticks.
* Critical boundaries are marked with red carets/ticks.
* Cards remain compact and do not grow noticeably taller.
* Healthy pod cards remain visually calm.
* The implementation reuses existing metric-selection/data logic where possible.
* The code is not bloated and avoids unnecessary dependencies.
* Existing dashboard layout, search, operations feed, and pod sorting continue to work.
* Run the app locally and visually inspect healthy, warning, and critical pod cards.
* Summarize the files changed and any limitations if recent sample data was not available.
