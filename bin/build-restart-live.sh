#!/usr/bin/env bash
set -Eeuo pipefail

demo_home=${DEMO_HOME:-/opt/tuonghoa/demo}
artifact_name=${DEMO_ARTIFACT_NAME:-demo-0.0.1-SNAPSHOT.jar}
jar_file="$demo_home/target/$artifact_name"
pid_file=${DEMO_PID_FILE:-$demo_home/demo-live.pid}
control_script="$demo_home/bin/demo-live.sh"
shutdown_timeout=${DEMO_SHUTDOWN_TIMEOUT:-30}
frontend_dir=${DEMO_FRONTEND_DIR:-$demo_home/bom-frontend}
frontend_control_script="$demo_home/bin/bom-frontend-live.sh"
frontend_dist_dir="$frontend_dir/dist"
frontend_live_dir=/var/www/html/bom-inventory
portal_home=${PORTAL_HOME:-/opt/tuonghoa/portal}
portal_control_script=${PORTAL_CONTROL_SCRIPT:-$portal_home/bin/portal-live.sh}
portal_shutdown_timeout=${PORTAL_SHUTDOWN_TIMEOUT:-30}
portal_was_running=false

if [[ ! $shutdown_timeout =~ ^[0-9]+$ ]] || (( shutdown_timeout < 1 )); then
    echo "DEMO_SHUTDOWN_TIMEOUT must be a positive integer." >&2
    exit 2
fi
if [[ ! $portal_shutdown_timeout =~ ^[0-9]+$ ]] || (( portal_shutdown_timeout < 1 )); then
    echo "PORTAL_SHUTDOWN_TIMEOUT must be a positive integer." >&2
    exit 2
fi
if [[ ! -x $control_script ]]; then
    echo "Demo control script is missing or not executable: $control_script" >&2
    exit 1
fi
if [[ ! -x $demo_home/mvnw ]]; then
    echo "Maven wrapper is missing or not executable: $demo_home/mvnw" >&2
    exit 1
fi
if [[ ! -f $frontend_dir/package.json ]]; then
    echo "Frontend project is missing: $frontend_dir/package.json" >&2
    exit 1
fi
if [[ ! -x $frontend_control_script ]]; then
    echo "Frontend control script is missing or not executable: $frontend_control_script" >&2
    exit 1
fi
if [[ ! -x $portal_control_script ]]; then
    echo "Portal control script is missing or not executable: $portal_control_script" >&2
    exit 1
fi

restore_portal() {
    local result=$?
    trap - EXIT INT TERM
    if [[ $portal_was_running == true ]]; then
        echo "Restarting portal after demo build..."
        if ! "$portal_control_script" start; then
            echo "Failed to restart the portal." >&2
            (( result == 0 )) && result=1
        elif ! "$portal_control_script" status; then
            echo "Portal was started but is not running." >&2
            (( result == 0 )) && result=1
        fi
    fi
    exit "$result"
}

trap restore_portal EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if "$portal_control_script" status >/dev/null 2>&1; then
    portal_was_running=true
    echo "Temporarily stopping portal for the demo build..."
    "$portal_control_script" stop
    deadline=$((SECONDS + portal_shutdown_timeout))
    while "$portal_control_script" status >/dev/null 2>&1; do
        if (( SECONDS >= deadline )); then
            echo "Portal did not stop within ${portal_shutdown_timeout}s; build cancelled." >&2
            exit 1
        fi
        sleep 1
    done
else
    echo "Portal is already stopped; it will remain stopped."
fi

declare -a demo_pids=()

add_pid() {
    local candidate=$1 existing
    [[ $candidate =~ ^[0-9]+$ ]] || return 0
    kill -0 "$candidate" 2>/dev/null || return 0
    for existing in "${demo_pids[@]:-}"; do
        [[ $existing == "$candidate" ]] && return 0
    done
    demo_pids+=("$candidate")
}

is_demo_process() {
    local candidate=$1 command_line
    [[ -r /proc/$candidate/cmdline ]] || return 1
    command_line=$(tr '\0' ' ' < "/proc/$candidate/cmdline")
    [[ $command_line == *"-jar $jar_file"* || $command_line == *"$artifact_name"* ]]
}

if [[ -f $pid_file ]]; then
    saved_pid=$(<"$pid_file")
    if [[ $saved_pid =~ ^[0-9]+$ ]] && is_demo_process "$saved_pid"; then
        add_pid "$saved_pid"
    fi
fi

while IFS= read -r candidate; do
    [[ $candidate == "$$" ]] && continue
    is_demo_process "$candidate" && add_pid "$candidate"
done < <(pgrep -f -- "$artifact_name" || true)

if (( ${#demo_pids[@]} > 0 )); then
    echo "Stopping current $artifact_name PID(s): ${demo_pids[*]}"
    kill "${demo_pids[@]}"
    deadline=$((SECONDS + shutdown_timeout))
    while (( SECONDS < deadline )); do
        still_running=false
        for candidate in "${demo_pids[@]}"; do
            if kill -0 "$candidate" 2>/dev/null; then
                still_running=true
                break
            fi
        done
        [[ $still_running == false ]] && break
        sleep 1
    done
    for candidate in "${demo_pids[@]}"; do
        if kill -0 "$candidate" 2>/dev/null; then
            echo "Demo PID $candidate did not stop within ${shutdown_timeout}s; build cancelled." >&2
            exit 1
        fi
    done
else
    echo "No running process found for $artifact_name."
fi
rm -f -- "$pid_file"

echo "Building frontend: $frontend_dir"
"$frontend_control_script" stop
cd "$frontend_dir"
npm run build
mkdir -p "$frontend_live_dir/ipad4"
cp -a "$frontend_dist_dir/." "$frontend_live_dir/"
cp -a "$frontend_dist_dir/ipad4/." "$frontend_live_dir/ipad4/"
"$frontend_control_script" start

echo "Building backend artifact: $artifact_name"
cd "$demo_home"
./mvnw -DskipTests clean package

if [[ ! -f $jar_file ]]; then
    echo "Build completed without the expected artifact: $jar_file" >&2
    exit 1
fi

"$control_script" start
"$control_script" status
echo "Demo replaced successfully: $jar_file"
