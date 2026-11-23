#!/usr/bin/env node
process.env.CAPTURE_FORWARD_SCRIPT = 'capture:site-content-tree';
import('./_forward-to-bq.mjs');
