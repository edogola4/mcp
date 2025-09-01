#!/bin/bash
# Start the server with debug logging
export DEBUG=*
export NODE_ENV=development
node --trace-warnings -r ts-node/register src/index.ts 2>&1 | tee server-debug.log
