---
number: 9
title: "SELinux in depth"
subtitle: "Every policy file, worked end to end: give a new vendor daemon its own domain, labels, and Binder service — then fix the three denials it earns, narrowly."
reading_time: "~40 min read, plus lab"
lab_time: "2–3 h"
---

## Motivation

Most OEM changes do not die in code review. They die here, late and quietly. The service works on a `userdebug` bench where someone ran `setenforce 0` "just for today". Then the `user` build arrives, or a policy review, or VTS, and the feature turns out to have been borrowing permissions from whatever label it happened to land on. The fix at that point is never small, because nobody can say which accesses the feature actually needs.

This lecture is the antidote, and it is deliberately narrow. It teaches SELinux only: how to read a denial, how to write the smallest policy that answers it, and what every file in a device `sepolicy` directory does. Platform signing, privileged-app allowlists, and verified boot used to share this page; they now get a short map at the end and proper treatment in Lectures 8 and 11, where the files they belong to are actually created. SELinux alone fills a lecture. Pretending otherwise is how it got skipped.

By the end you will have written, line by line, the complete policy for a real-shaped vendor daemon: its `.te` file, its entries in `file_contexts`, `service_contexts`, and `property_contexts`, a `genfs_contexts` line, the board-level wiring that gets those files into the build, and the smaller files (`seapp_contexts`, `mac_permissions.xml`, `keystore2_key_contexts`, `hwservice_contexts`) that secure the app and HAL sitting next to it. Nothing here is a fragment. Every file is shown whole enough to copy into a tree.

## Mental model

SELinux is mandatory access control stated in two vocabularies. Processes run in **domains**. Files, devices, properties, and Binder services carry **types**. A rule

```
allow welcomed welcomed_data_file:file { open read write };
```

says: a process in domain `welcomed` may open, read, and write objects labelled `welcomed_data_file`. No matching `allow`, no access. It does not matter that the process runs as root, or as `system`, or that the Unix mode bits say yes. The Unix check happens too; SELinux is a second, stricter gate behind it.

Four consequences run this whole lecture.

First, **labels are policy**. The rule above is useless until something labels the daemon's files `welcomed_data_file`. That labelling lives in the contexts files, not in the `.te` file, which is why "the policy looks right" and "it still denies" coexist so often.

Second, **a new executable needs a domain transition, not just a domain**. Declaring `type welcomed, domain;` creates the domain. Nothing runs in it until `init` is allowed to transition into it when executing a file labelled `welcomed_exec`. Upstream's macro for this is `init_daemon_domain(welcomed)`, which you can read in `system/sepolicy/public/te_macros` at the pinned tag: it expands to `domain_auto_trans(init, welcomed_exec, welcomed)`.

Third, **neverallow rules are the floor**. They are compiled into the same policy and fail the build when violated. A design that needs a neverallow removed is a design that crosses a boundary Google has decided may not be crossed, usually system/vendor separation. Redesign the feature; do not argue with the floor.

Fourth, **`audit2allow` is a translator, not an author**. Feed it a denial and it prints the allow that would silence that denial. It has no idea whether the object should have had a different label in the first place, so its output is routinely over-broad. The official guidance says this plainly: do not just copy the output. In this lecture `audit2allow` appears three times, and three times its answer is wrong in an instructive way.

## The running example

Every lecture in this course now adds one piece to the same fictional car. Fix the cast in your head, because Lectures 2, 4, and 5 will use these exact names when they are rewritten, and the capstone already builds this feature:

| Piece | Name |
|---|---|
| Device tree | `device/acme/kestrel/` |
| Product | `kestrel_auto` |
| Vendor daemon | `welcomed`, at `/vendor/bin/welcomed` |
| What it does | Drives the cabin welcome light: watches for its cue, lights the strip, times out |
| Its data | `/data/vendor/welcomed/` |
| Its light | `/dev/welcome_light`, plus the brightness knob under sysfs LEDs |
| Its Binder face | AIDL HAL-style interface `vendor.acme.hardware.welcome.IWelcomeLight`, instance `default` |
| Its properties | `vendor.acme.welcome.*` |
| Its companion app | `com.acme.welcome`, a privileged system app |

Why a native daemon, and not the Java service from Lecture 5? Because a Java system service runs inside `system_server` and shares that process's domain. It can be *labelled as a service* (that is `service_contexts`, Stage 2 below), but it can never demonstrate the central SELinux skill, which is creating a new domain and transitioning into it. A standalone vendor daemon can, and it is also the honest shape for code that touches vehicle hardware: the system-side welcome-light service from the capstone will call `welcomed` across the Treble boundary, exactly the way CarService calls the Vehicle HAL. The daemon offers its Binder interface in HAL style for the same reason. A vendor daemon that registers a plain system service would be teaching you a boundary violation; Lecture 6 explained why, and this lecture refuses to commit it.

One stand-in, clearly labelled. Lectures 4 and 5 have not been rewritten yet, so `welcomed` does not exist in your tree. The annex at the end of the worked example gives you a minimal version — about thirty lines that register the service, write a state file, open the light, set a property, and loop. It exists so the denials in this lecture can really happen. When Lectures 4 and 5 are rolled out, they replace the stand-in with the same binary built and started properly; the policy you write today does not change.

## File anatomy: the whole directory at a glance

A vendor policy change is never one file. It is a small directory, `device/acme/kestrel/sepolicy/vendor/`, plus one line in `BoardConfig.mk`. The build concatenates your files with the platform's, per partition, and compiles them into the binary `sepolicy` and the per-partition context files (`vendor_file_contexts`, `vendor_service_contexts`, and so on — the module list is in `system/sepolicy/contexts/Android.bp`, verified at the pinned tag). This table is the map for the lecture. Every row gets written or read in full below.

