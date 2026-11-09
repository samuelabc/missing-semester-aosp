---
number: 5
title: "Binder, AIDL, and custom system services"
subtitle: "The system-side welcome-light service, written completely: AIDL surface, permission checks, the call down to welcomed, and a dumpsys that confesses everything."
reading_time: "~40 min read, plus lab"
lab_time: "2–3 h"
---

<div class="lecture-map"><span class="block-label">Lecture map</span><h2>The whole lecture on one screen</h2><div class="lecture-map-grid"><div><h3>Build the map</h3><ul><li><a href="#motivation">Motivation</a> — some process knows, another needs</li><li><a href="#mental-model">Mental model</a> — local-looking, process-crossing</li><li><a href="#file-anatomy-a-system-service">File anatomy: a system service</a> — seven artifacts, seven failures</li></ul></div><div><h3>Walk the work</h3><ul><li><a href="#worked-example-welcomelightservice-end-to-end">Worked example: WelcomeLightService, end to end</a> — the gatekeeper, built</li><li><a href="#the-three-service-failures-you-will-actually-meet">The three service failures you will actually meet</a> — three failures, three tells</li></ul></div><div><h3>Make it a habit</h3><ul><li><a href="#lab-guided">Lab (guided)</a> — one method, both outcomes</li><li><a href="#exercises">Exercises</a> — follow the call</li><li><a href="#go-deeper-kernel-and-app-pointers">Go deeper: kernel and app pointers</a> — below the seam, above the seam</li></ul></div><p class="map-note">Lost mid-lecture? The Contents rail on the left (top on a phone) always shows where you are. Each section opens with what it teaches and closes with what you can now do.</p></div></div>

## Motivation
<div class="section-opener"><span class="block-label">In this section</span><p>Every OEM feature becomes the same shape: some process knows something, another process needs it, safely, across a boundary designed on purpose. This lecture builds the course's gatekeeper service on that boundary.</p></div>

Every OEM feature eventually becomes the same shape: *some process knows something, another process needs it, safely, across a boundary Google designed on purpose.* For the welcome light, the knowledge chain spans three processes. The daemon `welcomed` (Lecture 9's stand-in, Lecture 4's `.rc`) owns the hardware and already offers `vendor.acme.hardware.welcome.IWelcomeLight/default` to anyone policy allows. The companion app `com.acme.welcome` will eventually ask "turn the light on" from the app world.

Between them belongs a system-side owner: a service in `system_server` that apps and car components can talk to in framework terms, that enforces who may mutate the light, that survives the daemon's restarts without drama, and that answers for the feature when an engineer types `dumpsys`.

That service is this lecture's Worked Example, written completely: the AIDL, the permission, the implementation, the one-line registration, the build wiring, and the two SELinux lines — then built, interrogated, and broken three ways. Engineers who treat Binder as magic write slow, leaky, insecure services. Engineers who understand it write the files below and move on. This lecture is the second group.

<div class="section-recap"><span class="block-label">Now you can</span><p>State the shape every feature takes — who knows, who needs, and what makes the crossing safe.</p></div>

## Mental model
<div class="section-opener"><span class="block-label">In this section</span><p>Binder is kernel-mediated IPC with three ideas that matter daily: calls look local but cross processes, identity travels with the call, and the thread pool is a finite resource you design around.</p></div>

Binder is kernel-mediated IPC with three ideas that matter daily. Calls look like local method calls but cross processes (and, at the Treble boundary, cross from system to vendor code). Identity is checked per call: the kernel tells the callee exactly which UID/PID is calling, and *the callee* decides what that caller may do — the kernel authenticates, the service authorizes.

And interfaces are contracts: an `.aidl` file is compiled into a `Stub` (server side) and a `Proxy` (client side) that marshal arguments into Parcels, and the method order in that file *is* the wire protocol, forever.

Hosting the service in `system_server` buys four things and costs two. Bought: the framework lifecycle (`SystemService` phases from Lecture 4), direct access to framework internals without IPC, the platform's permission machinery, and `dumpsys` integration for free. Cost: your code's crash is now a framework crash — a watchdog kill or a `system_server` restart takes every service down with you, which is Lecture 10's favourite crime scene — and your start order is governed by boot phases rather than by init classes.

The native daemon `welcomed` made the opposite trade in Lecture 4: it survives framework restarts but sees none of the framework. The welcome feature wants both shapes, so it has both processes, and this lecture is the seam between them:

```
com.acme.welcome (app, later lectures)
        │  IWelcomeLightService  (this lecture's AIDL)
        ▼
WelcomeLightService in system_server  ── publishes "welcome_light"
        │  IWelcomeLight (vendor AIDL, Lecture 9; frozen in Lecture 6)
        ▼
welcomed (/vendor/bin/welcomed) ── /dev/welcome_light, sysfs LED, /data/vendor/welcomed
```

Read the diagram as Lecture 9's policy already drew it: `system_server` was granted `find` on the HAL service and `binder_call` toward `welcomed`; nobody granted the app anything yet, which is correct — the app arrives in Lecture 8, and it will talk to `welcome_light`, never to the daemon. One boundary per lecture, each with its own contract. That layering is the whole design skill: when a reviewer asks "why can't the app just call the HAL," the answer is this diagram plus the permission check in Step 2 below.

<div class="section-recap"><span class="block-label">Now you can</span><p>Explain a Binder call's journey, where the caller's identity lives during it, and why thread pools shape service design.</p></div>

## File anatomy: a system service
<div class="section-opener"><span class="block-label">In this section</span><p>Seven artifacts make a framework service real — from the AIDL contract to the registered name — each with the failure that appears when it is missing. This table is the Worked Example's map.</p></div>

