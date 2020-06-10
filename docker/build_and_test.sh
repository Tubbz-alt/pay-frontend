#!/usr/bin/env bash
set -ueo pipefail
rm -rf node_modules
cp -R /tmp/node_modules /app/node_modules
npm run compile &&\
npm run lint
npm test -- --forbid-only --forbid-pending
