# UniProg-X CLI

Python command-line interface for testing and debugging UniProg-X OPUP protocol.

## Installation

```bash
cd cli/
pip install -r requirements.txt
```

## Usage

```bash
python uniprog.py -p <port> <command> [args]
```

Options:
- `-p, --port` - Serial port (default: `/dev/ttyACM0`)
- `-b, --baud` - Baud rate (default: 115200)
- `-t, --timeout` - Timeout in seconds (default: 2.0)

## Commands

### System
| Command | Description |
|---------|-------------|
| `ping` | Test connection (returns CAFE) |
| `status` | Get device uptime and status |
| `gpio-test` | Read SPI GPIO pin states |

### SPI Flash (Standard)
| Command | Description |
|---------|-------------|
| `spi-scan` | Detect SPI flash via JEDEC ID |
| `spi-raw <hex>` | Raw SPI transfer |
| `spi-jedec` | Read JEDEC ID directly |

### QSPI Multi-Mode
| Command | Description |
|---------|-------------|
| `qspi-mode <0-5>` | Set operating mode |
| `qspi-read <addr> <len>` | Read data from address |
| `qspi-fast-read <addr> [pages]` | Fast read (mode-aware) |
| `qspi-cmd <cmd> [data]` | Raw flash command |
| `qspi-test` | Test all QSPI modes automatically |
| `qspi-status` | Read Status Registers SR1/SR2 |
| `qspi-quad-enable` | Enable Quad mode (sets QE bit) |

### I2C
| Command | Description |
|---------|-------------|
| `i2c-scan` | Scan I2C bus for devices |

### AVR ISP
| Command | Description |
|---------|-------------|
| `avr-sig` | Read AVR device signature |
| `isp-enter` | Enter ISP programming mode |
| `isp-exit` | Exit ISP mode |

## QSPI Mode Reference

| Mode | Value | Name | CMD | ADDR | DATA |
|------|-------|------|-----|------|------|
| Standard | 0 | 1-1-1 | 1 | 1 | 1 |
| Dual Output | 1 | 1-1-2 | 1 | 1 | 2 |
| Dual I/O | 2 | 1-2-2 | 1 | 2 | 2 |
| Quad Output | 3 | 1-1-4 | 1 | 1 | 4 |
| Quad I/O | 4 | 1-4-4 | 1 | 4 | 4 |
| QPI | 5 | 4-4-4 | 4 | 4 | 4 |

## Verified Chips

| Chip | JEDEC | Std | Dual | Quad | QPI |
|------|-------|-----|------|------|-----|
| W25Q80 | 0xEF 0x4014 | ✅ | ✅ | ✅ | ✅ |
| W25Q64 | 0xEF 0x4017 | ✅ | ✅ | ✅ | ✅ |
| W25Q128 | 0xEF 0x4018 | ✅ | ✅ | ✅ | ✅ |
| MX25L3206E | 0xC2 0x2016 | ✅ | ✅ | ❌* | ❌* |

*\* MX25L3206E has no Quad hardware support*

## Examples

```bash
# Test connection
python uniprog.py -p /dev/ttyACM0 ping

# Detect SPI flash
python uniprog.py -p /dev/ttyACM0 spi-scan

# Test all QSPI modes
python uniprog.py -p /dev/ttyACM0 qspi-test

# Set Quad Output mode
python uniprog.py -p /dev/ttyACM0 qspi-mode 3

# Read 256 bytes from address 0
python uniprog.py -p /dev/ttyACM0 qspi-read 0x000000 256

# Fast read 4 pages (1KB)
python uniprog.py -p /dev/ttyACM0 qspi-fast-read 0x000000 4

# Enable Quad mode (for chips that need QE bit)
python uniprog.py -p /dev/ttyACM0 qspi-quad-enable

# Read status registers
python uniprog.py -p /dev/ttyACM0 qspi-status

# Execute raw JEDEC ID command
python uniprog.py -p /dev/ttyACM0 qspi-cmd 9F 000000
```

## Quad Enable (QE Bit)

Some chips require QE bit to be set before Quad modes work:

| Manufacturer | Method | QE Location |
|--------------|--------|-------------|
| Winbond (0xEF) | Write SR2 (0x31) | SR2 bit 1 |
| Macronix (0xC2) | Write SR1 (0x01) | SR1 bit 6 |
| GigaDevice (0xC8) | Write SR2 (0x31) | SR2 bit 1 |

Use `qspi-quad-enable` to automatically set QE for your chip.

## Troubleshooting

### Permission denied (Linux)
```bash
sudo chmod 666 /dev/ttyACM0
# or add user to dialout group
sudo usermod -a -G dialout $USER
```

### No response
- Check USB connection
- Verify port: `ls /dev/ttyACM* /dev/ttyUSB*`
- Reset device by unplugging/replugging

### Quad mode fails
- Run `qspi-quad-enable` first
- Some chips (like MX25L3206E) don't support Quad modes
- Verify with `qspi-status` that QE bit is set