Seven artifacts make a framework service real. The Worked Example writes all seven; this table is the map, including what breaks when each is missing — because on a real program, each of these failure modes will be *your* bug exactly once.

| # | Artifact | Where it lives | Job | If it's missing |
|---|---|---|---|---|
| 1 | AIDL interface | `frameworks/base/core/java/com/acme/welcome/IWelcomeLightService.aidl` | Defines methods, order, and types; generates Stub/Proxy | Nothing compiles; there is no contract |
| 2 | Permission declaration | `frameworks/base/core/res/AndroidManifest.xml` | Creates `android.permission.CONTROL_WELCOME_LIGHT` (signature-level) and its `Manifest.permission` constant | The check in the service refers to a permission that does not exist |
| 3 | Service implementation | `frameworks/base/services/core/java/com/android/server/welcome/WelcomeLightService.java` | `SystemService` subclass: publishes the Binder, enforces, delegates to the HAL | The name is registered nowhere; `service check` fails |
| 4 | Registration line | `SystemServer.startOtherServices()` | Starts the service at the right point in boot | Files exist, image builds, service never runs |
| 5 | Build wiring | `services/core/Android.bp` + the vendor interface's `Android.bp` | Puts the generated Java HAL stubs on the service's classpath | `cannot find symbol: vendor.acme.hardware.welcome` |
| 6 | Service type | `system/sepolicy/private/service.te` | Declares `welcome_light_service` with the attributes that let `system_server` publish it | `addService` denied by servicemanager policy; denial in the log |
| 7 | Service label | `system/sepolicy/private/service_contexts` | Maps the name `welcome_light` to that type | Same denial, one file earlier in the debugging order |

Two placements deserve a sentence each. The AIDL lives under `frameworks/base/core/java/...` because that is where upstream keeps the framework's Binder contracts (read `android/os/IDeviceIdentifiersPolicyService.aidl` at the pinned tag for the shape: one purpose, a handful of methods, `@hide` until someone designs a public API). And the service name `welcome_light` is deliberately boring: service names are a global, flat namespace owned by servicemanager, so they are chosen like global variables — unique, lowercase, and prefixed by nothing because the name itself must be the prefix-sized claim. The interface's fully-qualified name is what `service list` prints next to it, which is your first debugging gift.

### Reading upstream's shape before writing ours

Three upstream reads calibrate everything below. First, the lifecycle you inherit: `SystemService` (in `frameworks/base/services/core/java/com/android/server/SystemService.java` at the tag) declares `public abstract void onStart()`, `public void onBootPhase(@BootPhase int phase)`, `protected final void publishBinderService(String name, IBinder service)`, and `public final Context getContext()` — construction, publish, then phase callbacks in Lecture 4's numbered order. Second, the registration you imitate: `SystemServer.java` contains roughly 220 calls of the form `mSystemServiceManager.startService(SomeService.class)`; a new framework service is, mechanically, the 221st.

(`startServiceFromJar(className, path)` also exists, which is how APEX- and jar-delivered services get in without a `SystemServer` edit — worth knowing exists, not what a platform owner needs here.) Third, the consumption pattern your service will use downward: CarService's `VehicleHal` (in `packages/services/Car`) imports the generated Java classes of the vendor vehicle AIDL (`android.hardware.automotive.vehicle.*`), obtains the HAL Binder from `ServiceManager`, wraps it with the generated `Stub.asInterface(...)`, and registers a death recipient (`linkToDeath`) so a HAL restart is an event it handles rather than a crash it suffers. Your service does exactly this to `welcomed`, at one-hundredth the scale.

<div class="section-recap"><span class="block-label">Now you can</span><p>Name the seven artifacts of a system service and the failure each missing one produces.</p></div>

## Worked example: WelcomeLightService, end to end
<div class="section-opener"><span class="block-label">In this section</span><p><code>WelcomeLightService</code> in <code>system_server</code>, end to end: state ownership decided before code, permission checks on the calling thread, counters that separate denied from failed, and a <code>dump()</code> that confesses.</p></div>

The design decisions, stated before the code because reviewers will ask. *State ownership:* the daemon's state is authoritative; the service caches it, re-reads it on every (re)connect, and reports `-1` (unavailable) rather than guessing when the daemon is gone. *Mutations:* `setLightEnabled` is a normal (non-`oneway`) call, because the caller deserves to learn about denial synchronously; it performs authorization on the Binder thread, then hands the actual HAL call to a background thread, because Binder threads are a shared, finite pool and a stuck HAL must never park one.

*Reads:* `getLightState` is a lock-protected field read — microseconds, no IPC — so it is safe on the Binder thread and safe to leave permission-free; the light being on is not a secret, and Lecture 8's app will need to render it. *Lifecycle placement:* publish in `onStart()`, connect to the HAL at `PHASE_SYSTEM_SERVICES_READY` (500), the phase where Lecture 4 established that core services are registered and `class hal` daemons have had their chance to appear.

If the daemon is not there yet, connecting is a retry loop, not a boot failure: a system service that crashes `system_server` because a vendor daemon is late has inverted the dependency, and this lecture's first failure case shows the correct posture.

### Step 1: the AIDL

Create `frameworks/base/core/java/com/acme/welcome/IWelcomeLightService.aidl`:

