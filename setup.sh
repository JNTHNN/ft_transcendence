#!/bin/bash

set -e

cd api && npm i
cd ../frontend && npm i
cd ../blockchain && npm i
cd ..
docker compose up -d