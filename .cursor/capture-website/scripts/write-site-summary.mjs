#!/usr/bin/env node
process.env.CAPTURE_FORWARD_SCRIPT = 'capture:site-summary';
import('./_forward-to-bq.mjs');