```java
package com.acme.welcome;

/**
 * System-side welcome light API, implemented by WelcomeLightService in
 * system_server. The light hardware is driven by the welcomed vendor
 * daemon through vendor.acme.hardware.welcome.IWelcomeLight; this
 * interface is the framework-facing contract above it.
 *
 * Method order is the wire protocol: never reorder, never reuse.
 * New methods are appended (and this comment's history updated).
 *
 * @hide
 */
interface IWelcomeLightService {
    /**
     * Current light state: 0 = off, 1 = on, -1 = vendor daemon
     * unavailable. Never blocks; returns the service's cached state.
     */
    int getLightState();

    /**
     * Requests the light on or off. Requires
     * android.permission.CONTROL_WELCOME_LIGHT (signature); callers
     * without it receive a SecurityException and nothing changes.
     * Completion of the HAL write is asynchronous; read back with
     * getLightState().
     */
    void setLightEnabled(boolean enabled);
}
```

Two things to notice as a reviewer. The constants-that-aren't: state values are documented integers rather than an AIDL enum because this interface mirrors the daemon's `getState()` integer (Lecture 9's annex) — the lecture after next (Lecture 6) discusses when crossing interfaces justify real types, and the lab will make you feel the cost of the loose contract. And the asynchronous honesty in `setLightEnabled`'s contract: the method returns after the request is *accepted*, not after the LED is lit, and the interface says so. Half of all Binder API bugs are return-value promises the implementation never made;

write the promise you keep.

### Step 2: the permission

In `frameworks/base/core/res/AndroidManifest.xml`, alongside the other platform permissions, declare:

```xml
<!-- Allows an application to control the cabin welcome light.
     Signature-level: only platform-signed components (the welcome
     companion app, car system components) may change the light. -->
<permission android:name="android.permission.CONTROL_WELCOME_LIGHT"
        android:protectionLevel="signature" />
```

This one element does two jobs: it registers the permission with the package manager at install/scan time, and the framework build generates the `android.Manifest.permission.CONTROL_WELCOME_LIGHT` constant the service code references.

`signature` protection means "granted only to packages signed with the platform key" — the enforcement belongs to Lecture 8's signing story, but the *check* is this lecture's, and it happens in the callee, on every mutating call, with no exceptions for callers who "look internal." Note the deliberate absence of a dangerous/normal level: a normal permission would let any installed app request it in its manifest and light the cabin at will, which is a product decision this XML line is quietly making. Read every `<permission>` you ever review as a product decision wearing XML clothing.

### Step 3: the service

Create `frameworks/base/services/core/java/com/android/server/welcome/WelcomeLightService.java`:

```java
package com.android.server.welcome;

import android.Manifest;
import android.content.Context;
import android.os.Binder;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.RemoteException;
import android.os.ServiceManager;
import android.os.SystemClock;
import android.util.Slog;

import com.acme.welcome.IWelcomeLightService;
import com.android.server.SystemService;

import java.io.FileDescriptor;
import java.io.PrintWriter;

import vendor.acme.hardware.welcome.IWelcomeLight;

/**
 * System-side owner of the cabin welcome light.
 *
 * Publishes "welcome_light" (IWelcomeLightService) and forwards to the
 * welcomed vendor daemon's IWelcomeLight. The daemon's state is
 * authoritative; this service caches it, enforces
 * CONTROL_WELCOME_LIGHT on mutations, and reports STATE_UNAVAILABLE
 * whenever the daemon is absent or has died.
 */
public class WelcomeLightService extends SystemService {
    private static final String TAG = "WelcomeLightService";
    static final String SERVICE_NAME = "welcome_light";
    private static final String HAL_NAME =
            "vendor.acme.hardware.welcome.IWelcomeLight/default";
    private static final long HAL_RETRY_MS = 2000;

    static final int STATE_OFF = 0;
    static final int STATE_ON = 1;
    static final int STATE_UNAVAILABLE = -1;

    private final Object mLock = new Object();
    private Handler mBg;

    // Everything in this group is guarded by mLock.
    private IWelcomeLight mHal;
    private int mState = STATE_UNAVAILABLE;
    private long mStateSinceMs;
    private int mSetCalls;
    private int mDeniedCalls;
    private int mFailedCalls;

    private final Runnable mConnectHal = new Runnable() {
        @Override
        public void run() {
            synchronized (mLock) {
                if (mHal != null) return;  // already connected
            }
            IBinder binder = ServiceManager.checkService(HAL_NAME);
            if (binder == null) {
                // Not registered (yet). A late vendor daemon is a
                // retry, never a reason to fail system_server.
                mBg.postDelayed(this, HAL_RETRY_MS);
                return;
            }
            try {
                binder.linkToDeath(mHalDeathRecipient, 0);
            } catch (RemoteException e) {
                mBg.postDelayed(this, HAL_RETRY_MS);
                return;
            }
            IWelcomeLight hal = IWelcomeLight.Stub.asInterface(binder);
            final int halState;
            try {
                halState = hal.getState();
            } catch (RemoteException e) {
                mBg.postDelayed(this, HAL_RETRY_MS);
                return;
            }
            synchronized (mLock) {
                mHal = hal;
                setStateLocked(halState == 1 ? STATE_ON : STATE_OFF);
            }
            Slog.i(TAG, "connected to welcomed; state=" + halState);
        }
    };

    private final IBinder.DeathRecipient mHalDeathRecipient = () -> mBg.post(() -> {
        synchronized (mLock) {
            mHal = null;
            setStateLocked(STATE_UNAVAILABLE);
        }
        Slog.w(TAG, "welcomed died; light unavailable until it re-registers");
        mConnectHal.run();
    });

    private final IWelcomeLightService.Stub mBinder = new IWelcomeLightService.Stub() {
        @Override
        public int getLightState() {
            // Cached field only: no IPC, no lock held across a call,
            // safe and fast on a Binder thread.
            synchronized (mLock) {
                return mState;
            }
        }

        @Override
        public void setLightEnabled(boolean enabled) {
            // 1) Authorize first, on the calling thread, before any
            //    state moves. enforce* throws SecurityException, which
            //    Binder delivers to the caller as-is.
            try {
                getContext().enforceCallingOrSelfPermission(
                        Manifest.permission.CONTROL_WELCOME_LIGHT,
                        "setLightEnabled requires CONTROL_WELCOME_LIGHT");
            } catch (SecurityException e) {
                synchronized (mLock) {
                    mDeniedCalls++;
                }
                throw e;
            }
            // 2) Capture caller identity HERE. After post(), this
            //    thread returns to the pool and getCallingUid() would
            //    describe some other call — or none.
            final int callingUid = Binder.getCallingUid();
            final int callingPid = Binder.getCallingPid();
            // 3) The HAL call happens on the background thread, never
            //    on a Binder thread.
            mBg.post(() -> applyEnabled(enabled, callingUid, callingPid));
        }

        @Override
        protected void dump(FileDescriptor fd, PrintWriter pw, String[] args) {
            // State only, nothing user-identifying: this output lands
            // in every bugreport (Lecture 10). Production services also
            // gate dump() on the DUMP permission; the counters below
            // are the reason to keep it anyway.
            synchronized (mLock) {
                pw.println("WelcomeLightService:");
                pw.println("  state=" + stateName(mState) + " (" + mState + ")"
                        + " for " + (SystemClock.uptimeMillis() - mStateSinceMs) + "ms");
                pw.println("  hal=" + (mHal != null ? "connected" : "unavailable")
                        + " name=" + HAL_NAME);
                pw.println("  setCalls=" + mSetCalls
                        + " deniedCalls=" + mDeniedCalls
                        + " failedCalls=" + mFailedCalls);
            }
        }
    };

    public WelcomeLightService(Context context) {
        super(context);
    }

    @Override
    public void onStart() {
        HandlerThread thread = new HandlerThread(TAG);
        thread.start();
        mBg = new Handler(thread.getLooper());
        synchronized (mLock) {
            mStateSinceMs = SystemClock.uptimeMillis();
        }
        publishBinderService(SERVICE_NAME, mBinder);
    }

    @Override
    public void onBootPhase(int phase) {
        if (phase == PHASE_SYSTEM_SERVICES_READY) {
            // Lecture 4's contract: by phase 500 the core services are
            // registered, and class-hal daemons have had their chance
            // to appear. Connecting is still retry-tolerant by design.
            mBg.post(mConnectHal);
        }
    }

    private void applyEnabled(boolean enabled, int callingUid, int callingPid) {
        final IWelcomeLight hal;
        synchronized (mLock) {
            mSetCalls++;
            hal = mHal;
            if (hal == null) {
                mFailedCalls++;
                Slog.w(TAG, "setLightEnabled(" + enabled + ") from uid=" + callingUid
                        + " pid=" + callingPid + " dropped: welcomed unavailable");
                return;
            }
        }
        try {
            hal.setEnabled(enabled);
            synchronized (mLock) {
                setStateLocked(enabled ? STATE_ON : STATE_OFF);
            }
        } catch (RemoteException e) {
            // Death arrives via mHalDeathRecipient, which reconnects.
            // A bare RemoteException is counted, not spun on.
            synchronized (mLock) {
                mFailedCalls++;
            }
            Slog.w(TAG, "welcomed call failed; awaiting reconnect", e);
        }
    }

    private void setStateLocked(int state) {
        mState = state;
        mStateSinceMs = SystemClock.uptimeMillis();
    }

    private static String stateName(int state) {
        switch (state) {
            case STATE_ON: return "on";
            case STATE_OFF: return "off";
            default: return "unavailable";
        }
    }
}
```

Read it as four commitments, each of which the failure cases will test. *All HAL contact runs on one background thread* (`mBg`): connection, reconnection, and writes are serialized there, so the lock only ever protects the small state group against Binder-thread readers — a concurrency design you can hold in your head, which is the only kind that survives code review at 2 a.m.

*Identity is captured on the calling thread* (comment 2 in `setLightEnabled`): `Binder.getCallingUid()` is a property of the in-flight transaction on this thread, and the single most common beginner bug in this pattern is calling it inside the posted lambda, where it silently returns the service's own identity or zero. *Absence is a state, not an exception:* `mHal == null` maps to `STATE_UNAVAILABLE` everywhere — reads report it, writes count and drop — and nothing in the file can throw a vendor daemon's absence into `system_server`'s lap.

*The dump is the design's confession:* three counters partition every mutation attempt into accepted, denied, and failed, so the first diagnostic question of any welcome-light bug ("did the request even reach the service, and which way did it die?") is answerable from one command.

Notice also what the file does *not* contain: no polling loop in `getLightState`, no `synchronized` around the HAL call itself (the lock is released before `hal.setEnabled`), and no attempt to persist state — the daemon owns state, the service re-reads it on reconnect, and a `system_server` restart therefore heals by construction rather than by recovery code.

### Step 4: registration and build wiring

Register the service. In `SystemServer.startOtherServices()` (`frameworks/base/services/java/com/android/server/SystemServer.java`), add one line among its ~220 siblings:

```java
mSystemServiceManager.startService(WelcomeLightService.class);
```

Placement inside the method matters less than the phase discipline inside the service — `startService` constructs the service and calls `onStart()` (which publishes), and boot-phase callbacks follow automatically. This is the one-line diff that "adds a system service," and reviewing it is mostly reviewing that the class it names deserves to exist.

Wire the build. Lecture 9's `aidl_interface` for the vendor interface generated only the NDK backend (`java: { enabled: false }`), because only the daemon consumed it. The service consumes it from Java, so enable that backend in `device/acme/kestrel/welcomed/Android.bp`:

```
    backend: {
        cpp: { enabled: false },
        java: {
            enabled: true,
            sdk_version: "module_current",
        },
        ndk: { enabled: true },
    },
```

(`sdk_version: "module_current"` matches upstream's light-HAL interface at the tag; for an interface with no SDK exposure this keeps the Java stubs buildable against the module API surface.) This generates the `vendor.acme.hardware.welcome-java` library containing `IWelcomeLight.Stub`. Then put it on the service's classpath by adding that library to the `libs` of `services.core` in `frameworks/base/services/core/Android.bp` (the java_library that compiles everything under `com/android/server`).

Two build edits, both one-liners, both exactly where a reviewer expects to find them — and note the direction of the dependency: *system code depends on the vendor interface's stubs, never on the vendor daemon.* Lecture 6 makes that interface a frozen, versioned promise; this lecture only needs it to compile.

### Step 5: the SELinux pair

A name published by `system_server` needs the system-side twin of Lecture 9's Stage 2 treatment. Upstream's pattern for framework services is an attribute-carried grant, and acme's service joins it with two lines. In `system/sepolicy/private/service.te`:

```
type welcome_light_service, system_server_service, service_manager_type;
```

The `system_server_service` attribute is the load-bearing word: upstream's `system_server.te` already contains `add_service(system_server, system_server_service)`, which expands to the `add`/`find` grants and the neverallow that keeps anyone else from publishing under those types. Choosing attributes over hand-written allow rules is the system-policy dialect of Lecture 9's lesson — join the set whose invariants you want, don't re-derive them per service. Then label the name, in `system/sepolicy/private/service_contexts`:

```
welcome_light                               u:object_r:welcome_light_service:s0
```

(Compare `country_detector  u:object_r:country_detector_service:s0` upstream.) What these two lines deliberately do *not* do: grant any client `find` or `binder_call` access. Those arrive per client domain, the Lecture 9 way, when the clients arrive — the companion app's grant is Lecture 8's edit, and the checkpoint below leans on the fact that today, only `system_server` itself and servicemanager's own listings can see this service. Policy as audience design, again.

### Step 6: build, install, interrogate

Build the affected modules (Lecture 2's discipline: smallest target that proves the change), then rebuild the Cuttlefish image through your product flow and relaunch:

```bash
m services.core vendor.acme.hardware.welcome-java
```

On the booted target, interrogate in the order of the anatomy table — registration, then presence, then behaviour. Outputs are representative, in the tools' real formats:

```bash
adb shell service list | grep -i welcome
# ...  vendor.acme.hardware.welcome.IWelcomeLight/default: [vendor.acme.hardware.welcome.IWelcomeLight]
# ...  welcome_light: [com.acme.welcome.IWelcomeLightService]

adb shell service check welcome_light
# Service welcome_light: found

adb shell dumpsys welcome_light
# WelcomeLightService:
#   state=off (0) for 41203ms
#   hal=connected name=vendor.acme.hardware.welcome.IWelcomeLight/default
#   setCalls=0 deniedCalls=0 failedCalls=0
```

The `dumpsys` output already proves three artifacts at once: `publishBinderService` happened (the name resolves), `onBootPhase(500)` fired and `mConnectHal` succeeded (`hal=connected`, and `state=off` is the value *read back from the daemon*, not a default), and the daemon side is Lecture 9's world working (`service list` shows its registration under enforcing policy).

Now exercise the contract from the shell. Transaction codes follow AIDL order — `1` is `getLightState()`, `2` is `setLightEnabled(boolean)` — and the `service` tool writes the interface token for you:

```bash
adb shell service call welcome_light 1
# Result: Parcel(00000000 00000000 '........')     → exception code 0, getLightState() == 0

adb shell service call welcome_light 2 i32 1
# Reply parcel carries a SecurityException; the light does not change.

adb shell dumpsys welcome_light | grep deniedCalls
#   setCalls=0 deniedCalls=1 failedCalls=0
```

That denial is the worked example's centrepiece, so read it slowly. The shell runs as UID 2000, which does not hold a signature-level platform permission, so `enforceCallingOrSelfPermission` throws, Binder ferries the `SecurityException` back through the reply parcel, and the only thing that changed in the universe is a counter. Then the other half of the lesson: under `adb root`, the caller is UID 0, and upstream's permission machinery grants root (and the system process) unconditionally — "Root, system server get to do everything," in the source's own comment:

```bash
adb root
adb shell service call welcome_light 2 i32 1
# Result: Parcel(00000000 '........')              → accepted (no return value)

adb shell service call welcome_light 1
# Result: Parcel(00000000 00000001 '........')     → getLightState() == 1

adb shell dumpsys welcome_light
# WelcomeLightService:
#   state=on (1) for 1830ms
#   hal=connected ...
#   setCalls=1 deniedCalls=1 failedCalls=0
```

The counters tell the whole story of this section without a single log line: one denial (shell, unprivileged), one acceptance (root), zero failures (daemon present throughout). This is why the check belongs in the callee: the *same* interface, called the *same* way, is safe or unsafe purely by caller identity, and only the service side sees that identity truthfully.

<div class="checkpoint"><strong>Checkpoint:</strong> <code>service list</code> shows both welcome entries, <code>dumpsys welcome_light</code> reports <code>hal=connected</code> with counters at zero, the unprivileged shell's set attempt increments only <code>deniedCalls</code>, and the root set attempt moves <code>setCalls</code> and the reported state. If any step disagrees, the anatomy table names the artifact to inspect, in order.</div>

One literacy note on those Parcel dumps, because you will read hundreds: the first word of a reply Parcel is always the exception code — `0` means "a return value follows," and anything else (a `SecurityException` arrives as exception code with its message string after) means the call died at the boundary it names.

Return values then follow in AIDL declaration order, in the wire types the generated code uses: `int` and `boolean` as 32-bit words, `String` as a length-prefixed UTF-16 run, which is why a returned string looks like hex noise with the letters visibly interleaved in the ASCII column. When a `service call` result confuses you, count words before decoding them: exception, then returns, in order. Most "the service returned garbage" reports are a reader decoding from word zero.

<div class="section-recap"><span class="block-label">Now you can</span><p>Build the service end to end and prove, from its own counters, the difference between a denied caller and a failed call.</p></div>

<figure class="anchor-figure" role="img" aria-label="Concept anchor: a Binder call, end to end"><p class="anchor-title">Concept anchor — a Binder call, end to end</p><div class="anchor-flow"><div class="anchor-node"><strong>Caller</strong>app or service, with an identity</div><span class="anchor-arrow" aria-hidden="true"></span><div class="anchor-node"><strong>Proxy</strong>AIDL-generated, looks like a local call</div><span class="anchor-arrow" aria-hidden="true"></span><div class="anchor-node"><strong>Binder driver</strong>kernel-mediated crossing</div><span class="anchor-arrow" aria-hidden="true"></span><div class="anchor-node"><strong>Stub &amp; service</strong>identity checked on the calling thread</div><span class="anchor-arrow" aria-hidden="true"></span><div class="anchor-node"><strong>welcomed</strong>daemon state is authoritative</div></div><figcaption><strong>Read it as:</strong> the call looks local and is anything but. Identity, threads, and state ownership are decided at these links — the failures below are what happens when one is decided wrong.</figcaption></figure>

<figure class="anchor-figure" role="img" aria-label="Concept anchor: from artifact to caller"><p class="anchor-title">Concept anchor — from artifact to caller</p><div class="anchor-flow"><div class="anchor-node"><strong>AIDL contract</strong>methods, order, types</div><span class="anchor-arrow" aria-hidden="true"></span><div class="anchor-node"><strong>Permission</strong><code>CONTROL_WELCOME_LIGHT</code>, declared before it is checked</div><span class="anchor-arrow" aria-hidden="true"></span><div class="anchor-node"><strong>Service</strong><code>WelcomeLightService</code> owns the logic</div><span class="anchor-arrow" aria-hidden="true"></span><div class="anchor-node"><strong>Registered name</strong><code>welcome_light</code> in the service census</div><span class="anchor-arrow" aria-hidden="true"></span><div class="anchor-node"><strong>Caller</strong>checked on its own calling thread</div></div><figcaption><strong>Read it as:</strong> each artifact makes the next one possible. When a call misbehaves, walk the chain and ask which link was never built — the failures below live at specific links.</figcaption></figure>

## The three service failures you will actually meet
<div class="section-opener"><span class="block-label">In this section</span><p>The three service failures you will actually meet — identity captured on the wrong thread, a pool starved by a slow call, a service that never registered — and the evidence each one leaves.</p></div>

**Failure 1: the HAL is absent, and nothing else may break.** Boot an image without `welcomed` (or `adb shell stop welcomed` and prevent restart), then read the service: `getLightState()` returns `-1`, `dumpsys` shows `hal=unavailable`, `failedCalls` grows with each set attempt — and `system_server` is entirely healthy, other services unaffected, boot completed on time.

This is the designed behaviour, and its opposite is the classic vendor-integration bug: a framework service that blocks a boot phase on `waitForService` for a daemon that ships in a different partition, or crashes on a null it never checked, converting a missing light into a boot loop. The rules that prevent it are all visible in the worked example: connect on your own thread, poll with `checkService` and a delay, treat absence as a reported state. When you review a vendor-facing framework service, grep its connect path for `waitForService` on a boot-critical thread;

that grep is worth a release.

**Failure 2: the denied caller who looks authorized.** A platform-signed component calls `setLightEnabled` and still gets `SecurityException`.

Work the evidence in order: `deniedCalls` increments (the request reached the service and the check fired — registration and Binder are innocent); `Binder.getCallingUid()` in a debug log names the actual caller, which is frequently *not* the process you think (an app calling through another service inherits the *service's* identity only if that service cleared identity — more below); and the permission grant itself is a package-manager fact, checkable with `adb shell dumpsys package <pkg> | grep CONTROL_WELCOME_LIGHT`.

The three suspects, in order of field frequency: the caller is not platform-signed (Lecture 8's signing pipeline), the call is routed through an intermediary process whose identity is what arrives, or the permission was declared after the caller's package was scanned. What never fixes it: moving the check into the client library "so it fails earlier." Client-side checks are UX; the service-side check is the security boundary, because the client library cannot stop a caller who simply doesn't use it.

**Failure 3: the daemon dies mid-drive.** `welcomed` crashes (Lecture 4 restarts it under init) or is stopped during debugging. In-flight: a `setEnabled` racing the death throws `RemoteException`, counted under `failedCalls`.

Immediately after: `binderDied` fires, state drops to unavailable, and the connect loop resumes polling; when init's restart re-registers the interface (seconds, typically), the loop re-links and *re-reads* state from the new daemon process — which is why "the light came back in the wrong state after the daemon restarted" is almost never this layer's bug: the service reports the daemon's truth, so the daemon's state restoration (Lecture 9's state file) is where that complaint lives.

The symptom that *would* indict this layer: `hal=unavailable` forever despite `service list` showing the HAL — meaning the death recipient or the retry loop is broken, and the fix is in `mConnectHal`, not in the daemon. Design moral: every cross-process dependency you own needs its death story written before its happy path is believed; `linkToDeath` plus a reconnect loop plus a re-sync read is the complete pattern, and all three parts appear in the worked example.

### Identity discipline: the two rules that prevent the subtle bugs

First, **capture identity on the calling thread** (worked example, comment 2). Binder's calling UID/PID are thread-local facts about the in-flight transaction. The moment work moves to another thread — a handler post, an executor, a callback — that identity is gone, and code that asks later gets the service's own identity, which is how services end up authorizing themselves and logging nonsense. Capture first, pass explicitly, log the captured values.

Second, **when the service acts as itself, say so.** Sometimes a service must do work in its own right — reading a protected setting, writing a system-owned file — in the middle of handling someone else's call. The idiom, from `Binder.java` at the tag, brackets the work so the caller's identity doesn't leak into it:

```java
final long token = Binder.clearCallingIdentity();
try {
    // work done as system_server itself, not as the caller
} finally {
    Binder.restoreCallingIdentity(token);
}
```

The `finally` is not style: a leaked cleared identity persists for the *next* transaction that thread handles, quietly upgrading some later caller to system privileges — a security bug that survives every test that only exercises the happy path. Review rule: every `clearCallingIdentity` in a diff must be visibly paired, and unpaired ones are release blockers. (The worked example needs no clearing — it publishes and looks up services as `system_server` outside any caller transaction, on its own thread — and noticing *that* is the same review skill.)

<div class="section-recap"><span class="block-label">Now you can</span><p>Diagnose the three failures from their evidence, starting with identity on the calling thread.</p></div>

## Lab (guided)
<div class="section-opener"><span class="block-label">In this section</span><p>Add one method end to end — AIDL, service, proof, and the denied-caller case — because a service is only understood when you have moved a contract across the boundary yourself.</p></div>

The lab adds one method end-to-end — AIDL, service, proof, and the denied-caller case — because a system service is only understood when you have personally moved a contract across all its layers. The method is deliberately small: `int getDeniedCallCount()`, exposing the dump counter through the interface, gated by the same permission so the lab exercises authorization as well as plumbing.

**Tier 1 — trace the shape in the real tree (~1 h, no code changes).**
1. Find the vehicle HAL's AIDL (`hardware/interfaces/automotive/vehicle/aidl/`) and read one interface file. Checkpoint: you can name its package, its instance name, and three methods without notes.
2. In `packages/services/Car`, follow `VehicleHal` from construction to the `IVehicle` Stub: which `ServiceManager` call obtains the Binder, where death is linked. Checkpoint: you can point at the exact upstream lines our `mConnectHal` imitates.
3. Pick one CarService manager (e.g. property or audio) and find the permission its mutating methods enforce: the `enforce*` call in the service, the `<permission>` declaration it references, and the client facade (`Car*Manager`) that apps use. Checkpoint: a one-paragraph call chain — app call → facade → Binder → check → manager → HAL — with a file path per arrow. This shape is the capstone's skeleton.

**Tier 2 — add the method on kestrel_auto / Cuttlefish (~2 h).**
1. Append `int getDeniedCallCount();` to `IWelcomeLightService.aidl` (third method — appended, never inserted). Rebuild `m services.core`. Checkpoint: the generated Stub now defines the new transaction as code 3, and nothing else in the tree needed editing to compile.
2. Implement it in the Stub: enforce `CONTROL_WELCOME_LIGHT` first (same pattern as `setLightEnabled`), then return the counter under the lock. Checkpoint: the method compiles with the identity work done on the calling thread — trivial here, since it never leaves the thread, and you can say why that makes it safe.
3. Rebuild, relaunch, and prove all three callers: `adb shell service call welcome_light 3` as root returns the current count (Parcel's second word); trigger one denied `setLightEnabled` as plain shell, then re-read the method and watch the count move; read it as plain shell and watch *it* be denied. Checkpoint: three outcomes, three Parcel behaviours, all predicted before you ran them.
4. Break it once, on purpose: temporarily delete the new method's enforce line, rebuild, and show the shell now reads the count. Checkpoint: you can articulate, in the review comment you write for this deliberate break, exactly which guarantee died and why the compiler, Binder, and SELinux each had nothing to say about it. Restore the check.

**Tier 3 — bench reading (30 min, any head unit).** Choose two system services from `adb shell service list` on real hardware. For each, from `dumpsys` output alone, write down: who you believe may call it, what state it owns versus forwards, and which line would change first if its downstream died. Checkpoint: your inferences are stated as falsifiable claims ("if X dies, this line becomes Y"), the form Lecture 10's debugging loop consumes.

*Verification status: lifecycle methods, phase constants, ServiceManager APIs, identity and permission-check semantics, aidl_interface Java backend, sepolicy type/add_service patterns, and the `service` tool's behaviour checked against `android-17.0.0_r1` (see `docs/verification/lecture-05-source-truth.md`). The kestrel files are fictional teaching artifacts in upstream's shapes; Tier 2 was not executed as a Cuttlefish run in the authoring environment.*

<div class="section-recap"><span class="block-label">Now you can</span><p>Move one method across the boundary yourself, including the caller who must be denied, and prove both outcomes.</p></div>

## Exercises
<div class="section-opener"><span class="block-label">In this section</span><p>Exercises in service judgement: name a package, instance, and methods without notes; follow a call across the seam; and defend a permission decision a reviewer will challenge.</p></div>

1. A teammate implements `setLightEnabled`'s HAL call directly on the Binder thread "because it is just a flag write." The daemon wedges for 30 s during a bad boot. Describe what users of *other* methods of this service — and of unrelated services — observe, and why.
2. A reviewer proposes moving the `CONTROL_WELCOME_LIGHT` check into the companion app's client library "so unauthorized callers fail fast." Write the review comment: what still works, what silently stops being true, and what you require instead.
3. After a `system_server` restart, users report the welcome light "forgot" it was on, though `welcomed` never restarted. Using the state-ownership design, explain why the report is probably wrong about the mechanism — and name the one line of the worked example that decides it.
4. `getLightState` is permission-free in the worked example. Argue both sides in four sentences each: keep it open, or gate it with the same permission. Your verdict must cite a concrete caller from the course (app, SystemUI-class component, test tooling).
5. Add a fourth method to the AIDL: `void registerListener(...)` is out of scope for the types you have. Instead, design (signatures and contract comments only) the *smallest* addition that lets the companion app learn "light turned on" without polling. State what new failure mode your addition imports.

<details class="solution" markdown="1"><summary>Show solutions</summary>

1. Binder threads are a finite pool shared by every interface the process serves. A 30 s blocked call pins one thread; repeated calls pin the pool, after which *unrelated* Binder calls into `system_server` queue and time out — clients see ANRs and watchdog pressure far from the cause (Lecture 10's stall diagnosis starts exactly here). The write being "just a flag" describes the callee's best case; thread discipline must be written for the callee's worst day, which is why the worked example posts to `mBg` even though the normal call takes microseconds.
2. What still works: well-behaved callers using the library fail fast and get nicer errors — keep that as UX if you like. What stops being true: the guarantee. Any process can construct the Binder call directly (`service call` does it in one line), so an unchecked service method is callable by every UID on the device, and the permission becomes documentation. Require instead: the service-side `enforce*` stays as the boundary (denial counter as its tripwire), the client check may be added *in addition*, and the diff shows the denied-caller test. Authorization lives where identity is trustworthy: in the callee, per call.
3. The mechanism: state is daemon-authoritative and the service caches it. On `system_server` restart, the new service instance publishes, reaches phase 500, connects, and *re-reads* `hal.getState()` in `mConnectHal` — the deciding line — so it converges to the daemon's truth within seconds; it cannot "forget" anything it never owned. If the light is nonetheless reported off, the daemon's own returned state is where the truth diverged (its state restoration is Lecture 9's state file), and the user's report misattributes a daemon fact to the framework layer. The design lesson: pick one owner of every piece of state, and make every other holder a cache with a re-sync path.
4. Open (as written): state is not sensitive (a light's on/off is observable by sitting in the car); the companion app and test tooling need cheap reads; `dumpsys` already exposes the same fact to shell; gating reads multiplies permission plumbing for no confidentiality gain. Gated: state reads can leak behaviour patterns at scale (door/welcome telemetry is user-activity data); a single permission keeps the audience list in one place and auditable (`deniedCalls` sees readers too); future fields added beside the state inherit protection; regulators and reviewers prefer one door. A strong verdict either way names its caller — e.g., keep open *because* Tier-3-style tooling and the Lecture 8 app read it constantly and the value is physically public in the cabin, or gate it *because* the app is the only legitimate reader and shell already has `dumpsys`. Verdicts citing a principle without a caller are incomplete.
5. Look for: a second AIDL interface `IWelcomeLightListener { oneway void onLightStateChanged(int state); }` plus `void registerListener(IWelcomeLightListener l)` / `unregisterListener` on `IWelcomeLightService`, with contract comments stating `oneway` dispatch, delivery on a Binder thread, and no ordering guarantee beyond per-listener sequence. The imported failure mode, which must be named: listener death and leaks — the service must `linkToDeath` every registered listener and prune dead ones, or a crashed app leaves a permanent dead Binder the service calls into forever (and a *mutating* listener callback re-entering the service creates the deadlock shapes this lecture's threading rules exist to prevent). Designs that make registration permission-gated and cap the listener count earn the remaining marks.

</details>

<div class="section-recap"><span class="block-label">Now you can</span><p>Follow any welcome-stack call across the seam and name its package, instance, and permission check without notes.</p></div>

## Go deeper: kernel and app pointers
<div class="section-opener"><span class="block-label">In this section</span><p>When the Binder call itself is the mystery — latency, thread exhaustion, a transaction that never lands — the trail leads downward to the driver, and upward to the app callers.</p></div>

When a Binder call itself is the mystery — latency, thread exhaustion, a transaction that never lands — you have left this lecture downward: the [kernel path]({{ '/kernel-path/' | relative_url }}) step on Binder internals is the honest next rung, and Lecture 10 builds the tracing loop on top of it.

In the other direction, the companion app that will consume `welcome_light` arrives with Lecture 8's privileged-component story and the [app path]({{ '/app-path/' | relative_url }}) step 3, which shows this same contract from the caller's chair — including why the app never learns that `welcomed` exists.

<div class="callout"><p><strong>Working with AI agents:</strong> agents draft AIDL and service boilerplate well, and will happily generate a service with no permission check, a HAL call on the Binder thread, and a <code>dump()</code> full of nulls — because each omission compiles. Brief them with this lecture's invariants instead of its code: <em>authorize every mutation in the callee, capture identity before leaving the calling thread, no vendor IPC on Binder threads, absence is a state, dump three counters.</em> Then reject any generated registration whose Lecture 9 policy twin (type, label, client grants) is missing. A service that exists but is denied by SELinux — or worse, one that is findable by everyone — is the classic agent-shaped bug.</p></div>

<div class="section-recap"><span class="block-label">Now you can</span><p>Tell a service-design problem from a driver problem, and take the pointer that matches.</p></div>
