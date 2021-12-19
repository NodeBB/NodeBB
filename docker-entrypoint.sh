#!/bin/sh

export BASE_DIR=/usr/src/app/base
export USER_DIR=/mnt/nodebb/user-dir

mkdir -p /usr/src/app/merged $USER_DIR
fuse-overlayfs -o lowerdir=$BASE_DIR,upperdir=$USER_DIR,workdir=$USER_DIR /usr/src/app/merged

cd /usr/src/app/merged
yarn
./nodebb build
./nodebb start