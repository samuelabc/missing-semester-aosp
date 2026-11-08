---
number: 7
title: "AAOS: CarService, the Vehicle HAL, and vehicle properties"
subtitle: "One signal's whole biography: a door opening in the body controller becomes light in the cabin, across a vendor property, CarService, and every contract from the previous lectures."
reading_time: "~40 min read, plus lab"
lab_time: "2–3 h"
---

## Motivation

This is the lecture the course exists for. Everything before it is Android; this is where Android becomes a car. And the smallest complete AAOS feature is already on the table: when a front door opens, the cabin welcome light should come on. Follow that one signal and you cross every boundary the course has built — a vehicle network the Android world never sees, the Vehicle HAL's property model, CarService's mediation, a permission check, Lecture 5's system service, Lecture 6's frozen contract, Lecture 4's daemon lifecycle, and Lecture 9's policy — in a single causal chain with a file and an owner at every hop.

That is the Worked Example: the door signal defined as a **vendor vehicle property**, served by the VHAL, consumed through `CarPropertyManager` by a small controller in the car process, and handed to `WelcomeLightService`, which lights the lamp through `welcomed`. Most AAOS customization requests that reach an OEM engineer reduce to this pattern — a vehicle signal must reach Android software, or Android must command the vehicle — so learn it once, properly, with names and numbers at every hop.

## Mental model

One signal's biography:

```
body controller (CAN) ──► vendor VHAL ──► CarService ──► CarPropertyManager ──► WelcomeLightController
   raw vehicle signal      IVehicle       property         (client API,            (car process)
                                          service           this lecture)              │
                                                                                       │ IWelcomeLightService
                                                                                       ▼
   LED ◄── welcomed ◄── IWelcomeLight (frozen v1) ◄── WelcomeLightService (system_server)
```

Three ideas organize everything below. A **vehicle property** is the unit of vehicle truth: a typed value identified by an integer ID whose bits *encode* its group, area kind, and type, plus a per-property configuration — access mode (read, write, read-write), change mode (static, on-change, continuous), and the set of area IDs it exists in (this door, that seat, or global). A property is therefore not a variable; it is a small contract, declared by the VHAL's prop configs and enforced by CarService. **CarService is the fan-out and the gate:** the VHAL talks to exactly one client (CarService's property service), which caches values, multiplexes subscriptions, and decides per caller and per property who may read or write. Nobody else talks to the VHAL — not apps, not `system_server`, not you — because a single mediator is what makes permissioning, lifecycle, and Lecture 10's debugging tractable. And **vendor properties are the sanctioned extension seam:** standard properties (speed, gear, HVAC) are defined upstream for everyone; signals only your vehicle has go in the vendor group of the ID space, flow through the same machinery as data, and need no fork of CarService. The capstone is, in essence, this lecture performed on a property of your choosing.

Customization lives at these seams — vendor properties, car config and overlays (Lecture 8), your own consuming services — and deliberately *not* inside CarService's internals. You have the source and may edit it, but every line you change there is a merge you own at the next upstream release. This lecture's controller stands next to CarService as a client, which is where OEM code belongs.

## File anatomy: the door-to-light chain

| # | Hop artifact | Where it lives | Job | If it's wrong |
|---|---|---|---|---|
| 1 | Property ID | composed per `VehicleProperty.aidl`'s algebra (VHAL `aidl_property`) | Names the signal; the bits declare group/area/type | Collisions and miscategorized props that tooling misreads |
| 2 | Prop config | the VHAL implementation (`VehiclePropConfig`: access, change mode, area configs); on the emulated stack, its JSON config | Tells CarService the property exists and how it behaves | Property invisible to every client (Failure 1) |
| 3 | VHAL contract | `IVehicle` (`getPropConfigs`, `subscribe`, `getValues`/`setValues`), frozen per Lecture 6 | CarService's only vehicle conversation | Nothing downstream exists |
| 4 | Property service | `CarPropertyService` + `PropertyHalService` (permission mapping) | Cache, fan-out, per-property read/write permission resolution | Ungated or over-gated signal (Failure 2) |
| 5 | Client API | `CarPropertyManager` via `Car.PROPERTY_SERVICE` | The supported consumer surface: callbacks, typed get/set | Consumers hand-roll Binder to `ICarProperty` and own the breakage |
| 6 | Controller | `WelcomeLightController` (acme, car process) | Door semantics: any front door open ⇒ light on | Signal present, feature absent |
| 7 | System service | Lecture 5's `WelcomeLightService` (`welcome_light`) | Permission-checked mutation, state, dumpsys | The call dies at Lecture 5's boundary |
| 8 | Daemon + contract | `welcomed`, `IWelcomeLight` v1 (Lectures 4, 6, 9) | Owns the LED | The bottom three lectures' failure modes |

