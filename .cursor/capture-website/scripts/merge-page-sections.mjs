#!/usr/bin/env node
process.env.CAPTURE_FORWARD_SCRIPT = 'capture:merge-sections';
import('./_forward-to-bq.mjs');
