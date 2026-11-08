---
number: 9
title: "SELinux and platform security"
subtitle: "Policy, permissions, signing, and verified boot: the layer that decides whether your change is allowed to exist."
---

## Motivation

More OEM changes die here than anywhere else, quietly: the service is written, the HAL works on `userdebug` with permissive hacks, and then policy review, a `user` build, or VTS ends the celebration. SELinux is not an obstacle course around your feature. It is the feature's contract with the rest of the system, written in a language this lecture teaches you to read first and write second.

## Mental model

SELinux in Android is mandatory access control by **domain and type**. Every process runs in a domain (a type applied to processes); every file, socket, property, and service has a type; `allow <domain> <type>:<class> { permissions }` grants; absence denies. **Neverallow** rules are Google's unbreakable floor: policy that needs one removed is policy designed wrong, full stop.

The OEM workflow is evidence-led. Boot enforcing. Collect denials from logs. Each `avc: denied` names the source domain, target type, class, and the missing permission. Write the *narrowest* allow that matches the design, add the labels that make it possible (`file_contexts`, `service_contexts`, `property_contexts`), and keep vendor policy in vendor policy locations (`device/<vendor>/.../sepolicy` and BoardConfig wiring) where Treble says it belongs. Permissive domains and `setenforce 0` are diagnostic tools with an expiry date of today.

Around SELinux sits the rest of platform security a customizer touches: Android permissions and privileged allowlists (Lecture 8's missing artifact), signature/platform signing of system components, and **Android Verified Boot** (dm-verity, vbmeta) which decides whether your modified images are even allowed to run. Signing keys are program crown jewels: test keys are for development builds, and "we shipped with test keys" is an incident report, not a anecdote.

## Walkthrough: from denial to policy

```bash
# 1. Get the denial (device in enforcing mode)
adb logcat -b all -d | grep "avc: denied" | grep vendor_demo  # substitute your service
# or: adb shell dmesg | grep avc
# 2. Read it: scontext=u:r:<domain>:s0 tcontext=u:object_r:<type>:s0 tclass=<class>
# 3. Check what policy already says before writing any
# In tree (system/sepolicy + your device sepolicy): searchpolicy / sesearch equivalents,
# simplest: grep the type and domain under system/sepolicy/{public,private} and device sepolicy dirs.
# 4. Label first: service_contexts entry so ServiceManager will hand out your service,
#    file_contexts for your binary/data, property_contexts for your properties.
# 5. Then the narrow allow in the right .te file, rebuild policy/module, re-test enforcing.
```

Worked judgement call, the skill inside the skill. A denial asks for `write` on a broad type like `system_data_file`. The lazy allow fixes the log and fails review (and possibly neverallow-adjacent audits). The right move is usually a dedicated type for your service's data (`type vendor_demo_data_file, file_type, data_file_type;` with its `file_contexts` entry), then allow only your domain. Ten extra lines now, zero findings later. Likewise `binder_call` and service-manager `add`/`find` permissions are granted in pairs with intent: who may call you is a design decision (Lecture 5 made it in code; here you make it in policy, and the two must agree).

Audit habit for reviews: `neverallow` violations fail the build; an over-broad allow passes the build and fails the program. When reviewing policy diffs, read for new types granted to many domains, grants on `self` vs others, and anything touching properties broadly (`set_prop` is shell-level power in a car).

## Lab (tiered)

**Tier 1 (emulator/tree, 1 h).** Policy archaeology: choose CarService or the vehicle HAL, and produce its security sheet: domain, key types it owns, how it is labelled, and the three allows you judge most sensitive, with reasons.

**Tier 2 (Cuttlefish, 2–3 h).** Continue Lecture 5's service (or a dummy daemon): run enforcing, collect denials, label contexts, write minimal policy with at least one dedicated type, and demonstrate the service working enforcing with zero new denials.

*Verification status: workflow doc-verified against pinned baseline; the enforcing Cuttlefish cycle was not run in the authoring environment.*

<div class="checkpoint"><strong>Checkpoint:</strong> clean boot, enforcing, service functional, <code>grep avc</code> empty for your domain, and every policy line defensible in one sentence. If a line's defence is "it stopped the denial," it is not done.</div>

## Exercises

1. Translate a real or supplied `avc: denied` line into plain English: who, what, which action, what is missing.
2. Your change needs a neverallow removal. Argue why the design, not the rule, must change, and sketch the redesign.
3. Distinguish `service_contexts`, `file_contexts`, and `property_contexts` by the failure each one causes when missing.
4. Review drill: a vendor patch grants a HAL domain `write` on `system_data_file` "for logging." Accept, amend, or reject, with the amended policy shape.

<details class="solution" markdown="1"><summary>Show solutions</summary>

1. Look for: process domain named, target type named, class/permission named, and the statement that no allow currently grants it.
2. Neverallows protect invariants (e.g., untrusted code reaching raw devices); redesign usually means a broker service or a dedicated typed interface between the two sides (Lectures 5–6 patterns).
3. Missing service context: ServiceManager refuses/fails lookup; missing file context: files carry wrong labels, denials on access; missing property context: `setprop` denied or property falls into a wrong default type.
4. Reject as written; amend to a dedicated log/data type owned by that HAL, labelled via `file_contexts`, with write granted only to its domain.

</details>

## Go deeper: kernel and app pointers

SELinux is a kernel mechanism with Android's policy on top; [kernel path](/kernel-path/) step 1 explains where policy meets the kernel you ship. On the app side, permission protection levels and the app sandbox are the counterpart contract; [app path](/app-path/) steps 1–2, then Lecture 12's CTS view of both.

<div class="callout"><p><strong>Working with AI agents:</strong> agents will write you an <code>allow</code> for any denial you paste. That is precisely the danger. Use them to <em>explain</em> a denial and to find existing related policy, then write the narrow rule yourself and make the agent argue against it. Policy you cannot defend line by line is not yours yet.</p></div>
