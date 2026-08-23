#!/usr/bin/env bash
set -Eeuo pipefail

demo_home=${DEMO_HOME:-/opt/tuonghoa/demo}
frontend_home=${DEMO_FRONTEND_DIR:-$demo_home/bom-frontend}
pid_file=${DEMO_FRONTEND_PID_FILE:-$demo_home/bom-frontend-live.pid}
log_file=${DEMO_FRONTEND_LOG_FILE:-$demo_home/bom-frontend-live.log}
host=${DEMO_FRONTEND_HOST:-127.0.0.1}
port=${DEMO_FRONTEND_PORT:-5173}
vite_bin="$frontend_home/node_modules/vite/bin/vite.js"

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
        nohup node "$vite_bin" preview --host "$host" --port "$port" --strictPort >>"$log_file" 2>&1 &
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
    restart)
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
        echo "Usage: $0 {start|stop|restart|status}" >&2
        exit 2
        ;;
esac
