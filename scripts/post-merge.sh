#!/bin/bash
set -e

echo "=== Post-merge setup ==="

echo "Installing dependencies..."
npm install --prefer-offline

echo "=== Post-merge setup complete ==="
