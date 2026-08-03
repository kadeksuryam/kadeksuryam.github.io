---
title: "When SSH Went Dark: How an inotify Limit Confused systemd"
date: "2026-08-03"
author: "Kadek Surya Mahardika"
tags: ["linux", "systemd", "inotify", "incident-response"]
description: "How an exhausted inotify instance limit caused a systemd re-exec to lose track of the root mount and stop healthy services."
---

# When SSH Went Dark: How an inotify Limit Confused systemd

This happened on a Hetzner dedicated server at work.

We noticed it in the most obvious way: SSH stopped accepting connections. The server was still up, but we could not get in. We opened the Hetzner KVM console, and that appeared to hang too. At that point we had three plausible explanations: a network problem, an out-of-memory event, or a host that was simply falling over.

The surviving kernel logs gave us one clue: a run of OOM-killer messages. With no reliable way into the machine, that became our working theory and we eventually power-cycled it. The server came back normally.

Only afterward, when we reconstructed the timeline, did we realize that the OOM messages had sent us in the wrong direction. The trigger was a routine automatic upgrade.

## It started with an OpenSSL update

Ubuntu's unattended upgrades installed a new version of `libssl3` and `openssl`. As part of the cleanup, `needrestart` ran:

```bash
systemctl daemon-reexec
```

`daemon-reexec` is more invasive than the usual `daemon-reload`. systemd remains PID 1, but replaces its own process image and rebuilds its internal state. That includes the filesystem watchers it uses to monitor the machine.

That re-exec was the turning point.

## What is inotify?

If you have not run into it before, `inotify` is the Linux API applications use to watch files and directories for changes. Services rely on it for configuration updates, new files, and changes in mount state.

Linux limits how many inotify instances a user can create. The relevant setting is:

```text
fs.inotify.max_user_instances
```

The catch for us was that this limit is shared by every process running under the same user ID. Many system processes ran as `root`, so they all drew from the same UID 0 budget. The server was still using Ubuntu's default limit of 128. By the time systemd needed another instance, there were none left.

## systemd lost track of the root mount

During the re-exec, systemd had to recreate its watchers, including the ones used for mount state. It could not, and logged errors like:

```text
Failed to create timezone change event source: Too many open files
Failed to acquire watch file descriptor: Too many open files
Failed to drain libmount events: Invalid argument
```

"Too many open files" initially pointed us toward the usual file-descriptor limits. That was not the problem. PID 1 still had file descriptors available; UID 0 had run out of inotify instances.

The root filesystem was still mounted and working in the kernel, but systemd's internal state no longer matched reality. It represents the root mount with the slightly odd-looking unit name:

```text
-.mount
```

After the failed re-exec, systemd believed that `-.mount` was inactive and tried to mount `/` again. Of course that failed: `/` was already mounted. systemd took the failed command at face value and marked `-.mount` as failed.

This is the sequence we eventually pieced together:

```text
automatic OpenSSL upgrade
→ needrestart triggers daemon-reexec
→ systemd cannot recreate inotify watchers
→ mount tracking breaks
→ systemd thinks / is not mounted
→ it tries to mount / again
→ the mount command fails
→ -.mount is marked failed
```

## Why SSH stopped

Here is the part that initially felt backward: `sshd` did not crash. systemd stopped it.

The SSH service depends on the root mount, partly because it needs `/run/sshd`. Once systemd believed that `-.mount` had failed, it enforced the dependency and sent `SIGTERM` to `sshd`. The same cascade took down journald, PostgreSQL, nginx, fail2ban, and containerd.

That also explains why the services stayed down. They had not crashed, so their normal restart policies never came into play. From systemd's perspective, stopping them was intentional.

Given the state systemd believed, stopping the services made sense. The bad decision came from a bad picture of the machine, not from a random failure in `sshd`.

## Why it looked like an OOM

We initially blamed the OOM messages involving Velero because they were the clearest evidence we had. They were real, but they belonged to the container's own memory cgroup. We found no sign of a host-wide OOM, kernel panic, or total memory exhaustion.

The logs were not lying. They were describing a different problem. By then systemd had already stopped journald, so much of the evidence we needed for the actual incident was gone. That made the noisy clue much easier to trust than the missing one.

## Why the reboot fixed it

The power cycle fixed the state, not the underlying limit. systemd started clean, detected the root mount correctly, and recreated the watchers it needed. SSH and journald came back with the rest of the machine.

We raised the inotify limits and made the change persistent:

```text
fs.inotify.max_user_instances = 1024
fs.inotify.max_user_watches = 1048576
```

## What stayed with me

The root filesystem never failed. The kernel knew that `/` was mounted; systemd had lost that fact.

We went into the incident looking for a dead SSH daemon, memory exhaustion, or a broken host. The actual failure sat one layer higher: PID 1 had the wrong picture of a healthy system and acted on it. Once we understood that, the service shutdowns stopped looking random.

The practical fix was raising two limits. The lesson I kept was to take "Too many open files" less literally during a systemd re-exec. Next time, I will check the inotify budget before assuming the process has simply run out of file descriptors.
