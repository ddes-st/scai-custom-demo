#!/usr/bin/env node
process.env.CAPTURE_FORWARD_SCRIPT = 'capture:section-plans';
import('./_forward-to-bq.mjs');
