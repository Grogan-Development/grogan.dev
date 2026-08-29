---
name: nero-desktop
description: Drive the shared agent seat (Chromium on a real display) — screenshots, clicks, typing, keys. Screenshots you capture are attached to your next model turn.
---

# The agent seat (nero-desktop)

You have a real desktop seat: openbox on X display `:1` with Chromium
running, visible to the human in the Nero preview tab. It is a **shared**
seat — the human can take the mouse and keyboard at any moment.

## Commands

```
nero-desktop shot [--out PATH]     # full-screen PNG screenshot
nero-desktop click X Y [--button left|middle|right] [--double]
nero-desktop type TEXT             # types text into the focused control
nero-desktop key KEY [KEY...]      # e.g. Return, ctrl+l, Tab, shift+Tab
nero-desktop lock                  # take exclusive seat control (agent turn)
nero-desktop hold SECONDS          # keep holding the seat across waits
```

## How to use it well

1. **Always `shot` first** after any click/type — the screen is your only
   feedback. Coordinates in `click` are screen pixels at the seat's
   resolution; take them from your latest screenshot, not from memory.
2. Shots are **attached as images on your next model request** (up to 8 per
   turn). You do not see them inline; act on them next turn.
3. To type into a page, focus the field first: `nero-desktop click X Y` then
   `nero-desktop type TEXT`. For URLs, focus the address bar
   (`ctrl+l` when Chromium is focused) before typing.
4. Be a good seat citizen: the seat lock serializes you against the human.
   If a shot shows the human mid-action, wait and re-shot rather than
   fighting the cursor.
5. Long waits (page loads) beat the purpose — shot again after `sleep 2` in
   the same bash call: `sleep 2; nero-desktop shot`.