Two rows reward a pause. Row 2 is the row newcomers skip: defining an ID in code accomplishes nothing until a VHAL *serves a config* for it — CarService learns which properties exist exclusively by asking the VHAL (`getAllPropConfigs()` at startup, `getPropConfigs(int[])` thereafter), so "my property is defined but returns nothing" is a config-serving bug until proven otherwise. And row 4's permission mapping is data-driven: `CarPropertyService.getReadPermission(propId)` asks `PropertyHalService` which permission guards this property, and for vendor properties the answer is `android.car.permission.CAR_VENDOR_EXTENSION` (signature|privileged) unless the VHAL's customized vendor-permission feature says otherwise (the `VehicleVendorPermission` categories — GET/SET per window, door, seat, light… — exist for programs that need finer gates). Lecture 5's rule in automotive clothing: the check is resolved in the service, per property, per operation.

### Reading upstream: DOOR_POS and the ID algebra

Practice the algebra on a standard property before composing ours. In `hardware/interfaces/automotive/vehicle/aidl_property/android/hardware/automotive/vehicle/VehicleProperty.aidl` at the pinned tag, the door's position property is written as arithmetic, not as a magic number:

```
DOOR_POS = 0x0B00 + 0x10000000 + 0x06000000
         + 0x00400000, // VehiclePropertyGroup:SYSTEM, VehicleArea:DOOR, VehiclePropertyType:INT32
```

The file's own documentation states the recipe: every property is *a unique id from range `0x0100`–`0xffff`*, a `VehiclePropertyType`, a `VehiclePropertyGroup`, and a `VehicleArea` — and "vendors are allowed to extend this enum with their own properties," provided they use the `VENDOR` group flag. The components at the tag: groups are `SYSTEM = 0x10000000`, `VENDOR = 0x20000000` (mask `0xf0000000`); areas include `GLOBAL = 0x01000000`, `DOOR = 0x06000000` (mask `0x0f000000`); types include `BOOLEAN = 0x00200000`, `INT32 = 0x00400000`, `FLOAT = 0x00600000` (mask `0x00ff0000`). So `DOOR_POS` decodes as: unique `0x0B00`, a system property, area kind door, integer value — 373295872 in the decimal form the framework's `VehiclePropertyIds` mirrors. Its documentation block adds the behavioural half: `@change_mode VehiclePropertyChangeMode.ON_CHANGE`, access `READ_WRITE` with OEM permission to implement read-only — because on some vehicles doors are motorized and commandable, and on most they are merely sensed. Concrete area IDs come from `VehicleAreaDoor`: `ROW_1_LEFT = 0x1`, `ROW_1_RIGHT = 0x4`, `ROW_2_LEFT = 0x10`, and so on — bit-positioned so area masks can combine them. Read any property ID in the field with the same four-part decode; it is the `cmd car_service` output's native tongue.

Why not simply use `DOOR_POS` for the welcome light, then? Because kestrel's body controller does not report door *position* — it reports a discrete ajar switch per door, a signal with no upstream home. Position (0–100% travel, for power doors) and ajar (open/not-open, from a switch) are different physical facts, and contorting one into the other corrupts both. The vendor range exists for exactly this: your vehicle's truth, in upstream's algebra. (The symmetric review rule: when the signal *is* an upstream concept, use the standard property — a vendor duplicate of vehicle speed buys you an ecosystem of tools that cannot see it.)

### Change-mode field guide

The config's change mode is the property's publication semantics, and choosing it is a load decision as much as a correctness one:

| Mode | Meaning | Canonical examples | Subscription consequence |
|---|---|---|---|
| `STATIC` | Set once per ignition/boot; never changes while running | VIN-class INFO properties, fuel capacity | Read it; callbacks are decoration |
| `ON_CHANGE` | Emits exactly when the value changes | Door ajar, gear, seatbelt, charge state | Rate argument is inert; correctness depends on never missing the seed read (Hop 3) |
| `CONTINUOUS` | Emits at a sample rate while values flow | Vehicle speed, RPM, steering angle | The subscriber's requested rate (Hz) is a real contract: CarService/VHAL down-sample to it, and every Hz is Binder traffic and wakeups somebody pays for |

Two field corollaries. The mode lives in the *VHAL's config*, not in the consumer's hopes: a consumer cannot subscribe its way out of a `STATIC` door property, which is why Failure 3 starts at the config text. And when you review a vendor property specification, interrogate the change-mode line hardest: type and area mistakes are caught by compilers and config checks, but a wrong mode compiles, ships, demos beautifully — and then bills the whole system forever, in event traffic nobody budgeted. And continuous properties punish the "subscribe at max rate, filter in the callback" school — the events cross Binder before your filter sees them, so the cost is paid by the whole system at the chosen rate; Lecture 10 will show you the bill. Choose the mode at definition time as if you were spending the CPU yourself, because you are.

