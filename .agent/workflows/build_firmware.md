---
description: Build UniProg-X Firmware Autonomously
---

To build the firmware autonomously without relying on the user's interactive shell environment:

1. Always use the wrapper script:
   ```bash
   /home/wm/.gemini/antigravity/scratch/UniProg-X/firmware/build.sh
   ```

2. This script automatically:
   - Locates PlatformIO (`~/.platformio/penv/bin/pio` or `.venv/bin/pio` or in PATH)
   - Runs `pio run` with any provided arguments

3. For verbose output:
   ```bash
   ./build.sh -v
   ```

4. For uploading:
   ```bash
   ./build.sh -t upload
   ```
// turbo-all