| File (in `sepolicy/vendor/` unless noted) | Built into / read by | You touch it when | Missing or wrong, you see |
|---|---|---|---|
| `welcomed.te` | Compiled into `sepolicy`; enforced by the kernel | Always: it declares the domain, its types, and every allow | The daemon does not start, or starts and can do nothing |
| `service.te` | Compiled into `sepolicy` | You offer a Binder service others look up by name | Lookup returns a type nobody may `find` or `add` |
| `property.te` | Compiled into `sepolicy` | You introduce a `vendor.…` property prefix | The property falls back to a default type; sets are denied or, worse, too widely allowed |
| `file_contexts` | `vendor_file_contexts`; read by `init` and install tooling at image build and `restorecon` | You add a binary, data directory, or device node | Objects keep their parent directory's label; denials name a type you never wrote |
| `service_contexts` | `vendor_service_contexts`; read by `servicemanager` | You register an AIDL-style service for system callers | Registration is denied as the wrong type, or clients cannot find the service |
| `vndservice_contexts` | `vndservice_contexts`; read by `vndservicemanager` | A service is for vendor processes only | Upstream file holds only `manager` and a `*` default; adding your system-facing service here puts it where system callers cannot use it |
| `property_contexts` | `vendor_property_contexts`; read by `init`'s property service | Same trigger as `property.te`; the two files are a pair | `setprop` from your daemon is denied, or the property inherits `default_prop` |
| `genfs_contexts` | Compiled into `sepolicy` | The object lives on a filesystem without extended attributes: `proc`, `sysfs` | Nodes under sysfs keep the generic `sysfs` label and every driver shares one permission set |
| `seapp_contexts` | `vendor_seapp_contexts`; read by Zygote/`installd` per app start | A system app needs a chosen domain or data type | The app lands in a generic app domain with the wrong data label |
| `mac_permissions.xml` + `keys.conf` | `vendor_mac_permissions.xml`; read by `system_server` | An app's signing key should map to a `seinfo` string | The app gets `seinfo=default` and your `seapp_contexts` line never matches |
| `keystore2_key_contexts` | `vendor_keystore2_key_contexts`; read by `keystore2` | A daemon stores keys under its own namespace | Keystore refuses the namespace; the daemon can only borrow someone else's |
| `hwservice_contexts` | `vendor_hwservice_contexts`; read by `hwservicemanager` | You ship a legacy HIDL HAL (rare in new work) | The HIDL service cannot be added or found; AIDL services do not belong here at all |
| `BoardConfig.mk` (in `device/acme/kestrel/`) | Read by the build before any of the above | Once per device: it points the build at your directory | None of your files are in the build, and the tree looks exactly like success until runtime |

Three reading notes before we write anything. First, platform policy splits into `system/sepolicy/public` (the API vendor policy may use), `private` (platform internals), and `vendor` (policy for platform components that happen to live on the vendor partition). You write against `public`. Second, the old variable name `BOARD_SEPOLICY_DIRS` still appears in trees — Cuttlefish uses it once, for a Bluetooth library directory — but new vendor policy is wired with `BOARD_VENDOR_SEPOLICY_DIRS`; that is what `system/sepolicy/README.md` documents at the pinned tag, and it is what we use. Third, the modern device layout is flat: `.te` files and contexts files side by side in one directory. Cuttlefish's `shared/sepolicy/vendor/` at the pinned tag is the reference — ninety-odd files, no ceremony.

## Worked example: securing welcomed, one denial at a time

We build the policy the way it is built at work: start with almost nothing, run enforcing, read what the kernel says, fix that one thing. Three stages. Each stage shows the file state, the failure, the tempting wrong fix, and the narrow one. Sample denials below are representative lines in the kernel's audit format; your device name, inode, and pid will differ. What will not differ is the grammar, and the grammar is the skill.

Create the skeleton first. On your Cuttlefish tree (Setup has the sync commands), the acme device directory does not exist yet, so make it:

```bash
mkdir -p device/acme/kestrel/sepolicy/vendor
mkdir -p device/acme/kestrel/welcomed/aidl/vendor/acme/hardware/welcome
```

Wire the directory into the build now, so no later stage fails for the dumbest possible reason. In `device/acme/kestrel/BoardConfig.mk` (create it with just this, for now):

```make
# Kestrel board configuration (excerpt — Lecture 2 grows this file)
BOARD_VENDOR_SEPOLICY_DIRS += device/acme/kestrel/sepolicy/vendor
```

If you arrived here before Lecture 2, apply the same line to the end of `device/google/cuttlefish/shared/BoardConfig.mk` as a pilot shortcut, so today's virtual car picks the policy up. Lecture 2 retires that shortcut: it makes `kestrel_auto` a real lunch target whose own `BoardConfig.mk` carries this line, and if you have done Lecture 2, this is the only registration you need (remove the Cuttlefish one, or the policy files register twice and the build will say so).

### Stage 0: the stand-in daemon

Copy the annex files into `device/acme/kestrel/welcomed/` (they are printed in full after Stage 3, so everything on this page can be created from this page): `Android.bp`, `main.cpp`, `welcomed.rc`, and `aidl/vendor/acme/hardware/welcome/IWelcomeLight.aidl`. Add the daemon to what the Cuttlefish build ships by finding the auto product's package list and appending one line:

```bash
grep -rln "PRODUCT_PACKAGES" device/google/cuttlefish/vsoc_x86_64_only/auto/
# open the .mk that list points at and add:
#   PRODUCT_PACKAGES += welcomed
```

Build just the daemon and the policy machinery before any full build:

```bash
source build/envsetup.sh
lunch aosp_cf_x86_64_auto-ap4a-userdebug
m welcomed selinux_policy
```

<div class="checkpoint"><strong>Checkpoint:</strong> both targets build. <code>m selinux_policy</code> is the pinned tree's policy compile-and-neverallow-test target (it exists in <code>system/sepolicy/Android.bp</code>); if it fails now, the failure is in the skeleton, not in policy you have not written yet.</div>

### Stage 1: a domain of its own

Start with the smallest `.te` file that says anything at all. Create `device/acme/kestrel/sepolicy/vendor/welcomed.te`:

```
# welcomed — cabin welcome-light daemon (acme Running Example)
type welcomed, domain;
type welcomed_exec, exec_type, vendor_file_type, file_type;
```

Build the policy, build a bootable image the way Lecture 2 taught (`m` once for the reference target is the slow, expected cost), boot it enforcing, and look for the daemon:

```bash
adb shell getenforce
adb shell ps -Z | grep welcomed
adb logcat -b all -d | grep "avc: denied" | grep -i welcomed
```

`ps` shows nothing, and the log carries the first lesson:

```
avc: denied { execute } for pid=388 comm="init" path="/vendor/bin/welcomed"
  dev="dm-5" ino=1911 scontext=u:r:init:s0
  tcontext=u:object_r:vendor_file:s0 tclass=file permissive=0
```