## Worked example: door state to welcome light, end to end

### Hop 0: compose the vendor property

Define acme's door-ajar property by the algebra, in the VHAL's property set (and mirrored as a constant wherever consumers need it):

```
ACME_DOOR_STATE = 0x0C10          (unique id, acme's namespace)
                + 0x20000000      VehiclePropertyGroup.VENDOR
                + 0x06000000      VehicleArea.DOOR
                + 0x00200000      VehiclePropertyType.BOOLEAN
                = 0x26200C10  =  639634448
```

Semantics, written as the config will declare them: `true` means "this door is ajar." Access is **read-only** — Android never commands a door's ajar state; the direction of truth is vehicle → Android, and the access mode is where that direction is enforced. Change mode is **on-change**: a door state that must be polled is a door state that will be missed at 3 a.m. in a suspend discussion. Areas are the four door positions, of which the feature cares about the front two (`ROW_1_LEFT`, `ROW_1_RIGHT`). One design note with a long tail: the property reports *per-door* facts and the controller below aggregates them ("any front door"). Putting "any door" in the VHAL instead would bake one consumer's policy into the vehicle layer, where the next feature (door-open warning per door, say) would have to unpick it. Vehicle layer reports facts; Android layers decide meanings. That sentence will grade capstone designs.

### Hop 1: the VHAL serves the config

CarService discovers the property only if the VHAL's `getPropConfigs` answers for it, so the vendor VHAL's config table gains (in the `VehiclePropConfig` shape upstream defines):

```java
// In the vendor VHAL's property config set (acme vehicle HAL);
// areaConfig(id) is shorthand for a VehicleAreaConfig with that areaId:
VehiclePropConfig doorState = new VehiclePropConfig();
doorState.prop = 0x26200C10;                       // ACME_DOOR_STATE
doorState.access = VehiclePropertyAccess.READ;
doorState.changeMode = VehiclePropertyChangeMode.ON_CHANGE;
doorState.areaConfigs = new VehicleAreaConfig[] {
    areaConfig(ROW_1_LEFT), areaConfig(ROW_1_RIGHT),
    areaConfig(ROW_2_LEFT), areaConfig(ROW_2_RIGHT),
};
```

On real hardware this config ships inside acme's vehicle HAL implementation beside the signal plumbing that reads the body controller. On Cuttlefish — where the vehicle HAL is upstream's emulated implementation (`impl/current`, with its fake hardware backend) — the equivalent bring-up move is a JSON config entry in the same dialect as upstream's own `TestProperties.json`: the property's ID, `"access": "VehiclePropertyAccess::READ"`, its change mode, area list, and a default value (`false`, doors closed) for the fake backend to hold until injected otherwise. The emulated stack's `JsonConfigLoader` parses exactly these fields into prop configs at VHAL startup, which is why a config edit means a VHAL restart before CarService can see it (and why Failure 1's first check is "did the VHAL that is *running* load the config you *wrote*"). The VHAL process itself — `IVehicle/default`, its manifest entry, its sepolicy — is Lecture 6/Lecture 9 machinery already in place; this lecture adds one row to its config table and changes nothing else at this hop.

### Hop 2: CarService takes custody

At CarService start, its `VehicleHal` (Lecture 5's reading: the Java client of `IVehicle`) pulls all prop configs and builds the property registry; `CarPropertyService` then owns the runtime semantics. For `ACME_DOOR_STATE` the consequences are automatic, and that automaticity is the platform's gift to vendor properties: the property is cached on each VHAL event, subscriptions are fanned out from CarService (the VHAL sees one subscriber — CarService — regardless of how many Android consumers exist), and reads/writes resolve permissions through `PropertyHalService`: reads and writes of a vendor-group property require `android.car.permission.CAR_VENDOR_EXTENSION`. Note what CarService does *not* do: it has no idea what a door is. `639634448` is data with a config — type boolean, areas doors, on-change — and the generic machinery is sufficient. Every bespoke behaviour in this feature lives in the next hop, which is precisely where bespoke behaviour belongs.

### Hop 3: the controller — door semantics in the car process

The feature's brain is a small component in the car process (`packages/services/Car`, beside the components it integrates with; started with CarService's own services, holding the car API as a client):

