#!/usr/bin/env bash

set -u
set -o pipefail

STRICT="${STRICT:-0}"
SKIP_PACKAGE="${SKIP_PACKAGE:-0}"
INSTALL_APP="${INSTALL_APP:-0}"
MAX_ITERATIONS="${MAX_ITERATIONS:-1}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --strict)
      STRICT="1"
      shift
      ;;
    --skip-package)
      SKIP_PACKAGE="1"
      shift
      ;;
    --install-app)
      INSTALL_APP="1"
      shift
      ;;
    --iterations)
      MAX_ITERATIONS="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      exit 2
      ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOG_DIR="${LOG_ROOT:-.tmp/qa-logs}/$TIMESTAMP"
mkdir -p "$LOG_DIR"

SUMMARY_MD="$LOG_DIR/summary.md"
SUMMARY_TXT="$LOG_DIR/summary.txt"

declare -a STAGE_NAMES=()
declare -a STAGE_CODES=()
declare -a STAGE_LOGS=()

run_stage() {
  local stage_name="$1"
  local stage_cmd="$2"
  local log_file="$LOG_DIR/${#STAGE_NAMES[@]}-${stage_name// /_}.log"

  echo "\n=============================="
  echo "[QA] $stage_name"
  echo "[CMD] $stage_cmd"
  echo "=============================="

  set +e
  bash -lc "$stage_cmd" > >(tee "$log_file") 2>&1
  local code=$?
  set -e

  STAGE_NAMES+=("$stage_name")
  STAGE_CODES+=("$code")
  STAGE_LOGS+=("$log_file")

  if [[ "$code" -eq 0 ]]; then
    echo "[PASS] $stage_name"
  else
    echo "[FAIL] $stage_name (exit=$code)"
    if [[ "$STRICT" -eq 1 ]]; then
      return "$code"
    fi
  fi

  return 0
}

run_pipeline_once() {
  local iteration="$1"
  echo "\n########################################"
  echo "# Full Auto QA Iteration: $iteration/$MAX_ITERATIONS"
  echo "########################################"

  run_stage "TypeScript" "npx tsc --noEmit" || return $?
  run_stage "ESLint" "npm run lint" || return $?
  run_stage "Jest Unit" "npm test -- --runInBand" || return $?
  run_stage "Contract Tests" "npm run test:contract -- --runInBand" || return $?
  run_stage "Integration Tests" "npm run test:integration -- --runInBand" || return $?

  if [[ "$SKIP_PACKAGE" -eq 0 ]]; then
    run_stage "Package arm64" "env -u HTTPS_PROXY -u HTTP_PROXY -u ALL_PROXY -u https_proxy -u http_proxy -u all_proxy npm run package -- --arch=arm64" || return $?
  else
    echo "[SKIP] Package arm64"
  fi

  if [[ "$INSTALL_APP" -eq 1 ]]; then
    run_stage "Install App" "APP_SRC='out/HiveMind-darwin-arm64/HiveMind.app'; APP_DST='/Applications/HiveMind.app'; TS=\$(date +%Y%m%d-%H%M%S); if [ -d \"\$APP_DST\" ]; then mv \"\$APP_DST\" \"/Applications/HiveMind.app.bak-\$TS\"; fi; cp -R \"\$APP_SRC\" \"\$APP_DST\"" || return $?
  fi

  return 0
}

set +e
ITERATION=1
while [[ "$ITERATION" -le "$MAX_ITERATIONS" ]]; do
  run_pipeline_once "$ITERATION"
  PIPELINE_CODE=$?

  if [[ "$PIPELINE_CODE" -eq 0 ]]; then
    break
  fi

  if [[ "$ITERATION" -lt "$MAX_ITERATIONS" ]]; then
    echo "\n[INFO] Iteration $ITERATION failed, starting next iteration..."
  fi

  ITERATION=$((ITERATION + 1))
done
set -e

FAIL_COUNT=0
{
  echo "Full Auto QA Summary"
  echo "Timestamp: $TIMESTAMP"
  echo "Strict mode: $STRICT"
  echo "Iterations: $ITERATION"
  echo
  for i in "${!STAGE_NAMES[@]}"; do
    name="${STAGE_NAMES[$i]}"
    code="${STAGE_CODES[$i]}"
    log="${STAGE_LOGS[$i]}"
    status="PASS"
    if [[ "$code" -ne 0 ]]; then
      status="FAIL"
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
    printf "%s | exit=%s | %s | %s\n" "$name" "$code" "$status" "$log"
  done
} | tee "$SUMMARY_TXT"

{
  echo "# Full Auto QA Summary"
  echo
  echo "- Timestamp: \`$TIMESTAMP\`"
  echo "- Strict mode: \`$STRICT\`"
  echo "- Iterations: \`$ITERATION\`"
  echo "- Fail count: \`$FAIL_COUNT\`"
  echo
  echo "| Stage | Exit Code | Status | Log |"
  echo "| --- | ---: | --- | --- |"
  for i in "${!STAGE_NAMES[@]}"; do
    name="${STAGE_NAMES[$i]}"
    code="${STAGE_CODES[$i]}"
    log="${STAGE_LOGS[$i]}"
    status="✅ PASS"
    if [[ "$code" -ne 0 ]]; then
      status="❌ FAIL"
    fi
    echo "| $name | $code | $status | $log |"
  done
} > "$SUMMARY_MD"

echo "\n[INFO] Summary TXT: $SUMMARY_TXT"
echo "[INFO] Summary MD : $SUMMARY_MD"

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  if [[ "$STRICT" -eq 1 ]]; then
    exit 1
  fi
  exit 0
fi

exit 0

