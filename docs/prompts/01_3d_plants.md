-- THIS PROMPT HAS ALREADY BEEN EXECUTED, DO NOT ATTEMPT TO MAKE THESE CHANGES
Edit the existing createPlantMesh() function in the Three.js plant geometry code.
The current meshes look like trees (tall trunks, branching canopies). 
We want hydroponics crops: lettuce, tomatoes, basil, spinach, microgreens.
These are LOW, BUSHY, LEAFY plants — not trees. No roots visible (they're submerged).

DO NOT rewrite the whole file. Only change the geometry inside createPlantMesh().

## PLANT TYPES
Assign plant types based on pod index (or accept plantType param if it exists):
  0,5,10,15 → lettuce
  1,6,11,16 → tomato
  2,7,12,17 → basil
  3,8,13,18 → spinach
  4,9,14,19 → microgreens

## SILHOUETTE RULES (critical)
- MAX stem height: 0.3 units. These sit low in their tray.
- No visible trunk. Stems should be barely there or hidden by foliage.
- Foliage starts almost at tray level and spreads OUTWARD, not upward.
- Think: dense rosette, not tree canopy.

## PER-PLANT GEOMETRY

Lettuce (stages 0-3):
  Stage 0: 3 tiny flat ellipsoids (SphereGeometry scaled x=1,y=0.2,z=0.8),
           fanned out from center at ground level, pale yellow-green
  Stage 1: 6 ellipsoids, slightly larger, outer leaves drooping slightly
           (rotate outward ~20deg), light green
  Stage 2: 8-10 overlapping flat ellipsoids in a rosette pattern,
           medium green, ruffled look via slight random Y rotation per leaf
  Stage 3: Full dense rosette, 12+ ellipsoids, rich green, wide and flat

Tomato (stages 0-3):
  Stage 0: Thin short stem (h=0.2) + 2 small oval leaves, bright green
  Stage 1: Stem (h=0.3) + 4 compound leaves (pairs of small spheres
           on short petioles), medium green
  Stage 2: Bushier stem + 6 leaf clusters + 2-3 tiny sphere "fruits"
           (r=0.04, red #cc3300) scattered in foliage
  Stage 3: Full bush, wide spread, 4-5 visible red spheres (r=0.06),
           dense leaf clusters, dark green

Basil (stages 0-3):
  Stage 0: 2 round leaves (SphereGeometry scaled flat), bright green
  Stage 1: 4 pairs of opposing leaves up a short stem, vivid green
  Stage 2: Compact bushy mound, many small round leaf pairs, rich deep green
  Stage 3: Full herb mound, wide and rounded, very dense, deep green #2d6e2d

Spinach (stages 0-3):
  Stage 0: 2-3 small oval leaves flat to tray, dark green
  Stage 1: 5-6 larger oval leaves, slightly crinkled (squash geometry),
           dark blue-green
  Stage 2: Dense low mound of large oval leaves, very dark green
  Stage 3: Full mature spinach, wide flat spread, leaves overlapping,
           very dark #1a4a1a

Microgreens (stages 0-3):
  Stage 0: Just a few tiny sprout dots (small spheres r=0.03) in a cluster
  Stage 1: Dense carpet of tiny stems (many thin cylinders h=0.1, r=0.01)
           topped with tiny leaf pairs, bright #7ec850
  Stage 2: Thick lush carpet, taller sprouts (h=0.15), vivid green
  Stage 3: Full dense microgreen mat, uniform height, almost like moss,
           bright vivid green

Take inspiration for what a roblox model may look like using just parts.
When you finish with that, make the plant closer when in the PlantPreview.
You'll have to fully revamp those animations, and make them more dramatic. they are barely noticable currently.

## HEALTH COLOR
Keep existing health → color logic but adjust base colors to match above.
Healthy = the colors listed. Warning = desaturate + amber shift.
Critical = desaturate + dusty rose shift.

## CONSTRAINTS
- No geometry taller than 0.4 units total
- No visible roots (tray water plane hides the bottom)
- Keep existing tray/water plane geometry unchanged
- Keep existing sway animation (it works fine, just apply to the new groups)
- Keep existing click-to-select behavior
- All Three.js primitives only, no loaders

After you finish with everything. Commit it and push it, and make a pull request on my behalf for this branch to go to main.