```java
package com.android.car.welcome;

import android.car.Car;
import android.car.hardware.CarPropertyValue;
import android.car.hardware.property.CarPropertyManager;
import android.content.Context;
import android.os.IBinder;
import android.os.RemoteException;
import android.os.ServiceManager;
import android.util.Slog;

import com.acme.welcome.IWelcomeLightService;

/**
 * Door semantics for the welcome light: any front door ajar means the
 * cabin light should be on. Consumes ACME_DOOR_STATE through
 * CarPropertyManager (never the VHAL directly) and forwards intent to
 * WelcomeLightService, which owns authorization and the lamp.
 */
public class WelcomeLightController {
    private static final String TAG = "WelcomeLightController";

    // 0x0C10 (unique) | VENDOR | DOOR area | BOOLEAN — Lecture 7, Hop 0.
    static final int ACME_DOOR_STATE = 0x26200C10;
    private static final int AREA_ROW_1_LEFT = 0x00000001;
    private static final int AREA_ROW_1_RIGHT = 0x00000004;
    private static final int[] FRONT_DOORS = {AREA_ROW_1_LEFT, AREA_ROW_1_RIGHT};

    private final Context mContext;
    private CarPropertyManager mProperties;
    private IWelcomeLightService mWelcomeLight;
    private boolean mLeftOpen;
    private boolean mRightOpen;

    private final CarPropertyManager.CarPropertyEventCallback mCallback =
            new CarPropertyManager.CarPropertyEventCallback() {
                @Override
                public void onChangeEvent(CarPropertyValue value) {
                    if (value.getPropertyId() != ACME_DOOR_STATE) return;
                    if (value.getStatus() != CarPropertyValue.STATUS_AVAILABLE) return;
                    boolean open = (Boolean) value.getValue();
                    if (value.getAreaId() == AREA_ROW_1_LEFT) mLeftOpen = open;
                    else if (value.getAreaId() == AREA_ROW_1_RIGHT) mRightOpen = open;
                    else return;
                    applyLightState();
                }

                @Override
                public void onErrorEvent(int propertyId, int areaId) {
                    Slog.w(TAG, "door property error: prop=" + propertyId
                            + " area=" + areaId);
                }
            };

    public WelcomeLightController(Context context) {
        mContext = context;
    }

    /** Called once CarService is up and the Car API is connected. */
    public void start(Car car) {
        mProperties = (CarPropertyManager) car.getCarManager(Car.PROPERTY_SERVICE);
        // Seed from current values, then subscribe. On-change properties
        // only speak when they change; a door already open at boot must
        // not wait for the next transition to be believed.
        for (int area : FRONT_DOORS) {
            try {
                boolean open = mProperties.getBooleanProperty(ACME_DOOR_STATE, area);
                if (area == AREA_ROW_1_LEFT) mLeftOpen = open; else mRightOpen = open;
            } catch (RuntimeException e) {
                Slog.w(TAG, "initial door read failed for area " + area, e);
            }
        }
        mProperties.registerCallback(mCallback, ACME_DOOR_STATE, 0.0f);
        applyLightState();
    }

    private void applyLightState() {
        boolean anyOpen = mLeftOpen || mRightOpen;
        IWelcomeLightService service = welcomeLight();
        if (service == null) {
            Slog.w(TAG, "welcome_light not available; door intent dropped");
            return;
        }
        try {
            service.setLightEnabled(anyOpen);
        } catch (RemoteException e) {
            Slog.w(TAG, "welcome_light call failed; will re-resolve", e);
            mWelcomeLight = null;
        } catch (SecurityException e) {
            // Lecture 5's check, firing here, means this process does not
            // hold CONTROL_WELCOME_LIGHT: a signing/packaging fact, not a
            // transient. Log it as the configuration error it is.
            Slog.e(TAG, "not authorized to control the welcome light", e);
        }
    }

    private IWelcomeLightService welcomeLight() {
        if (mWelcomeLight == null) {
            IBinder binder = ServiceManager.checkService("welcome_light");
            if (binder != null) {
                mWelcomeLight = IWelcomeLightService.Stub.asInterface(binder);
            }
        }
        return mWelcomeLight;
    }
}
```

