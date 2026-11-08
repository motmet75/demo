#!/usr/bin/env bash
set -Eeuo pipefail

demo_home=${DEMO_HOME:-/opt/tuonghoa/demo}
frontend_home=${DEMO_FRONTEND_DIR:-$demo_home/bom-frontend}
pid_file=${DEMO_FRONTEND_PID_FILE:-$demo_home/bom-frontend-live.pid}
log_file=${DEMO_FRONTEND_LOG_FILE:-$demo_home/bom-frontend-live.log}
host=${DEMO_FRONTEND_HOST:-127.0.0.1}
port=${DEMO_FRONTEND_PORT:-5173}
frontend_live_dir=${DEMO_FRONTEND_LIVE_DIR:-/var/www/html/bom-inventory}
demo_control_script="$demo_home/bin/demo-live.sh"
portal_home=${PORTAL_HOME:-/opt/tuonghoa/portal}
portal_control_script=${PORTAL_CONTROL_SCRIPT:-$portal_home/bin/portal-live.sh}
deploy_stop_timeout=${DEMO_DEPLOY_STOP_TIMEOUT:-40}
vite_bin="$frontend_home/node_modules/vite/bin/vite.js"
preferred_node=/home/jason/.nvm/versions/node/v20.20.0/bin/node
node_bin=${DEMO_FRONTEND_NODE:-}
if [[ -z $node_bin ]]; then
    if [[ -x $preferred_node ]]; then
        node_bin=$preferred_node
    else
        node_bin=node
    fi
fi

running_pid() {
    [[ -f $pid_file ]] || return 1
    local pid command_line
    pid=$(<"$pid_file")
    [[ $pid =~ ^[0-9]+$ ]] || return 1
    kill -0 "$pid" 2>/dev/null || return 1
    [[ -r /proc/$pid/cmdline ]] || return 1
    command_line=$(tr '\0' ' ' < "/proc/$pid/cmdline")
    [[ $command_line == *"$vite_bin preview"* ]] || return 1
    echo "$pid"
}


# Only deploy/restart manages both Java services. Plain start/stop/status
# retain their original Vite-preview behavior for build-restart-live.sh.
deploy_started=false
preview_was_running=false

wait_until_stopped() {
    local launcher=$1 label=$2
    local i
    for ((i=0; i<deploy_stop_timeout; i++)); do
        if ! "$launcher" status >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
    done
    echo "$label did not stop within ${deploy_stop_timeout}s; aborting deployment." >&2
    return 1
}

deploy_restore() {
    local result=$?
    trap - EXIT INT TERM
    if [[ $deploy_started == true ]]; then
        # Always restore both JARs, including after npm or copying fails.
        # Demo launcher keeps its Google Vision OCR configuration.
        echo "Starting Demo JAR..."
        if ! "$demo_control_script" start; then
            echo "Demo failed to start. Check $demo_home/demo-live.log" >&2
            result=1
        fi
        echo "Starting Portal JAR..."
        if ! "$portal_control_script" start; then
            echo "Portal failed to start. Check the Portal log." >&2
            result=1
        fi
        if [[ $preview_was_running == true ]]; then
            echo "Restoring previously running Vite preview..."
            if ! "$0" start; then
                echo "Failed to restore BOM frontend Vite preview." >&2
                result=1
            fi
        fi
        if ! "$demo_control_script" status; then result=1; fi
        if ! "$portal_control_script" status; then result=1; fi
        if [[ $result -eq 0 ]]; then
            echo "Frontend deployed to $frontend_live_dir. Both JARs are running."
        else
            echo "Deploy failed or a service could not be restored. Check logs." >&2
        fi
    fi
    exit "$result"
}

copy_dist_to_live() {
    local dist_dir="$frontend_home/dist"
    # dist/. includes all assets and optionally ipad4 automatically.
    if [[ -d $frontend_live_dir && -w $frontend_live_dir ]] ||
       [[ ! -e $frontend_live_dir && -w $(dirname "$frontend_live_dir") ]]; then
        mkdir -p -- "$frontend_live_dir"
        cp -a -- "$dist_dir/." "$frontend_live_dir/"
    else
        command -v sudo >/dev/null 2>&1 || {
            echo "No write access to $frontend_live_dir and sudo is unavailable." >&2
            return 1
        }
        sudo mkdir -p -- "$frontend_live_dir"
        sudo cp -a -- "$dist_dir/." "$frontend_live_dir/"
    fi
}

