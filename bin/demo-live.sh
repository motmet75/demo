#!/usr/bin/env bash
set -Eeuo pipefail

demo_home=${DEMO_HOME:-/opt/tuonghoa/demo}
artifact_name=${DEMO_ARTIFACT_NAME:-demo-0.0.1-SNAPSHOT.jar}
jar_file="$demo_home/target/$artifact_name"
pid_file=${DEMO_PID_FILE:-$demo_home/demo-live.pid}
log_file=${DEMO_LOG_FILE:-$demo_home/demo-live.log}
timezone=${DEMO_TIMEZONE:-Asia/Ho_Chi_Minh}

running_pid() {
    [[ -f $pid_file ]] || return 1
    local pid command_line
    pid=$(<"$pid_file")
    [[ $pid =~ ^[0-9]+$ ]] || return 1
    kill -0 "$pid" 2>/dev/null || return 1
    [[ -r /proc/$pid/cmdline ]] || return 1
    command_line=$(tr '\0' ' ' < "/proc/$pid/cmdline")
    [[ $command_line == *"-jar $jar_file"* || $command_line == *"-jar target/$artifact_name"* ]] || return 1
    echo "$pid"
}

case "${1:-}" in
    start)
        if pid=$(running_pid); then
            echo "Demo is already running (PID $pid)."
            exit 0
        fi
        if [[ ! -f $jar_file ]]; then
            echo "Demo artifact is missing: $jar_file" >&2
            exit 1
        fi
        rm -f -- "$pid_file"
        cd "$demo_home"
        nohup java "-Duser.timezone=$timezone" -jar "$jar_file" >>"$log_file" 2>&1 &
        pid=$!
        echo "$pid" > "$pid_file"
        sleep 1
        if ! running_pid >/dev/null; then
            echo "Demo failed to stay running. Check: $log_file" >&2
            exit 1
        fi
        echo "Demo started (PID $pid). Log: $log_file"
        ;;
    stop)
        if pid=$(running_pid); then
            kill "$pid"
            echo "Demo stop requested (PID $pid)."
        else
            rm -f -- "$pid_file"
            echo "Demo is not running from this launcher."
        fi
        ;;
    restart)
        "$0" stop
        for unused in {1..30}; do
            running_pid >/dev/null || break
            sleep 1
        done
        if running_pid >/dev/null; then
            echo "Demo did not stop within 30 seconds." >&2
            exit 1
        fi
        "$0" start
        ;;
    status)
        if pid=$(running_pid); then
            echo "Demo is running (PID $pid)."
        else
            echo "Demo is stopped."
            exit 1
        fi
        ;;
    logs)
        touch "$log_file"
        tail -f "$log_file"
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}" >&2
        exit 2
        ;;
esac