Read for the three decisions that carry weight. *Seed, then subscribe:* on-change events describe transitions, so a consumer that only listens will be wrong about any state that predates it — the boot-with-door-open case is the classic field bug, and the explicit initial `getBooleanProperty` per area is the entire fix. *Status is checked before value:* a `CarPropertyValue` carries `STATUS_AVAILABLE` or an error/unavailable status, and treating a stale or errored value as truth is how phantom door events light cabins at random; the callback ignores anything that is not available. *Failure is logged in the vocabulary of its layer:* an unavailable `welcome_light` drops the intent (Lecture 5's service re-reads state on its own reconnect; the next door transition re-sends), while a `SecurityException` is called out as configuration — because the car process, platform-signed like other car system components, is *supposed* to hold the signature permission, and its absence means the build's signing story (Lecture 8) broke, not that the door did. Notice also what the controller never does: it does not touch the VHAL, does not know the LED exists, and holds no state worth persisting. It is policy glue between two governed APIs, and it is allowed to be small because Lectures 5 and 6 made the layers beneath it honest.

### Hop 4: the governed call down

`applyLightState`'s `setLightEnabled(anyOpen)` lands in Lecture 5's service, where the permission check resolves in the caller's favour for once: the car process holds `CONTROL_WELCOME_LIGHT` by platform signature, so the mutation is accepted, counted under `setCalls` (never `deniedCalls`), posted to the service's background thread, and forwarded over the frozen v1 `IWelcomeLight` contract to `welcomed`, which Lecture 4's init stanza keeps alive and Lecture 9's policy confines to its LED, its data directory, and its property. One consumer-visible consequence worth stating: the *authority gradient* is now visible in `dumpsys welcome_light` — door events become `setCalls` increments with the light's state tracking them, and the whole feature's health is three greps: the property's value, the controller's log, the service's counters.

### Drive it: the emulator stimulus

With the chain built on a Cuttlefish `kestrel_auto` (whose emulated VHAL carries Hop 1's JSON entry), the `cmd car_service` tooling — whose verbs at the tag include `list-vhal-props`, `get-property-value`, `get-carpropertyconfig`, and `inject-vhal-event <name-or-ID> [area] data` — drives the vehicle side without a vehicle. Outputs are representative:

```bash
adb shell cmd car_service get-property-value 639634448 1
# CarPropertyValue: prop=639634448 area=1 status=AVAILABLE value=false

adb shell cmd car_service inject-vhal-event 639634448 1 true
# (VHAL emits an on-change event for ROW_1_LEFT)

adb shell dumpsys welcome_light
# WelcomeLightService:
#   state=on (1) for 212ms
#   hal=connected name=vendor.acme.hardware.welcome.IWelcomeLight/default
#   setCalls=1 deniedCalls=0 failedCalls=0

adb shell cmd car_service inject-vhal-event 639634448 1 false
adb shell service call welcome_light 1
# Result: Parcel(00000000 00000000 '........')     → light off again
```

Read the middle command's significance carefully: `inject-vhal-event` does not set an Android-side variable; it asks the emulated VHAL to emit the property as if the hardware reported it, so everything above the VHAL — CarService's cache, the controller's callback, Lecture 5's counters — is exercised on the *real* path, including the subscription machinery. Injection requires a privileged shell (the tool guards it with a vehicle-injection permission; root shell on userdebug is the normal bench posture), and it only works for properties the VHAL serves a config for — which converts the tool into a config probe: if injection complains the property is unknown, Hop 1 is where your bug lives, whatever the Android side looks like.

<div class="checkpoint"><strong>Checkpoint:</strong> the vendor property decodes by the algebra and is served by the VHAL (<code>list-vhal-props</code> / <code>get-carpropertyconfig</code> agree); injection of <code>true</code> for area 1 moves <code>dumpsys welcome_light</code> to <code>state=on</code> with <code>setCalls</code> incremented and <code>deniedCalls</code> untouched; <code>false</code> returns it to off. Each transition is provable at three independent layers, and you can name the file responsible for each.</div>

Round out the evidence kit with `adb shell dumpsys car_service`: among its sections, the property service reports its registered property registry and cached values — the CarService-side counterpart to `list-vhal-props`. Read together, the pair brackets Hop 2: the VHAL believes it serves a config, CarService believes it ingested one, and any disagreement between those two beliefs *is* the bug's address, before a single client is consulted. In the failures below, reach for that pair before reaching for client code.

### Why the controller lives where it lives

Two alternative placements were rejected, and the rejections are the transferable part. *Put the door logic inside `WelcomeLightService`*: it would need a `CarPropertyManager`, i.e. the framework's `system_server` would become a Car API client — binding to CarService's lifecycle, taking a dependency from the platform's most availability-critical process onto an automotive layer that restarts on its own schedule, and muddying Lecture 5's clean permission story (the service would need car permissions *and* own the light permission). Layering is not aesthetics; it decides which process's crash takes which feature down, and door-glue is not important enough to put in `system_server`. *Put it in the companion app* (Lecture 8's `com.acme.welcome`): the app is a legitimate *additional* consumer — for settings UI and user-visible feedback — but as the only consumer it makes a body-level behaviour depend on an app process's lifecycle, user assignment, and update state. The car-process controller has the car's lifetime, holds both permissions by design, and fails in the car layer where the logs already are. The general rule: consume vehicle properties in the car layer, consume system services from wherever is governed, and let exactly one component own the translation between the two vocabularies. Every additional translator is a second place for the same bug to live.

### Reading a CarPropertyValue like a professional

Every value that reaches a callback carries three fields beyond the payload, and professionals read all three before acting. The **status** (`STATUS_AVAILABLE`, or an unavailable/error state) is the VHAL's own testimony about the signal's health — a door value with a non-available status is not "false," it is "unknown," and the difference matters at 120 km/h exactly as much as in a parked cabin. The **timestamp** (elapsed-realtime nanoseconds from the VHAL event) is how staleness is detected: a cached read returns the *last known* value with its *original* timestamp, so "the door opened ninety seconds ago and nothing since" is a discoverable fact, not a vibe. And the **areaId** is not metadata — for area'd properties it is half the identity of the value, which is why the controller keys its state per area and why Exercise 4's phantom-light differential runs through per-area reads. A useful bench habit follows: before believing any consumer's complaint, read the property raw (`get-property-value`) and recite all four fields — value, status, timestamp age, area. Consumers lie through omission; the value object does not.

### Availability: the parked-car caveat

Everything above assumes the application processor awake and CarService running. The welcome light's most valuable moment — approach and unlock, AP possibly suspended — lives partly outside that assumption, and honesty requires marking the boundary. During suspend-to-RAM, Android is not consuming property callbacks; on AAOS the vehicle side (VHAL on a domain controller, wake-capable CAN paths, or the car power service's wake sources) decides what rouses the AP, and by the time CarService replays the world, door state must be *re-read*, not remembered — which is precisely why Hop 3 seeds from current values at start rather than trusting subscriptions. Design reviews for welcome-class features therefore ask two questions this lecture equips you to answer mechanically: what wakes the AP for this signal (a power-architecture question, answered with the car power team), and what does the chain do on the first second after wake (a Hop 3 question — seed, then subscribe, then reconcile). The property model does not change across the suspend boundary; the availability contract does, and conflating the two is how "works on the bench, dead in the parking lot" ships.

