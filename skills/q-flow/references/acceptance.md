# Browser acceptance on request

Run these checks only when the user asks to see or check the rendering, the delivery includes Viewer changes, or a receipt reports rendering diagnostics. Ordinary delivery stops at input validation, generation and output validation; its reply says `Browser acceptance: not performed`.

- Open the real generated page at 1440×900 with the browser tooling available in the current client; for a collection, inspect every requested diagram type: one screenshot per view for first-screen readability, containment and console errors. Repeat only after correcting an observed issue. Review spacing, type-specific composition and proportional edge motion: nodes, routes, arrows and stroke widths scale together.
- Every ordinary card carries its module wash; a plain card is a defect to fix in the graph. Two modules sharing a colour is expected once a collection has many modules; the module chip text tells them apart.
- For sequence delivery, check the rendered activation bars and nesting, matching call/return colors and IDs, evidenced fragment nesting, solid sync / open async / dashed return notation, and visible flow that preserves those line types; check static exports for the same bars, pairing and fragments. A valid graph without execution data does not satisfy an activation-bar request.
- SVG/PNG exports check current geometry and actual browser glyph bounds after fonts load. Invalid layout remains an editable JSON draft. PNG rejects blank encoding and dimensions above 32767px or 64 million pixels without reducing resolution; SVG is assessed independently.
- An automation HTTP server must close in the same process's `finally`. If no browser tool is available, report generation and graph validation separately and mark browser acceptance incomplete; do not claim visual or interaction checks passed.

Report the outcome next to the validation result: what was opened, at which size, what was checked per view, and anything corrected and re-checked. When a check could not run, say so; never present generation and validation as visual acceptance.
