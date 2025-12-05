#!/bin/bash
set -e

# Try to find PlatformIO executable
if [ -f "$HOME/.platformio/penv/bin/pio" ]; then
    PIO="$HOME/.platformio/penv/bin/pio"
elif [ -f ".venv/bin/pio" ]; then
    PIO=".venv/bin/pio"
elif command -v pio &> /dev/null; then
    PIO="pio"
else
    echo "Error: PlatformIO (pio) not found!"
    echo "Please install it or create a virtual environment."
    exit 1
fi

echo "Using PlatformIO at: $PIO"
$PIO run "$@"