### The reverse direction: commanding the vehicle

Half the property system points the other way, and a complete mental model includes the write path even though this feature never writes. A command — motorized door (`DOOR_POS` is `READ_WRITE` upstream precisely for this), seat movement, a charge-port door — travels `CarPropertyManager.setIntProperty(...)` (and its typed siblings) into `CarPropertyService`, which resolves the *write* permission for that property (a different answer than the read permission, deliberately: many properties are world-readable and narrowly writable) and checks the caller, then `VehicleHal` issues `IVehicle.setValues` and the VHAL translates to the bus. Failures surface on two channels that must not be conflated: synchronous refusal (permission, unknown property, wrong access — the call itself complains) and asynchronous outcome (the VHAL accepted and the actuator later reported an error, which arrives as property status/error events, visible in the same `onErrorEvent` path the lab rehearses with `inject-error-event`). Note also the design boundary this reveals for our feature: the welcome LED is *not* commanded by writing a vendor property, even though one could be invented for it, because the LED is not vehicle truth — it hangs off `welcomed`'s own frozen interface (Lecture 6), and routing its command through the vehicle HAL would buy a process hop, a property-config fiction, and a confused permission story, in exchange for nothing. Properties report and command the *vehicle*; device-local actuators keep their own contracts. Knowing which side of that line a new signal belongs on is most of AAOS feature design.

## The three AAOS failures you will actually meet

**Failure 1: the property is invisible.** `get-property-value` says the property does not exist; the controller's initial reads throw; injection rejects it. The chain of custody is short: CarService only knows properties the VHAL serves configs for, so ask the VHAL's side first — `cmd car_service list-vhal-props` (what CarService actually ingested) and the VHAL's own dumpsys/config view. Usual causes, in order: the config entry was never added (Hop 1 skipped because "the ID is defined in code"); the config exists but the VHAL was not rebuilt or restarted since (configs are read at VHAL start); or the config targets a different property ID than the code — one hex digit of group/area/type drift, which is why Hop 0 writes the arithmetic out longhand. The Android-side code is innocent in this failure until the config question is answered, and engineers who debug it by staring at `CarPropertyManager` calls lose the afternoon.