deploy_frontend() {
    [[ $deploy_stop_timeout =~ ^[0-9]+$ ]] && ((deploy_stop_timeout >= 1)) || {
        echo "DEMO_DEPLOY_STOP_TIMEOUT must be a positive integer." >&2
        return 2
    }
    [[ $frontend_live_dir == /* && $frontend_live_dir != / ]] || {
        echo "DEMO_FRONTEND_LIVE_DIR must be a non-root absolute path." >&2
        return 2
    }
    for launcher in "$portal_control_script" "$demo_control_script"; do
        [[ -x $launcher ]] || { echo "Missing executable launcher: $launcher" >&2; return 1; }
    done
    [[ -f $demo_home/target/${DEMO_ARTIFACT_NAME:-demo-0.0.1-SNAPSHOT.jar} ]] || {
        echo "Demo JAR missing. This frontend-only deploy will not rebuild Java." >&2
        return 1
    }
    [[ -f $frontend_home/package.json ]] || {
        echo "Missing $frontend_home/package.json" >&2
        return 1
    }
    command -v npm >/dev/null 2>&1 || { echo "npm not available in PATH." >&2; return 1; }

    if "$0" status >/dev/null 2>&1; then preview_was_running=true; fi

    trap deploy_restore EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM
    deploy_started=true

    echo "[1/5] Stopping Portal JAR..."
    "$portal_control_script" stop
    wait_until_stopped "$portal_control_script" "Portal"

    echo "[2/5] Stopping Demo JAR..."
    "$demo_control_script" stop
    wait_until_stopped "$demo_control_script" "Demo"

    if [[ $preview_was_running == true ]]; then
        echo "Stopping Vite preview before replacing frontend files..."
        "$0" stop
        wait_until_stopped "$0" "Vite preview"
    fi

    echo "[3/5] Building React/Vite frontend..."
    (cd "$frontend_home" && npm run build)
    [[ -f $frontend_home/dist/index.html ]] || {
        echo "Vite build produced no dist/index.html; refusing deployment." >&2
        return 1
    }

    echo "[4/5] Copying dist/ to $frontend_live_dir..."
    copy_dist_to_live
    [[ -f $frontend_live_dir/index.html ]] || {
        echo "Deployment failed: $frontend_live_dir/index.html was not created." >&2
        return 1
    }

    echo "[5/5] Files copied. Restoring Demo and Portal JARs..."
    # EXIT trap starts both JARs on success or failure after stopping.
}

case "${1:-}" in
    start)
        if pid=$(running_pid); then
            echo "Demo BOM frontend is already running (PID $pid)."
            exit 0
        fi
        [[ -f $frontend_home/dist/index.html ]] || { echo "Frontend build is missing: $frontend_home/dist/index.html" >&2; exit 1; }
        [[ -f $vite_bin ]] || { echo "Vite is missing: $vite_bin" >&2; exit 1; }
        rm -f -- "$pid_file"
        cd "$frontend_home"
        nohup "$node_bin" "$vite_bin" preview --host "$host" --port "$port" --strictPort >>"$log_file" 2>&1 &
        pid=$!
        echo "$pid" > "$pid_file"
        sleep 1
        running_pid >/dev/null || { echo "Demo BOM frontend failed to start. Check: $log_file" >&2; exit 1; }
        echo "Demo BOM frontend started (PID $pid) from $frontend_home/dist."
        ;;
    stop)
        if pid=$(running_pid); then
            kill "$pid"
            echo "Demo BOM frontend stop requested (PID $pid)."
        else
            echo "Demo BOM frontend is not running from this launcher."
        fi
        rm -f -- "$pid_file"
        ;;
    restart|deploy)
        deploy_frontend
        ;;
    restart-preview)
        "$0" stop
        for unused in {1..20}; do
            running_pid >/dev/null || break
            sleep 1
        done
        "$0" start
        ;;
    status)
        if pid=$(running_pid); then
            echo "Demo BOM frontend is running (PID $pid) from $frontend_home/dist."
        else
            echo "Demo BOM frontend is stopped."
            exit 1
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|status|restart-preview|deploy|restart}" >&2
        exit 2
        ;;
esac
