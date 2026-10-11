#!/bin/sh
# Runs the collection inside the `newman` service of docker-compose.ci.yml:
#   docker compose -f docker-compose.yml -f docker-compose.ci.yml run --rm newman \
#     tests/postman/run-ci.sh <report-name> [extra newman options]
# Writes newman/<report-name>.html (git-ignored). Core is reachable inside the network, so T16
# runs too (coreUrl).
set -eu

report="$1"
shift

npm install --global --silent --no-audit --no-fund newman-reporter-htmlextra@1 > /dev/null
mkdir -p newman

exec newman run tests/postman/OpenDoor.postman_collection.json \
  --environment tests/postman/ci.postman_environment.json \
  --env-var "demoPassword=${DEMO_PASSWORD:?}" \
  --env-var "coreUrl=http://core-api:8001" \
  --reporters cli,htmlextra \
  --reporter-htmlextra-export "newman/${report}.html" \
  --reporter-htmlextra-title "OpenDoor API tests (${report})" \
  "$@"