**Failure 2: the permission wall, again — one floor up.** A system app reading `ACME_DOOR_STATE` gets a `SecurityException`, while `adb shell` (root) and the controller work. This is Failure 2 from Lecture 5 wearing car colours: `PropertyHalService` resolves a vendor-group read to `CAR_VENDOR_EXTENSION`, a signature|privileged permission the app does not hold; shell passes because root passes everything, which makes bench testing lie to you in exactly the way Lecture 5 warned about. The debugging order: confirm the denial is at CarService (the exception path and `getReadPermission(propId)`'s resolution), confirm the caller's granted permissions (`dumpsys package`), then decide the *product* question — is this app a legitimate reader of vehicle door state? If yes, it ships as a privileged component holding the permission (Lecture 8); if no, the correct outcome is the exception you are looking at. What never to do: downgrade the property to a system ID or weaken CarService's mapping to make the red go away. The vendor gate exists so that "which apps can observe the vehicle's body state" is a list someone signed.

**Failure 3: subscribed, silent, and wrong-area.** The property exists, reads fine when polled, but callbacks never arrive — or arrive for the wrong door. Work the semantics ladder: change mode first (if the config says `STATIC` — the `VehiclePropConfig` default — no events will ever fire no matter how correct the subscription; on-change intent must exist in Hop 1, not just in the client's heart); area second (callbacks are registered per *property*, and values arrive per *area*: a consumer that tracks only the last event's area, or seeds area 0 for an area'd property, builds a subtly fictional car — the controller's per-area fields exist because "the door" was never the unit); status third (events with non-`AVAILABLE` status are the VHAL reporting trouble — sensor fault, bus loss — and a consumer that ignores status will faithfully reproduce the trouble as phantom behaviour; the `inject-error-event` verb exists to rehearse exactly this). The pattern to carry: with properties, most "no data" bugs are *contract* bugs — mode, area, status — not transport bugs, and the config from Hop 1 is the contract's text.

## Lab (guided)

**Tier 1 — property archaeology on the AAOS emulator (~1 h, no code).** Pick three standard properties of different change modes (a static INFO property such as fuel capacity, the on-change `DOOR_POS`, a continuous one such as vehicle speed `PERF_VEHICLE_SPEED_DISPLAY` or RPM class). For each: decode the ID by the algebra from `VehicleProperty.aidl`; read it with `cmd car_service get-property-value <id> <area>`; find its config with `get-carpropertyconfig`; record the permission its reads require (resolve through `VehiclePropertyIds`' `@RequiresPermission` or the property-service mapping); and inject one `DOOR_POS` change, watching `logcat` and `dumpsys car_service` for the event's landing. Checkpoint: a nine-cell table (3 properties × ID-decode, config, permission) with every cell evidenced by a command you ran, and one paragraph on what the continuous property's event rate does to a naive subscriber.

**Tier 2 — build the chain on kestrel_auto / Cuttlefish (~2–3 h).**
1. Add Hop 1's JSON config entry for `639634448` to the emulated VHAL's config (TestProperties dialect), rebuild/relaunch, and prove visibility: `list-vhal-props` shows it; `get-property-value 639634448 1` returns `false`, `AVAILABLE`. Checkpoint: you can explain, citing the config file, why CarService now knows this ID.
2. Implement `WelcomeLightController` (Hop 3) in the car codebase and start it with CarService's services; rebuild. Checkpoint: `dumpsys welcome_light` exists (Lecture 5) and the controller's tag appears in `logcat` at car service start.
3. Drive it: inject `true` for area 1, then for area 4; verify `dumpsys welcome_light` (`state=on`, `setCalls` moving, `deniedCalls=0`); inject `false` for one door and prove the light *stays on* (the other door is open — your per-area aggregation just earned its keep); close both and prove off. Checkpoint: four injections, four predicted states, zero surprises.
4. Break it deliberately: remove `ROW_1_RIGHT` from the config's area list (keep the code), restart the VHAL path, and diagnose Failure 1/3 from the client side only — write down which observation (`get-property-value 639634448 4`, callback silence) convicted the config before you reopened it. Restore.

**Tier 3 — bench inventory (30 min).** On any real head unit, dump the served property list and classify five vendor-group properties by decoded type/area and (from config) change mode. For one of them, state a legitimate consumer and the permission that consumer must hold. Checkpoint: classifications derived from the IDs' bits, verified against configs — the field form of Tier 1's table.

*Verification status: property-ID algebra, group/type/area constants, `DOOR_POS` semantics, `IVehicle` surface, `VehiclePropConfig` shape, emulated-VHAL config machinery, vendor-permission resolution, `CarPropertyManager` API, and `cmd car_service` verbs checked against `android-17.0.0_r1` (see `docs/verification/lecture-07-source-truth.md`). The kestrel property, its config entry, and the controller are fictional teaching artifacts in upstream's shapes; Tier 2 was not executed as a Cuttlefish run in the authoring environment.*

## Exercises

1. A cluster feature needs vehicle speed at 10 Hz. Choose the change mode and subscription rate, and state the cost of each neighbouring mistake (on-change semantics forced onto a continuous signal; a 100 Hz subscription "to be safe").
2. An app team asks for direct `IVehicle` access "for performance." Write the three-sentence refusal that offers the supported path, naming what CarService's mediation buys beyond politeness.
3. Your vendor property write (door *command* on a motorized-door variant, access flipped to read-write) succeeds from `adb shell` but is rejected from your platform-signed system app. Where is the difference decided, and which of Lecture 5's lessons is this?
4. A consumer reports the welcome light "randomly on" in a parked car. Using this lecture's machinery, name three mechanically distinct causes and the observation that separates each pair.
5. Defend or reject, in five sentences: "For v2 of the feature, `ACME_DOOR_STATE` should become a system property contributed upstream." Your answer must use the algebra (what changes numerically) and one ecosystem argument.

<details class="solution" markdown="1"><summary>Show solutions</summary>

1. Continuous change mode in the VHAL config with a subscription rate at the need (10 Hz via `registerCallback(..., 10.0f)`), letting CarService/the HAL down-sample rather than firehosing every client. On-change semantics on a continuous signal either floods (every epsilon counts as change on some HALs) or starves (thresholded implementations stay silent at cruise). The 100 Hz subscription multiplies Binder traffic and wakeups for every downstream consumer — visible later as Lecture 10's CPU/wakelock profile — for precision the display cannot use. The knob is the rate at *subscription*, not heroics in the callback.
2. Look for: apps consume vehicle signals through CarService and `CarPropertyManager`; the VHAL's single-client design is what makes per-property permissioning, subscription fan-out, and lifecycle sane; and the raw path couples the app to a Treble contract it would have to re-implement badly. The supported path costs a property (standard or vendor) and a permission, and it keeps working across vendor drops — which the direct path, by construction, does not.
3. In CarPropertyService's permission resolution: writes resolve through `PropertyHalService.getWritePermission(propId)` to `CAR_VENDOR_EXTENSION` (or the customized vendor category), and root shell is granted by the platform's root/system shortcut — Lecture 5's "root gets to do everything," observed from the car floor. The app's failure means it genuinely does not hold the permission (signing or priv-app allowlist — Lecture 8), and the shell's success proves nothing about any app. Bench evidence from root is a hypothesis, never a verification.
4. Three separable causes: (a) a real event — some other door/hatch path set the property (check: the property's current per-area values and which area disagrees with the report); (b) a status mishandling — the VHAL emitted a non-`AVAILABLE` or error event and a consumer read the value anyway (check: `inject-error-event` rehearsal plus the consumer's status gate; our controller drops those, a forked copy might not); (c) state confusion after restart — a consumer that subscribes without seeding believes the pre-boot world (check: timing correlation with CarService/system restarts, and whether the seeding loop ran). Each pair is separated by one observation: per-area current values, status handling in code, restart timestamps. "Randomly" is what an un-instrumented chain calls determinism.
5. Strong answers notice the numeric fact first: promoting the signal means a *new* ID (group flips `0x20000000` → `0x10000000`, so `0x26200C10` becomes a different property — `0x16200C10`-shaped), i.e. a migration for every consumer and VHAL, not a flag flip; the old vendor ID typically must be served in parallel for a transition. The ecosystem argument cuts for promotion when the concept generalizes (ajar state is arguably as universal as `DOOR_POS` and its absence upstream is historical), and against when kestrel's switch semantics (debounce, partial-ajar reporting) are genuinely body-controller-specific. A verdict that engages both the number and the ecosystem earns full marks; "upstream everything" and "never upstream" both fail.

</details>

## Go deeper: kernel and app pointers

Below the VHAL, the door switch is a GPIO or a CAN frame before it is a property: the [kernel path]({{ '/kernel-path/' | relative_url }}) step 4 names the subsystems that deliver it, and Lecture 10's tracing picks the chain up when a hop misbehaves under load. Above this lecture, the companion app that will *also* react to doors — with UI, settings, and user consent in play — belongs to Lecture 8 and the [app path]({{ '/app-path/' | relative_url }}) step 3, which reads this same contract from the consumer's chair. One horizon note, deliberately brief: this lecture assumed the application processor awake and CarService up. Welcome behaviour around suspend-to-RAM, wake-on-CAN, and key-fob approach signals is where the power architecture (CarService's power management, VHAL wake properties) takes over — the property model you now know is the same, the availability contract is stricter, and programs get this wrong often enough that it has its own design reviews.

<div class="callout"><p><strong>Working with AI agents:</strong> property IDs and vendor-range rules are exactly the details agents state confidently and wrongly — expect fluent nonsense with plausible hex. Brief with the algebra and the four source files (<code>VehicleProperty.aidl</code>, its group/type/area companions, <code>CarPropertyManager</code>), then verify every ID the agent emits by decoding its bits yourself. An ID that decodes wrong is not a small error; it is a different property, silently, in a system that reports no error for asking about a property nobody serves — Failure 1 with the agent's signature on it.</p></div>
