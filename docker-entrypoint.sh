#!/bin/bash

export CONFIG_DIR="${CONFIG_DIR:-/opt/config}"
export CONFIG=$CONFIG_DIR/config.json
export FORCE_BUILD_BEFORE_START="${FORCE_BUILD_BEFORE_START:-false}"

mkdir -p $CONFIG_DIR
chmod 777 -R $CONFIG_DIR

[[ -f $CONFIG_DIR/package.json ]] || cp install/package.json $CONFIG_DIR/package.json
[[ -f $CONFIG_DIR/package-lock.json ]] || touch $CONFIG_DIR/package-lock.json

ln -s $CONFIG_DIR/package.json package.json
ln -s $CONFIG_DIR/package-lock.json package-lock.json

npm install --only=prod

if [ -f $CONFIG ]; then
  echo "Config file exist at $CONFIG, assuming it is a valid config"
  echo "Starting forum"
  if [ "$FORCE_BUILD_BEFORE_START" = true ]; then
    ./nodebb build --config=$CONFIG
  fi
  ./nodebb start --config=$CONFIG
else
  echo "Config file not found at $CONFIG"
  echo "Starting installer"
  ./nodebb install --config=$CONFIG
fi