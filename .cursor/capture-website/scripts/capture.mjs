#!/usr/bin/env node
process.env.CAPTURE_FORWARD_SCRIPT = 'capture:webpage';
import('./_forward-to-bq.mjs');
