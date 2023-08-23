#!/bin/bash

export CONFIG_DIR="${CONFIG_DIR:-/opt/config}"
export CONFIG=$CONFIG_DIR/config.json
export FORCE_BUILD_BEFORE_START="${FORCE_BUILD_BEFORE_START:-false}"

# Supported verbs: install (web install), setup (interactive CLI session). Default: web install
# TODO: constraint it using a hash set (or hash table)
export NODEBB_INIT_VERB="${NODEBB_INIT_VERB:-install}"
# Setup variable for backward compatibility, default: <empty>
export SETUP="${SETUP:-}"

mkdir -p $CONFIG_DIR

# if the folder is mounted as a volume this can fail, the check below is to ensure there is still write access
chmod -fR 760 $CONFIG_DIR 2> /dev/null

if [[ ! -w $CONFIG_DIR ]]; then
  echo "panic: no write permission for $CONFIG_DIR"
  exit 1
fi

[[ -f $CONFIG_DIR/package.json ]] || cp install/package.json $CONFIG_DIR/package.json
[[ -f $CONFIG_DIR/package-lock.json ]] || touch $CONFIG_DIR/package-lock.json

ln -fs $CONFIG_DIR/package.json package.json
ln -fs $CONFIG_DIR/package-lock.json package-lock.json

npm install --only=prod

if [[ -n $SETUP ]]; then
  echo "Setup environmental variable detected"
  echo "Starting setup session"
  ./nodebb setup --config=$CONFIG
elif [ -f $CONFIG ]; then
  echo "Config file exist at $CONFIG, assuming it is a valid config"
  echo "Starting forum"
  if [ "$FORCE_BUILD_BEFORE_START" = true ]; then
    ./nodebb build --config=$CONFIG
  fi
  ./nodebb start --config=$CONFIG
else
  echo "Config file not found at $CONFIG"
  echo "Starting installation session"
  ./nodebb "${NODEBB_INIT_VERB}" --config=$CONFIG
fi