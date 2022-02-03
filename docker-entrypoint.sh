#!/bin/bash

export CONFIG_DIR=/opt/config
export CONFIG=$CONFIG_DIR/config.json

mkdir -p $CONFIG_DIR
chmod 777 -R $CONFIG_DIR

[[ -f $CONFIG_DIR/package.json ]] || cp install/package.json $CONFIG_DIR/package.json
[[ -f $CONFIG_DIR/package-lock.json ]] || echo {} > $CONFIG_DIR/package-lock.json

ln -s $CONFIG_DIR/package.json package.json
ln -s $CONFIG_DIR/package-lock.json package-lock.json

npm install --only=prod

./nodebb build
./nodebb start