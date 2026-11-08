---
number: 5
title: "Binder, AIDL, and custom system services"
subtitle: "How Android processes talk, and how to add a service of your own without breaking the conversation."
---

## Motivation

Almost every OEM customization eventually becomes: *some process knows something, another process needs it, safely, across a boundary Google designed on purpose.* That is Binder. Engineers who treat it as magic write slow, leaky, insecure services. Engineers who understand it write a small AIDL, register a service, and move on. This lecture is the second group.

## Mental model

Binder is kernel-mediated IPC with three ideas that matter daily. Calls look like local method calls but cross processes (and can cross the Treble boundary to vendor code). Identity is checked per call: the kernel tells you the caller's UID/PID, and *your service* decides what that caller may do. And interfaces are contracts: AIDL files generate stubs/proxies, get versioned, and (for vendor-facing interfaces) must obey stability rules because the other side ships on a different schedule.

A system service usually lives in `system_server` (Java, framework APIs, started by `SystemServer`, Lecture 4) or as a native daemon. It publishes itself with `ServiceManager.addService("name", binder)`, clients look it up by name, and `dumpsys name` is its confession booth. CarService is the AAOS exemplar: a large service hosting car-specific managers behind `Car` API facades.

## Walkthrough: add a small system service

Shape of the work (paths illustrative against the pinned tree; find the living examples in `frameworks/base/services` and `packages/services/Car`):

```java
// AIDL: frameworks/base/core/java/android/os/IDemoService.aidl (illustrative placement)
interface IDemoService {
    String getState();
    void setLevel(int level);
}
```

Implement it extending `IDemoService.Stub`, enforce a permission or UID check in every mutating method (`Binder.getCallingUid()`, `enforceCallingPermission`), register it during `SystemServer` startup (or as a standalone daemon if it must survive framework restarts or live on the vendor side), declare the service in the service context files Lecture 9 covers, build only the affected modules (Lecture 2), then interrogate it:

```bash
adb shell service list | grep -i demo
adb shell service call demo 1        # transaction codes follow your AIDL order; prefer a real client
adb shell dumpsys demo
```

Three design decisions to make out loud, because reviewers will ask. Threading: Binder calls arrive on Binder threads; never block them on slow IO or you will meet Lecture 10's watchdog. API surface: expose the smallest verbs the use case needs; "generic setProperty(int, String)" is how un-auditable services are born. Lifecycle: if the state matters, who owns persistence, and what happens on service restart mid-drive?

Stability is the boundary rule. Framework-internal AIDL can evolve with the tree. Anything crossing to vendor code, or exposed to apps across releases, needs the stable AIDL treatment (`aidl_interface` in Soong, versioned snapshots) that Lecture 6 generalizes for HALs.

## Lab (tiered)

**Tier 1 (emulator/reading, 1 h).** No code: pick CarService, find one manager, its AIDL, the `Car*Manager` client facade, and the permission it enforces. Draw the call chain from app call to HAL touch; this exact shape is your capstone's skeleton.

**Tier 2 (Cuttlefish, 2–3 h).** Implement a minimal read-only system service returning a build property, register it, call it from a tiny client (or `service call`), and add a `dump()` that reports uptime of the service.

*Verification status: structure and commands doc-verified against the pinned baseline; the full build-and-register cycle was not executed in the authoring environment.*

<div class="checkpoint"><strong>Checkpoint:</strong> <code>service list</code> shows your service, a client call returns your value, a caller without permission is rejected (and you can show the check in code), and <code>dumpsys</code> prints your state.</div>

## Exercises

1. Your service method takes 800 ms doing IO on the Binder thread. Describe two user-visible symptoms elsewhere in the system.
2. A vendor process must call your service. What changes about AIDL, registration, and Lecture 9 policy versus a framework-internal service?
3. Where does permission enforcement belong, client or service, and why is the other answer a vulnerability?
4. Design the AIDL (signatures only) for a service that reports and sets a cabin feature level, applying the smallest-verbs rule.

<details class="solution" markdown="1"><summary>Show solutions</summary>

1. Binder thread pool exhaustion in your process (other calls queue or time out) and client-side ANRs/watchdog pressure when called synchronously from a UI or system thread.
2. The interface becomes a stability commitment (versioned `aidl_interface`), the service needs vendor-accessible registration/`service_contexts` entries, and sepolicy must allow the vendor domain to find and call it.
3. Service side, always; client-side checks are a courtesy the caller can simply not perform.
4. Look for: typed getters/setters for the one feature, no generic string keys, a state query separate from mutation, and an error model stated in comments.

</details>

## Go deeper: kernel and app pointers

Binder lives in the kernel (`/dev/binder`, `binderfs`); when you need that side, [kernel path](/kernel-path/) step 1's architecture docs are the entry. For app-facing APIs, the `Car` facade pattern you traced is the model; the [app path](/app-path/) step 3 shows the consumer's view of the same contract.

<div class="callout"><p><strong>Working with AI agents:</strong> agents draft AIDL and boilerplate well. Make them also draft the <em>caller check</em> and the <code>dump()</code>, and never accept a generated service registration without finding its Lecture 9 policy twin. A service that exists but is denied by SELinux is the classic agent-shaped bug.</p></div>
