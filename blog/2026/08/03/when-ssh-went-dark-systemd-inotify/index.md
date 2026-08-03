---
title: "When SSH Went Dark: How an inotify Limit Confused systemd"
date: "2026-08-03"
author: "Kadek Surya Mahardika"
tags: ["linux", "systemd", "inotify", "incident-response"]
description: "How an exhausted inotify instance limit caused a systemd re-exec to lose track of the root mount and stop healthy services."
---

# When SSH Went Dark: How an inotify Limit Confused systemd

This came from a real incident at my workplace on a Hetzner dedicated server.

The first thing we noticed was simple: SSH stopped working. The server still looked alive, but new connections failed. We opened the Hetzner KVM console to investigate, but that appeared to hang too. At that point, we did not know whether we were dealing with a networking issue, an out-of-memory event, or a host that had become unhealthy.

The only useful clue was a set of OOM-killer messages in the remaining kernel logs, so that became the leading theory. With no reliable way into the server, we eventually power-cycled it. The machine came back normally.

Later, when we reconstructed the incident, it turned out the OOM theory was wrong. The real trigger was a routine automatic upgrade.

## It started with an OpenSSL update

Ubuntu's unattended upgrades installed a new version of `libssl3` and `openssl`. After the upgrade, `needrestart` triggered:

```bash
systemctl daemon-reexec
```

This is more invasive than a normal reload. systemd remains PID 1, but replaces its own process image and rebuilds its internal state. That includes the filesystem watchers it uses to monitor parts of the system.

That is where the failure started.

## What is inotify?

`inotify` is a Linux API that lets applications watch files and directories for changes. Services use it to detect things such as configuration updates, new files, or changes related to mount state.

Linux limits how many inotify instances a user can create. The relevant setting is:

```text
fs.inotify.max_user_instances
```

The important detail is that the limit is shared by all processes running under the same user ID. On this server, many system processes ran as `root`, so they all shared the UID 0 budget. The limit was still set to the Ubuntu default of 128, and it had already been exhausted.

## systemd lost track of the root mount

During the re-exec, systemd tried to recreate the watchers it uses to monitor the machine, including mount state. That failed with errors like:

```text
Failed to create timezone change event source: Too many open files
Failed to acquire watch file descriptor: Too many open files
Failed to drain libmount events: Invalid argument
```

The message "Too many open files" was misleading here. PID 1 had not exhausted its normal file-descriptor limit. The resource that had run out was the inotify instance limit for UID 0.

The root filesystem was still mounted and working in the kernel, but systemd's internal state no longer matched reality. systemd represents the root mount as:

```text
-.mount
```

After the failed re-exec, systemd decided that `-.mount` was inactive, so it tried to mount `/` again. That failed because `/` was already mounted. systemd then marked `-.mount` as failed.

The sequence was roughly:

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

`sshd` did not crash. systemd stopped it.

The SSH service depends on the root mount because it needs `/run/sshd`. Once systemd believed that `-.mount` had failed, it enforced that dependency and sent `SIGTERM` to `sshd`. The same cascade also stopped journald, PostgreSQL, nginx, fail2ban, and containerd.

This is also why the services stayed down. They had not crashed unexpectedly, so normal restart policies did not apply. systemd had stopped them deliberately.

From systemd's point of view, the behavior was internally consistent: its model said the root mount had failed, so dependent services had to stop. The problem was that the model was wrong.

## Why it looked like an OOM

The surviving kernel logs contained repeated OOM-killer messages involving Velero. Those messages were real, but they were limited to the container's own memory cgroup. There was no evidence of a system-wide OOM, kernel panic, or total memory exhaustion on the host.

The OOM messages were misleading. They were especially convincing because journald had already been stopped, which meant most of the logs needed to understand the incident were missing.

## Why the reboot fixed it

The reboot forced systemd to rebuild its state from scratch. This time, the mount state was detected correctly and the required watchers were created normally. SSH and journald came back with the rest of the system.

We raised the inotify limits and made the change persistent:

```text
fs.inotify.max_user_instances = 1024
fs.inotify.max_user_watches = 1048576
```

## The interesting part

The root filesystem never failed. The kernel still had `/` mounted. What failed was systemd's view of the machine.

Once that view became wrong, systemd acted on it and shut down healthy services. The incident was not really about SSH, and it was not really about a broken filesystem. It was about a controller making the wrong decision because its internal model had drifted away from reality.