Read it left to right, because every denial you will ever meet has this shape. `scontext` is who acted: `init`, as itself. `tcontext` is what it acted on: the binary, labelled `vendor_file` — the default label for files on the vendor partition, because nothing has claimed this path yet. `tclass=file` with `{ execute }` is the act. And `permissive=0` says the denial was enforced, not logged-and-allowed. Two facts follow. The domain transition never happened, because `init` may not transition on executing a generically labelled file. And the fix is in two files, not one: `.te` grants the transition, `file_contexts` applies the label that makes the grant reachable.

Create `device/acme/kestrel/sepolicy/vendor/file_contexts`:

```
# Binaries — the exec label is what the domain transition keys on.
/vendor/bin/welcomed        u:object_r:welcomed_exec:s0
```

The pattern is worth comparing with upstream, where HAL binaries sit under `hw/`: `system/sepolicy/vendor/file_contexts` labels `/(vendor|system/vendor)/bin/hw/android\.hardware\.audio…service` as `hal_audio_default_exec`, and Cuttlefish's own `file_contexts` labels its device nodes the same way. Exact paths are matched before general ones, and the build sorts this file (`fc_sort` in the contexts build rules), so put specific entries in and let the machinery order them.

Then finish the `.te` file's first stage by adding the transition macro under the type declarations:

```
init_daemon_domain(welcomed)
```

That one line expands (read `public/te_macros` if you doubt it, and you should, once) to: `init` may execute `welcomed_exec` files and transition; the new domain may use that file as its entrypoint; and the transition happens automatically. Rebuild (`m selinux_policy welcomed`, then your image), reboot, and check again. This time the expected output is a process:

```bash
adb shell ps -Z | grep welcomed
# u:r:welcomed:s0          system         612     1   ...   /vendor/bin/welcomed
```

