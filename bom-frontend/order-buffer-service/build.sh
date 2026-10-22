#!/usr/bin/env bash
set -Eeuo pipefail

service_home=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
build_dir="$service_home/build"
classes_dir="$build_dir/classes"

rm -rf -- "$build_dir"
mkdir -p -- "$classes_dir"
javac --release 17 --add-modules jdk.httpserver -encoding UTF-8 \
  -d "$classes_dir" "$service_home/src/OrderBufferService.java"
jar --create --file "$build_dir/order-buffer-service.jar" \
  --main-class com.anhmedia.orderbuffer.OrderBufferService \
  -C "$classes_dir" .
echo "$build_dir/order-buffer-service.jar"
