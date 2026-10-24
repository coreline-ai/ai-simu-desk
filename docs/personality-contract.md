# Personality implementation contract v1 (frozen for five workers)

Read-only common contract. Workers may write only their assigned `pilot-3d/character-personalities/<id>/` and `product/tests/personality-<id>.test.mjs`. No shared file edits, no Git operations, no browser/server control. The lead owns integration, hand skin/IK, scheduler, and shared tests.

## Required exports

- `profile.mjs`: `export const profile = Object.freeze({id,label,startOffset,workDuration,signatures:[three distinct strings],habit,completion});` Duration 7–12 seconds; stagger offsets nara=0,sora=.8,jun=1.6,min=2.4,leo=3.2. Descriptive Korean strings for label/habit/completion.
- `motion.mjs`: `export function sample({time,variant=0,stage='use',action='idle'})`. Time is elapsed **within current desk stage**, in seconds. Pure, deterministic, no timers/random/scene mutation.
- `props.mjs`: `export function createProps({actor,model,THREE,deskY=.74})` returns `{root,update(pose),dispose()}`. `root` is a THREE.Group, NOT added to the model by the worker. It is placed by the lead at the actor's home x/z/yaw once, with local ground y=0 and measured desk surface y=deskY,z≈.4–.6. Keep geometry desk-supported, a modest genuine character-specific accent, not duplicate cups, furniture or existing whole notebooks. Unique names prefixed `Personality_<id>_`. Dispose only own geometry/materials. No DOM/textures/external dependencies.

Props support correction: `createProps` also receives `deskY` (default `.74`), the measured OakDeskTop surface in the props root coordinates. Place prop bottoms at `deskY + .0005`; do not assume a .76/.77 table surface.

## Motion result (only supply useful fields)

```js
{
 cue:'distinct-machine-key', label:'지금 행동',
 phase:'observe' | 'act' | 'pause' | 'check',
 reading:false,
 pen:{x:.02,z:.01,lift:0}, // replaces the shared sine path, offsets from x=.355,z=.445 (min .35,.42)
 right:[.06,.805,.41],    // non-pen wrist target in actor local coordinates (Jun/Leo)
 left:[-.10,.81,.38],    // optional free left wrist target; NEVER force a prop owner
 rightGrip:[.1,.2,.3,.3,.4], leftGrip:[.1,.2,.3,.3,.4], // 0..1 curls; only used when hand not constrained to actual prop
 head:[.02,.08,0],       // additive pitch,yaw,roll, radians. Limit |pitch|<=.12,|yaw|<=.22,|roll|<=.08
 torso:[.02,.05,0],      // additive pitch,yaw,roll. Limit <=.07,.10,.04
 expression:'focus' | 'thinking' | 'positive' | 'relaxed',
 propBeat:0              // optional 0..1 progress for own decorative prop update
}
```

- Pen offsets: Nara/Sora x∈[-.025,.10],z∈[-.045,.09],lift∈[0,.06]. Min x∈[-.015,.035],z∈[0,.10],lift∈[0,.04]; its actual surface raycast remains authoritative. Never move a numerical contact target away from actual paper to fake contact.
- Right wrist without pen: Jun x∈[-.14,.20],y∈[.79,1.02],z∈[.26,.44]; Leo x∈[.20,.38],y∈[.82,.92],z∈[.30,.44]. The existing solver still controls final reach.
- Left wrist: x∈[-.18,.06],y∈[.79,.95],z∈[.22,.40]. Treat it as table support/gesture, NOT a false claim of touching the far-right notebook. A small left-side new note/palette may be placed near it. No wrist teleporting.
- Use three clearly different variants and meaningful long pauses, gaze shifts and body language. Not just different sine frequency/color. All output must stay finite at time=0, boundaries and long times.
- Idle/completion may be represented with stage='idle', action='success' etc.; never manipulate root translation, feet, props owned by cups/transfers, real task or database time.

## Lead integration guarantees

Character motion is active only in the new personalities mode. Existing v11/v12 tests and contacts remain available unchanged. The lead blends target changes over .25–.5 seconds, applies posture BEFORE prop IK, free left arm only when permitted, fingers after wrist/prop authority, and expressions last. Profile-specific use durations and staggered starts are integrated centrally. Props remain desk-anchored when the character walks away. Each module's independent tests must test signatures, bounded/finite outputs, variant distinction, stage/idle/completion and prop cleanup.
