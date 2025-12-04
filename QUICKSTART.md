# UniProg-X Quick Start Guide

## Prerequisites

- **Hardware**: Raspberry Pi Pico (RP2040 board)
- **Browser**: Chrome, Edge, or Opera (Web Serial API support required)
- **Development Tools** (for building from source):
  - PlatformIO (for firmware)
  - Node.js v16+ (for web client)

## Quick Start (5 minutes)

### 1. Flash the Firmware

```bash
cd firmware/
pio run -t upload
```

The RP2040 will reboot and appear as a USB CDC device.

### 2. Build & Run Web Client

```bash
cd web-client/
npm install
npm run build
npm run dev
```

Open http://localhost:5173 in Chrome/Edge/Opera.

### 3. Connect to Device

1. Click **"INITIALIZE LINK"** button
2. Select the RP2040 from browser's serial port dialog
3. You should see "System Connected" in the log

### 4. Basic Operations

#### I2C EEPROM (24CXX)
1. Switch to **I2C** tab
2. Click **"SCAN I2C"** 
3. Select chip from dropdown (or auto-detected)
4. Click **"READ"** to read chip contents
5. Edit in hex editor or load a file
6. Click **"WRITE"** to program
7. Click **"VERIFY"** to check

#### SPI Flash (W25QXX)
1. Switch to **SPI** tab
2. Click **"SCAN SPI"**
3. Follow same read/write/verify flow

#### AVR Programming (ISP)
1. Switch to **AVR** tab
2. Connect target AVR:
   - MOSI → MOSI
   - MISO → MISO  
   - SCK → SCK
   - RESET → RESET
   - GND → GND
   - 3.3V → VCC (if target is 3.3V)
3. Select chip (e.g., ATmega328P)
4. Read/Write/Verify flash memory
5. Use **"Fuse Bits"** button to edit fuse settings

#### STM32 Programming (SWD)
1. Switch to **STM32** tab
2. Connect target STM32:
   - SWCLK → SWCLK
   - SWDIO → SWDIO
   - GND → GND
3. Select chip (e.g., STM32F103C8)
4. Read flash or write to RAM

## Pinout Reference

| Function  | GPIO | Pin | Notes                    |
|-----------|------|-----|--------------------------|
| I2C SDA   | GP4  | 6   | Pull-up recommended      |
| I2C SCL   | GP5  | 7   | Pull-up recommended      |
| SPI IO0   | GP19 | 25  | MOSI (Quad: IO0)         |
| SPI IO1   | GP16 | 21  | MISO (Quad: IO1)         |
| SPI IO2   | GP21 | 27  | /WP (Quad: IO2)          |
| SPI IO3   | GP22 | 29  | /HOLD (Quad: IO3)        |
| SPI CS    | GP17 | 22  | Chip Select              |
| SPI SCK   | GP18 | 24  | Clock                    |
| AVR RESET | GP20 | 26  | For ISP programming      |
| SWD SWCLK | GP2  | 4   | For STM32 SWD            |
| SWD SWDIO | GP3  | 5   | For STM32 SWD            |
| 3.3V OUT  | 3V3  | 36  | Max 300mA                |
| GND       | GND  | 3,8 | Common ground            |

### QSPI Flash Wiring (8-pin SOIC)
```
UniProg-X         Flash Chip
---------         ----------
GP17 (CS)  ────►  Pin 1 (CS#)
GP16 (IO1) ◄───►  Pin 2 (DO/IO1)
GP21 (IO2) ◄───►  Pin 3 (/WP/IO2)
GND        ────►  Pin 4 (GND)
GP19 (IO0) ◄───►  Pin 5 (DI/IO0)
GP18 (SCK) ────►  Pin 6 (CLK)
GP22 (IO3) ◄───►  Pin 7 (/HOLD/IO3)
3V3        ────►  Pin 8 (VCC)
```

> **Standard SPI mode**: IO2 and IO3 can be left unconnected (pulled HIGH internally).
> **Quad SPI mode**: All 6 wires required for full speed.

⚠️ **Important**: All signals are 3.3V. Use level shifters for 5V targets.

## File Formats

- **Binary (.bin)**: Raw binary data
- **Intel HEX (.hex)**: ASCII hex format (AVR compatible)
- **EEPROM (.eep)**: EEPROM data (AVR)

Load files with **"LOAD FILE"** button, save with **"SAVE"** dropdown.

## Troubleshooting

### "Failed to connect"
- Check USB cable (data capable, not charge-only)
- Try different USB port
- Refresh browser and reconnect

### "I2C Scan: No devices found"
- Check wiring and pull-up resistors (4.7kΩ recommended)
- Verify target is powered
- Check I2C address (most EEPROMs use 0x50)

### "SPI Scan: No flash chip detected"
- Verify SPI wiring (MISO/MOSI/SCK/CS)
- Check chip power
- Some chips require specific initialization

### "Verify failed"
- For I2C EEPROMs: Write may need time, add delay
- For Flash: Ensure proper erase before write
- Check for write protection

### Build errors
```bash
# Clean and rebuild firmware
cd firmware/
pio run -t clean
pio run

# Clean and rebuild web client
cd web-client/
rm -rf node_modules/ dist/
npm install
npm run build
```

## Protocol Debugging

Enable console logging (F12 in browser) to see OPUP packets:
```
TX: a5 01 10 00 00 00 d1 5f 6a 95
RX: a5 01 10 01 01 00 00 e6 35 a8 94
```

Each packet shows:
- SOF (0xA5)
- Sequence number
- Command ID
- FLAGS (response/error)
- Payload length
- Payload data
- CRC32

See [protocol.md](protocol.md) for full OPUP specification.

## Next Steps

- Read [README.md](README.md) for full feature list
- Check [CHANGELOG.md](CHANGELOG.md) for recent changes
- Explore the chip database in `web-client/src/lib/chips.ts`
- Review firmware drivers in `firmware/src/protocol/drivers/`

## Need Help?

- Check [protocol.md](protocol.md) for communication details
- Enable browser console for debugging
- Review firmware serial output for errors