<div class="checkpoint"><strong>Checkpoint:</strong> <code>getenforce</code> prints <code>Enforcing</code>, <code>ps -Z</code> shows the daemon in <code>u:r:welcomed:s0</code> (not <code>init</code>, not <code>vendor_file</code>'s neighbours), and no <code>execute</code> denial for the binary remains. If the process runs as <code>u:r:init:s0</code>, the transition was allowed but not made automatic — that is the difference between <code>domain_trans</code> and the <code>domain_auto_trans</code> inside <code>init_daemon_domain</code>.</div>

### Stage 2: a service others may call

The daemon is alive and useless. Its job is to offer `IWelcomeLight` to the system-side welcome-light service, which runs in `system_server`. Registration fails first:

```
avc: denied { add } for pid=612 comm="welcomed"
  name="vendor.acme.hardware.welcome.IWelcomeLight/default"
  scontext=u:r:welcomed:s0 tcontext=u:object_r:default_android_service:s0
  tclass=service_manager permissive=0
```

`servicemanager` looked the name up in its contexts files, found nothing, and fell back to `default_android_service`. Nobody may add a service under the default label, so the `addService` call in the stand-in returns an error and the daemon logs that it could not register. This is the single most common SELinux failure in service work, and it is a labelling bug, not a permission bug.

`audit2allow` would propose `allow welcomed default_android_service:service_manager add;`. Reject it on sight: it makes your daemon the one domain allowed to squat on the *default* label, which says nothing about who may then find or call the service, and it breaks the moment any other unlabelled service appears. The right move is the pattern from Stage 1, repeated for a service instead of a file: give the service its own type, label the name with it, then grant add and find separately, to named domains.

Create `device/acme/kestrel/sepolicy/vendor/service.te`:

```
# Service types for acme vendor services (cf. Cuttlefish service.te)
type hal_welcome_service, hal_service_type, service_manager_type;
```

Three attributes, three jobs. `hal_service_type` groups this with every other HAL service so platform neverallow tests can reason about the set. `service_manager_type` says `servicemanager` may hand this type out at all. (Upstream additionally marks most HAL services `protected_service`; read `public/service.te` and decide for your program — for a service only `system_server` may find, the explicit find grant below is the load-bearing line either way.) Then label the name, in `device/acme/kestrel/sepolicy/vendor/service_contexts`:

```
vendor.acme.hardware.welcome.IWelcomeLight/default    u:object_r:hal_welcome_service:s0
```

That line's upstream twin is worth opening, because on a real tree you will imitate it weekly: `system/sepolicy/private/service_contexts` contains `android.hardware.automotive.vehicle.IVehicle/default  u:object_r:hal_vehicle_service:s0`. AIDL services live here. Contrast `private/hwservice_contexts`, where the same vehicle service appears in HIDL spelling, `android.hardware.automotive.vehicle::IVehicle`, labelled `hal_vehicle_hwservice`. Two files, two Binder worlds; new work is AIDL, and the micro-examples below return to the HIDL file.

Now the grants, added to `welcomed.te`:

```
# Offer the service, and let servicemanager talk back.
add_service(welcomed, hal_welcome_service)
binder_call(welcomed, servicemanager)

# Who may call it: the system-side welcome-light service, in system_server.
allow system_server hal_welcome_service:service_manager find;
binder_call(system_server, welcomed)
```

`add_service` is another macro worth one reading: it grants your domain `service_manager { add find }` *on your service type only*, and plants a neverallow so no other domain can add under your label. Notice what is not in these four lines: any permission for apps. No app domain can find this service, so no app can call the daemon directly. The system service in `system_server` is the gatekeeper, and it will enforce Android permissions on its own callers (Lecture 5's job, Lecture 9's assumption). That is the design sentence reviewers want to hear, and it is written in policy, not in a slide.

Rebuild and retest. Registration now succeeds (`service list | grep welcome` shows the interface name), but call the daemon from the system side and the second half of the stage was waiting for you:

```
avc: denied { find } for pid=1044 comm="system_server"
  name="vendor.acme.hardware.welcome.IWelcomeLight/default"
  scontext=u:r:system_server:s0 tcontext=u:object_r:hal_welcome_service:s0
  tclass=service_manager permissive=0
```

If you wrote the four lines above, you will not meet this denial; the `find` grant pre-empts it. Meet it here on paper anyway, because on a real program you will meet it the first time a *new* client domain appears, and the correct response is always the same shape: name the client domain, grant `find` on your service type, `binder_call` in the direction of the call. Adding a client is a policy decision recorded in `welcomed.te`, where the next reviewer can see the full client list in one place.

<div class="checkpoint"><strong>Checkpoint:</strong> <code>adb shell service list | grep welcome</code> prints the <code>IWelcomeLight/default</code> entry while enforcing, and removing the <code>find</code> line (try it once) reproduces the Stage 2 denial on demand. Note what <code>adb shell</code> itself proves: the shell can <em>list</em> the service but cannot <em>call</em> it, because no grant names the shell domain. That refusal is the audience design working, not a bug to fix. Policy you can break and repair on purpose is policy you understand.</div>

### Stage 3: its own things, and nothing else's

The daemon runs and answers calls. Now it tries to do its actual job, and earns three denials in a row. The stand-in writes its state file, opens the light, and sets its status property at startup, so all three arrive in the first second:

```
avc: denied { write } for pid=612 comm="welcomed" name="welcomed"
  scontext=u:r:welcomed:s0 tcontext=u:object_r:vendor_data_file:s0 tclass=dir
avc: denied { open } for pid=612 comm="welcomed" path="/dev/welcome_light"
  scontext=u:r:welcomed:s0 tcontext=u:object_r:device:s0 tclass=chr_file
avc: denied { set } for pid=612 comm="welcomed"
  scontext=u:r:welcomed:s0 tcontext=u:object_r:default_prop:s0 tclass=property_service
```

(A fourth line, for the sysfs brightness knob labelled plain `sysfs`, follows the same pattern and gets the same treatment below.) Three objects, three inherited labels (`vendor_data_file`, `device`, `default_prop`), zero of them yours. This is the moment where programs go wrong at scale, because `audit2allow` cheerfully proposes:

```
allow welcomed vendor_data_file:dir write;
allow welcomed device:chr_file open;
allow welcomed default_prop:property_service set;
```

Read what that actually buys. The first line lets `welcomed` write *any* vendor data directory on the car. The second opens *any* generically labelled device node. The third sets *any* default-labelled property. Each line would pass the build, silence the log, and hand the welcome-light daemon the keys to most of the vendor partition. This is the over-broad fix from the old version of this lecture, now visible as a diff instead of a paragraph of advice. Refuse it the same way three times: mint a dedicated type, label the object with it, allow only `welcomed`.

In `welcomed.te`, add Stage 3:

```
# Its own data directory, created by init (see welcomed.rc).
# file_type_auto_trans already grants create/read/write on the new
# type (read the macro); do not re-grant it line by line.
type welcomed_data_file, file_type, data_file_type;
file_type_auto_trans(welcomed, vendor_data_file, welcomed_data_file)

# Its own light device, and nothing else under /dev.
type welcome_light_device, dev_type;
allow welcomed welcome_light_device:chr_file rw_file_perms;

# The LED brightness knob lives on sysfs (no xattrs — hence genfs, below).
type sysfs_welcome_led, fs_type, sysfs_type;
allow welcomed sysfs_welcome_led:dir search;
allow welcomed sysfs_welcome_led:file rw_file_perms;

# Its status property: welcomed sets it, system_server may read it.
set_prop(welcomed, vendor_welcome_prop)
get_prop(system_server, vendor_welcome_prop)
```

Labels, in `file_contexts` (append to the Stage 1 file):

```
/data/vendor/welcomed(/.*)?    u:object_r:welcomed_data_file:s0
/dev/welcome_light             u:object_r:welcome_light_device:s0
```

The data-directory line has an upstream cousin to compare against: Cuttlefish labels `/data/vendor/mediadrm(/.*)?` as `mediadrm_vendor_data_file` in exactly this format, and the platform's `vendor/file.te` declares such types as `file_type, data_file_type` — which is why `welcomed_data_file` carries those two attributes. The type goes in `welcomed.te` here; on a larger program, file types often collect in a vendor `file.te`. Either home is fine. Drifting between both is not.

The property takes two files, as the anatomy table warned. Declare the type in `device/acme/kestrel/sepolicy/vendor/property.te`:

```
# welcomed's status properties (vendor.acme.welcome.*)
vendor_restricted_prop(vendor_welcome_prop)
```

`vendor_restricted_prop` is the right macro, and the choice is a design statement: vendor domains may set these properties; the system may read them but never set them (the macro plants a neverallow against `coredomain` setting them, which you can verify in `public/te_macros`). Had the system side needed to *command* the daemon through a property, that would be a different macro and, frankly, a smell — commands belong on the Binder interface from Stage 2. Then map the names, in `device/acme/kestrel/sepolicy/vendor/property_contexts`:

```
vendor.acme.welcome.    u:object_r:vendor_welcome_prop:s0
```

A prefix entry with a trailing dot covers the family. Cuttlefish's `property_contexts` shows the refinement when one member needs tighter typing: an `exact bool` or `exact string` suffix pins a single property's value type. Add exact entries when a specific property deserves it, not by default.

Last, the sysfs knob. `/sys` carries no extended attributes, so `file_contexts` cannot label it; that is what `genfs_contexts` exists for. Create `device/acme/kestrel/sepolicy/vendor/genfs_contexts`:

```
# /sys/class/leds/welcome is a symlink into this platform device path;
# genfscon labels the target, and the class path follows the link.
genfscon sysfs /devices/platform/welcome-light/leds/welcome u:object_r:sysfs_welcome_led:s0
```

Upstream's `public/file.te` already provides a `sysfs_leds` type, and refining a generic upstream type for one device is normal work: Cuttlefish's `genfs_contexts` does exactly this for its GPU and RTC nodes. We mint `sysfs_welcome_led` instead of reusing `sysfs_leds` for one reason: the allow in `welcomed.te` then names *this* light, and a future daemon that drives a different LED must ask for its own. If your program is content for both daemons to share `sysfs_leds`, that is a defensible choice too — made explicitly, in review, not by inheritance.

Rebuild, reboot, and run the full check:

```bash
m selinux_policy welcomed   # then rebuild/relaunch your Cuttlefish image
adb shell getenforce
adb shell ps -Z | grep welcomed
adb shell service list | grep welcome
adb shell ls -Z /data/vendor/welcomed /dev/welcome_light
adb shell getprop vendor.acme.welcome.state
adb logcat -b all -d | grep "avc: denied" | grep welcomed
```

Expected: `Enforcing`; the daemon in its domain; the service listed; the state file labelled `u:object_r:welcomed_data_file:s0` and the device `u:object_r:welcome_light_device:s0`; the property reads back the value the stand-in sets at startup (`ready`); and the last command prints nothing. That empty output is the lecture's diploma. Screenshot it, save the log; on a real program this capture goes in the change description.

<div class="checkpoint"><strong>Checkpoint:</strong> zero <code>avc</code> lines for <code>welcomed</code> on an enforcing boot, with the service callable from <code>system_server</code> and callable from nowhere else. Then the discipline check: you can defend every allow in <code>welcomed.te</code> in one sentence naming the stage that earned it. A line whose defence is "it stopped the denial" goes back for a dedicated type.</div>

### The complete file set

Everything above, consolidated. This is the copyable state of `device/acme/kestrel/sepolicy/vendor/` at the end of the worked example, before the micro-examples add three more files to the same directory.

`welcomed.te`:

```
# welcomed — cabin welcome-light daemon (acme Running Example)

# Stage 1: a domain of its own.
type welcomed, domain;
type welcomed_exec, exec_type, vendor_file_type, file_type;
init_daemon_domain(welcomed)

# Stage 2: the service it offers, and its one system-side client.
add_service(welcomed, hal_welcome_service)
binder_call(welcomed, servicemanager)
allow system_server hal_welcome_service:service_manager find;
binder_call(system_server, welcomed)

# Stage 3: its own data, device, LED knob, and property — nothing else's.
type welcomed_data_file, file_type, data_file_type;
file_type_auto_trans(welcomed, vendor_data_file, welcomed_data_file)

type welcome_light_device, dev_type;
allow welcomed welcome_light_device:chr_file rw_file_perms;

type sysfs_welcome_led, fs_type, sysfs_type;
allow welcomed sysfs_welcome_led:dir search;
allow welcomed sysfs_welcome_led:file rw_file_perms;

set_prop(welcomed, vendor_welcome_prop)
get_prop(system_server, vendor_welcome_prop)

# Namespace type for the keystore micro-example below.
type welcomed_key, keystore2_key_type;
```

`service.te`:

```
# Service types for acme vendor services.
type hal_welcome_service, hal_service_type, service_manager_type;
```

`property.te`:

```
# welcomed's status properties (vendor.acme.welcome.*)
vendor_restricted_prop(vendor_welcome_prop)
```

`file_contexts`:

```
/vendor/bin/welcomed           u:object_r:welcomed_exec:s0
/data/vendor/welcomed(/.*)?    u:object_r:welcomed_data_file:s0
/dev/welcome_light             u:object_r:welcome_light_device:s0
```

`service_contexts`:

```
vendor.acme.hardware.welcome.IWelcomeLight/default    u:object_r:hal_welcome_service:s0
```

`property_contexts`:

```
vendor.acme.welcome.    u:object_r:vendor_welcome_prop:s0
```

`genfs_contexts`:

```
genfscon sysfs /devices/platform/welcome-light/leds/welcome u:object_r:sysfs_welcome_led:s0
```

And in `device/acme/kestrel/BoardConfig.mk`, the line that puts all of it in the build: `BOARD_VENDOR_SEPOLICY_DIRS += device/acme/kestrel/sepolicy/vendor`. Check the build actually consumed your files before blaming policy for anything, by reading the intermediate the README points at: `out/target/product/<device>/obj/ETC/vendor_sepolicy.conf_intermediates/vendor_sepolicy.conf` should contain `type welcomed, domain;`. Grep for your own domain there first; it separates "my file was not built" from "my rule is wrong", and those two bugs waste equal time.

## Micro-examples: the rest of the directory

The worked example secured a daemon. Three neighbours complete the picture. Each is a whole artifact, shorter than the main example, anchored where a real program meets it.

### The companion app: seapp_contexts and mac_permissions.xml

`com.acme.welcome` is a privileged system app (it will render the welcome settings surface). Apps do not get domains by binary path; Zygote assigns each app process a domain from `seapp_contexts`, keyed partly by a `seinfo` string, and `seinfo` comes from the app's signing key via `mac_permissions.xml`. Two files, one chain, and both must agree or nothing matches.

In `device/acme/kestrel/sepolicy/vendor/mac_permissions.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<policy>
    <!-- Apps signed with the acme platform key that are the welcome
         app get seinfo acme_welcome. The @TAG is resolved by keys.conf;
         no certificate bytes live in this file. -->
    <signer signature="@ACME_PLATFORM">
        <package name="com.acme.welcome">
            <seinfo value="acme_welcome" />
        </package>
    </signer>
</policy>
```

And its partner, `device/acme/kestrel/sepolicy/vendor/keys.conf`:

```
[@ACME_PLATFORM]
ALL : $ACME_CERTIFICATES/acme_platform.x509.pem
```

The format is upstream's, not invented: `system/sepolicy/private/mac_permissions.xml` maps `@PLATFORM` to `seinfo=platform` the same way, and `private/keys.conf` resolves `[@PLATFORM]` to `$DEFAULT_SYSTEM_DEV_CERTIFICATE/platform.x509.pem` for all build variants. Your program substitutes its own key path; the lecture uses the `$ACME_CERTIFICATES` placeholder because printing a real program's platform certificate in a course would be a security incident, and printing a fake hex string would teach you to expect one. Which key signs what is a program decision with real ceremony around it — that ceremony, and the `certificate:` field in the app's `Android.bp`, belong to Lecture 8's rollout treatment of signing. Here, only the SELinux half is in scope: a signer maps to a seinfo.

Then the seinfo is spent, in `device/acme/kestrel/sepolicy/vendor/seapp_contexts`:

```
user=system seinfo=acme_welcome isPrivApp=true name=com.acme.welcome domain=system_app type=system_app_data_file levelFrom=all
```

Read it as a sentence: a `system`-user, privileged app, signed so that its seinfo is `acme_welcome`, with this package name, runs in the existing `system_app` domain and gets `system_app_data_file` for its data. The shape follows upstream's own lines (compare `user=system seinfo=platform isPrivApp=true name=com.android.DeviceAsWebcam …` in `private/seapp_contexts`). Note the deliberate reuse: we did not mint an app domain, because the app needs no powers `system_app` lacks. Mint one the day it does, with the same three-stage method as the daemon. Failure modes, one per file: `keys.conf` tag unresolved, the build's `insertkeys` step fails loudly; signer present but no matching `seapp_contexts` line, the app silently falls through to a later, more generic entry; `seapp_contexts` written but the app signed with a different key, `seinfo` never equals `acme_welcome` and the line is decoration. When an app "ignores its policy", check the chain in that order: key, seinfo, selector.

### The legacy neighbour: hwservice_contexts

Open `system/sepolicy/private/hwservice_contexts` at the pinned tag. It is 87 lines, and one of them is the Vehicle HAL in its older clothes:

```
android.hardware.automotive.vehicle::IVehicle    u:object_r:hal_vehicle_hwservice:s0
```

The `::` spelling and the `_hwservice` type mark the HIDL world: services registered with `hwservicemanager`, granted with `add_hwservice`, found through `hwservice_manager`. The AIDL `IVehicle/default` line from Stage 2 is the same service in the current world. You will read this file on any program with legacy HALs, and you will write in it only when you ship a HIDL HAL — in which case the pair to write is an `hwservice_contexts` line here and `add_hwservice(your_domain, your_hwservice_type)` in your `.te`, mirroring `add_service`. New interfaces, including `welcomed`'s, must not be added here; a vendor AIDL service in `hwservice_contexts` is a category error that fails as the wonderfully unhelpful "service not found". One more file in the same family deserves a sentence so it never surprises you: `vndservice_contexts` serves `vndservicemanager` for vendor-to-vendor services. Upstream's copy contains a `manager` entry and a `*` default and nothing else. It is the right home for a service only vendor processes call, and the wrong home for `welcomed`, whose client lives in `system_server`.

### A namespace of its own: keystore2_key_contexts

Suppose `welcomed` must persist one secret — say the credential it uses to authenticate light commands from the body controller — encrypted under Keystore 2. Keystore namespaces are SELinux-labelled too. Declare the label type (already done, last line of `welcomed.te`: `type welcomed_key, keystore2_key_type;`, shaped like upstream's `type vold_key, keystore2_key_type;`) and assign a namespace id in `device/acme/kestrel/sepolicy/vendor/keystore2_key_contexts`:

```
# acme namespaces — check system/sepolicy/private/keystore2_key_contexts
# for ids already taken before choosing one.
200    u:object_r:welcomed_key:s0
```

Format and id etiquette are upstream's: the platform file assigns `0`, `1`, and `100`–`120` to `su`, `shell`, `vold`, `wifi`, and friends, each type declared in `private/keystore_keys.te`. We take `200` because it is free at the pinned tag; on your tree, grep the platform file and take the next free block for your vendor, because two owners for one namespace id means two domains' keys in one labelled bucket. Scope note, stated plainly: this file gives `welcomed` its labelled namespace. The Binder path to `keystore2` (calling the keystore service, holding the right grants) is a further set of allows you can read in upstream's `keystore.te` when you implement it; a namespace without that path is a labelled drawer in a room you cannot enter, and the lecture leaves entering the room to the feature that needs it.

## The build and test loop

Everything above reduces to a loop you will run hundreds of times, so make it boring:

```bash
# 1. Edit one file. One.
# 2. Compile policy and check neverallows before building any image:
m selinux_policy
# 3. Confirm your file was consumed (guards against wrong-dir wiring):
grep -n "type welcomed" out/target/product/*/obj/ETC/vendor_sepolicy.conf_intermediates/vendor_sepolicy.conf
# 4. Build the daemon, then the image your normal Cuttlefish flow boots:
m welcomed
#    ... your Lecture 2 image build + launch_cvd ...
# 5. On the device, enforcing, always in this order:
adb shell getenforce
adb shell ps -Z | grep welcomed
adb shell ls -Z /vendor/bin/welcomed /data/vendor/welcomed /dev/welcome_light
adb logcat -b all -d | grep "avc: denied" | grep welcomed
```

Step 5's order is a diagnostic, not a ritual. Mode first, because a permissive boot makes every later observation worthless. Process label second, because a daemon in the wrong domain invalidates every file check. Object labels third, because most denials are labels wearing a permission costume. Only then the denial log, which you now read against known-good labels. When the log is empty for your domain, capture the whole sequence's output into the change description, as Stage 3 said.

Two review habits to take into every policy diff, yours or a supplier's. Read for *breadth*: any allow naming a type you did not mint (`device`, `default_prop`, `vendor_data_file` and their friends) needs a sentence explaining why a dedicated type was impossible, and "the denial stopped" is not that sentence. And read for *audience*: every `find`, `binder_call`, and property `set` names who gains power; a diff that adds a client is a design change and should be reviewed like one. `set_prop` in particular is shell-level power in a car — treat a new property grant the way you would treat a new root shell.

Where the rest of platform security went, briefly, so the old lecture's topics are accounted for. Privileged-permission allowlists (the XML that lets a priv-app hold signature permissions) are created alongside the privileged component itself, so they are taught in Lecture 8's rollout, next to the overlay and product files they ship with. Signing keys and `Android.bp` certificates likewise belong with the component and with Lecture 11's release signing, and Android Verified Boot (`BOARD_AVB_ENABLE`, vbmeta, rollback indexes) is board configuration that Lecture 11 teaches beside the OTA machinery that depends on it. This lecture's `mac_permissions.xml` is the one signing-adjacent file that stays, because `seinfo` is SELinux input, not release process.

*Verification status: every upstream path, macro, and format above was checked against `android-17.0.0_r1` (`system/sepolicy`, `device/google/cuttlefish`) and the official SELinux pages on source.android.com; the acme files are fictional and labelled as such. The enforcing Cuttlefish cycle (Tier 2) was not run in the authoring environment, per the course's verification rules — sample denials and outputs show the documented formats with representative values.*

## Annex: the stand-in daemon

Create these under `device/acme/kestrel/welcomed/`. Together they are the smallest program that earns every denial in this lecture: it registers the AIDL service, writes its state file, sets its property, touches the light, and sleeps. It is a stand-in. Lectures 4 and 5 replace its startup and interface design properly; the SELinux policy does not change when they do.

`aidl/vendor/acme/hardware/welcome/IWelcomeLight.aidl`:

```java
package vendor.acme.hardware.welcome;

// Stand-in interface (Lecture 6 teaches versioning and freezing;
// "unstable" below is a development convenience, not a shipping shape).
interface IWelcomeLight {
    int getState();
    void setEnabled(boolean enabled);
}
```

`Android.bp`:

```
aidl_interface {
    name: "vendor.acme.hardware.welcome",
    vendor_available: true,
    srcs: ["aidl/vendor/acme/hardware/welcome/*.aidl"],
    unstable: true,
    backend: {
        cpp: { enabled: false },
        java: { enabled: false },
        ndk: { enabled: true },
    },
}

cc_binary {
    name: "welcomed",
    vendor: true,
    srcs: ["main.cpp"],
    shared_libs: [
        "vendor.acme.hardware.welcome-ndk",
        "libbinder_ndk",
        "libcutils",
        "liblog",
    ],
    init_rc: ["welcomed.rc"],
}
```

`main.cpp`:

```cpp
#define LOG_TAG "welcomed"
#include <aidl/vendor/acme/hardware/welcome/BnWelcomeLight.h>
#include <android/binder_manager.h>
#include <android/binder_process.h>
#include <cutils/properties.h>
#include <log/log.h>
#include <cstdio>
#include <unistd.h>

using aidl::vendor::acme::hardware::welcome::BnWelcomeLight;
using ndk::ScopedAStatus;

class WelcomeLight : public BnWelcomeLight {
    ScopedAStatus getState(int32_t* out) override { *out = state_; return ScopedAStatus::ok(); }
    ScopedAStatus setEnabled(bool e) override { state_ = e ? 1 : 0; return ScopedAStatus::ok(); }
    int32_t state_ = 0;
};

int main() {
    ABinderProcess_setThreadPoolMaxThreadCount(0);
    auto light = ndk::SharedRefBase::make<WelcomeLight>();
    const std::string name = "vendor.acme.hardware.welcome.IWelcomeLight/default";
    if (AServiceManager_addService(light->asBinder().get(), name.c_str()) != STATUS_OK) {
        ALOGE("could not register %s", name.c_str());  // Stage 2 lives here
    }
    FILE* f = fopen("/data/vendor/welcomed/state", "w");   // Stage 3: data file
    if (f) { fputs("ready\n", f); fclose(f); }
    FILE* dev = fopen("/dev/welcome_light", "w");          // Stage 3: device node
    if (dev) { fputs("0\n", dev); fclose(dev); }
    FILE* led = fopen("/sys/class/leds/welcome/brightness", "w");  // Stage 3: sysfs knob
    if (led) { fputs("0\n", led); fclose(led); }
    property_set("vendor.acme.welcome.state", "ready");    // Stage 3: property
    ALOGI("welcomed up");
    ABinderProcess_joinThreadPool();
    return 0;
}
```

`welcomed.rc`:

```
service welcomed /vendor/bin/welcomed
    class hal
    user system
    group system

on post-fs-data
    mkdir /data/vendor/welcomed 0770 system system
```

Two stand-in simplifications to notice, because noticing them is the transferable part. The generated library name (`vendor.acme.hardware.welcome-ndk`) follows the interface name for an *unstable* interface; a frozen, versioned one carries its version, which is Lecture 6's subject. And the daemon opens the LED through `/sys/class/leds/…`, the symlink user space sees, while policy labels the `/devices/platform/…` target — genfs labels filesystems, not symlinks, which is why the `genfs_contexts` line in Stage 3 is written the way it is.

## Lab (guided)

Same exercise at both tiers, per this course's definition: secure `welcomed` from an empty `sepolicy/vendor/` directory. Tier 1 stops at files that are provably consistent; Tier 2 proves them on a running, enforcing system.

**Tier 1 — write it all (any machine with a synced tree, ~2 h).**

1. Create the directory layout and the `BoardConfig.mk` line from the worked example. Checkpoint: `grep -rn BOARD_VENDOR_SEPOLICY_DIRS device/acme/kestrel/` prints your line.
2. Before writing any rule, search what already exists: `grep -rn "welcome" system/sepolicy/public system/sepolicy/private device/google/cuttlefish/shared/sepolicy/vendor | head -n 30`. Checkpoint: you can state which types you are about to mint are genuinely new, and name one upstream type (`sysfs_leds`) you considered reusing.
3. Write Stage 1 (`welcomed.te` types + `init_daemon_domain`, the binary's `file_contexts` line). Run the static check: every type your `.te` references is declared in one of your files or is a platform type you found in step 2. Checkpoint: list each referenced type with its declaring file; no orphans.
4. Write Stage 2 (`service.te`, `service_contexts`, the four grant lines). Checkpoint: from the files alone, answer who can `add`, who can `find`, and who can do neither — without running anything.
5. Write Stage 3 (`welcomed_data_file`, device, sysfs and property types; the `file_contexts` additions; `property.te`; `property_contexts`; `genfs_contexts`). Checkpoint: the label-collision check — no path you label is already labelled in the platform or Cuttlefish `file_contexts` you searched in step 2 (colliding labels resolve unpredictably and fail as someone else's denial).
6. Add the three micro-example files (`seapp_contexts`, `mac_permissions.xml` + `keys.conf`, `keystore2_key_contexts`). Checkpoint: trace the app chain out loud — key tag, seinfo, selector line, resulting domain — and point at the exact line that breaks if the app ships signed with the wrong key.
7. Diff your directory against the consolidated set in this lecture. Checkpoint: every remaining difference is one you can explain; "theirs looked tidier" is a difference to adopt, not to shrug at.

**Tier 2 — prove it enforcing (Cuttlefish, ~2–3 h including the first image build).**

1. Apply the acme tree to your Cuttlefish target (the `BoardConfig.mk` addition and `PRODUCT_PACKAGES` line from the worked example), place the annex files, and build `m selinux_policy welcomed`. Checkpoint: `m selinux_policy` passes, which means the neverallow floor compiled with your policy in it.
2. Boot *without* the Stage 1 fix (comment `init_daemon_domain` and the `file_contexts` line into a scratch copy, rebuild policy, reboot). Checkpoint: you reproduce the Stage 1 denial and can name `scontext`, `tcontext`, `tclass` from your own log.
3. Restore Stage 1, then repeat the break-and-fix for Stage 2 (remove the `service_contexts` line) and Stage 3 (remove one Stage 3 block at a time). Checkpoint: three self-inflicted denials, three narrow fixes, each fix confined to the files its stage owns.
4. Full pass with the complete file set. Checkpoint: the Stage 3 verification sequence ends with an empty `grep welcomed` denial log on an enforcing boot, the service listed, and the property readable. Save the capture; it is the lab's deliverable.

**Tier 3 — bench (optional, 30 min).** On any real program tree you have access to, find its equivalent of each file in the anatomy table and note one place its policy is broader than what you wrote here, with the sentence you would say in review.

*Verification status: Tier 1 was performed against the pinned source during writing (searches, formats, and file shapes are the tree's own). Tier 2's cycle is doc- and source-verified but was not run on Cuttlefish in the authoring environment; treat your first boot as the verification, and keep the capture.*

<div class="checkpoint"><strong>Lab checkpoint:</strong> an enforcing boot, <code>welcomed</code> in its own domain, its service findable only by <code>system_server</code>, its files bearing types with its name in them, and a denial log that stays empty because you removed causes, not because you widened doors.</div>

## Exercises

Do these in your Tier 1 directory. Each changes files; each has a complete answer.

1. **A property outside the prefix.** Product wants `vendor.acme.light.max_level`, set by `welcomed`, read by `system_server`, settable by nobody else. Write every file change needed — or prove none is, and write the change that makes it true anyway.
2. **A debug directory.** For field diagnosis, `welcomed` must write logs to `/data/vendor/welcomed-debug/` that `dumpstate` may read, and no other daemon may write there. Create the types, labels, and allows.
3. **The supplier patch.** A supplier's fix for a boot denial is: `allow welcomed device:chr_file rw_file_perms; allow welcomed self:capability sys_module; allow system_server hal_welcome_service:service_manager add;`. Accept, amend, or reject each line, and write the amended `.te` fragment you would merge.
4. **A second app.** `com.acme.welcome.settings`, signed with the same acme platform key, needs the same seinfo as `com.acme.welcome` but must run as a normal (non-privileged) app in the generic app domain. Write the `mac_permissions.xml` and `seapp_contexts` end state, and state what you deliberately did *not* copy from the first app's line.
5. **Read before you mint.** `welcomed` needs to read the board revision from `/proc/cmdline`. A teammate proposes a new type and a `genfs_contexts` line. Check the platform policy first, then write the minimal change (or the rebuttal with its evidence).

<details class="solution" markdown="1"><summary>Show solutions</summary>

1. The `vendor.acme.welcome.` prefix entry does not cover `vendor.acme.light.…`, so the new property would fall back to a default type. Add one exact line to `property_contexts`: `vendor.acme.light.max_level    u:object_r:vendor_welcome_prop:s0 exact int`. No new type and no new allows: `set_prop(welcomed, vendor_welcome_prop)` and `get_prop(system_server, vendor_welcome_prop)` already name the type, and `vendor_restricted_prop`'s neverallow keeps every coredomain except `init` from setting it. The lesson is the lookup order: check what your existing prefix already covers before minting anything.
2. In `welcomed.te`: `type welcomed_debug_data_file, file_type, data_file_type;` plus `file_type_auto_trans(welcomed, vendor_data_file, welcomed_debug_data_file)` (the macro already grants create/read/write on the new type), and a read grant for the collector, `r_dir_file(dumpstate, welcomed_debug_data_file)`. In `file_contexts`: `/data/vendor/welcomed-debug(/.*)?    u:object_r:welcomed_debug_data_file:s0`. Reject the shortcut of letting `dumpstate` (or worse, `shell`) write: the type's auto-transition names `welcomed` as the only creator, so write access follows the label, not a list of favours.
3. Reject line one as written: `device` is every generically labelled node on the car; `welcomed` already has its dedicated `welcome_light_device` grant, so the correct response to the boot denial was a label, and this line is the Stage 3 over-broad fix returning in a trench coat. Reject line two outright: loading kernel modules (`sys_module`) is never a welcome-light requirement; a denial that suggests it means the real cause is elsewhere and should be re-read. Reject line three: `system_server` *adding* the service inverts the design — the server adds its own service (`add_service` already grants exactly that to `welcomed`); the client needs `find`, which is already granted. Amended fragment to merge: *nothing*. The correct change is the missing `file_contexts` or `service_contexts` label that caused the boot denial, and the exercise is writing that sentence in the review.
4. In `mac_permissions.xml`, add a second package stanza under the same signer: `<package name="com.acme.welcome.settings"><seinfo value="acme_welcome" /></package>`. In `seapp_contexts`, add *no* line for this package. The first app's line is name- and `isPrivApp`-specific; with no matching name line, the settings app falls through to the generic app entries and runs in the normal app domain with its seinfo attached but unused for domain selection. What you did not copy: `isPrivApp=true`, `domain=system_app`, and `type=system_app_data_file`. Seinfo is an input, not a privilege; the domain is chosen per app, per need.
5. The rebuttal wins. `system/sepolicy/private/genfs_contexts` already labels `/proc/cmdline` as `proc_cmdline`, and `public/file.te` declares it, so the minimal change is one allow in `welcomed.te`: `allow welcomed proc_cmdline:file r_file_perms;`. Minting a second type for the same node creates a labelling collision between the platform and vendor genfs entries, which resolves by ordering and fails as an intermittent denial on someone else's desk. The general rule the teammate skipped: search platform policy for the object before declaring anything — the Stage 1 habit, applied to files instead of binaries.

</details>

## Go deeper: kernel and app pointers

SELinux is enforced by the kernel and configured from user space, so the [kernel path]({{ '/kernel-path/' | relative_url }}) step 1 is the honest next rung when a denial turns out to be a driver labelling problem. On the app side, the seinfo chain you built meets Android permissions (protection levels, signature permissions) in the [app path]({{ '/app-path/' | relative_url }}) steps 1–2, and Lecture 12 treats this lecture's enforcing, zero-denial run as what it is: a test.

<div class="callout"><p><strong>Working with AI agents:</strong> paste a denial to an agent and it will write you an <code>allow</code>. That is precisely the danger this lecture trained against. Use the agent as the Stage 3 opponent: have it explain the denial, have it find related policy in your tree, then make it argue <em>against</em> the rule you drafted — which existing type did you overlook, who else gains access, what breaks under a neverallow. Write the final line yourself. Policy you cannot defend in one sentence is not yours yet, no matter who typed it.</p></div>
