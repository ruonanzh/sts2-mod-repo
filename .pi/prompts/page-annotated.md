---
description: Read player comments and choices on one STS2 mod page
argument-hint: "[page path]"
---
The player left feedback on a mod page.

Page path: ${1:-not supplied}

1. If no path was supplied, find `your_mods/*/.preview/*.modpage.html`. Continue only when exactly one candidate exists. Otherwise, ask which page to read.
2. Read that page and the comments and form values in its `pi-page-feedback` block.
3. Decide which proposal, mod, or explanation changes are appropriate from the feedback and current request.
4. Rewrite that same page without the old `pi-page-feedback` block. Do not edit the old block in place.
5. Follow `mod-page` and `how-to-speak` when presenting the revision.
