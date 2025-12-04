# UniProg-X CLI

Python command-line interface for testing and debugging UniProg-X OPUP protocol.

## Installation

```bash
pip install -r requirements.txt
```

## Usage

```bash
python uniprog.py -p <port> <command> [args]
```

## Commands

### System
| Command | Description |
|---------|-------------|
| `ping` | Test connection (returns CAFE) |
| `status` | Get device uptime and status |
| `gpio-test` | Read SPI GPIO pin states |

### SPI Flash
| Command | Description |
|---------|-------------|
| `spi-scan` | Detect SPI flash (JEDEC ID) |
| `spi-raw <hex>` | Raw SPI transfer |
| `spi-jedec` | Read JEDEC ID directly |

### QSPI Modes
| Command | Description |
|---------|-------------|
| `qspi-mode <0-5>` | Set QSPI mode |
| `qspi-read <addr> <len>` | Read data |
| `qspi-fast-read <addr> [pages]` | Fast read (mode-aware) |
| `qspi-cmd <cmd_hex> [data_hex]` | Raw QSPI command |
| `qspi-test` | Test all QSPI modes |

### I2C
| Command | Description |
|---------|-------------|
| `i2c-scan` | Scan I2C bus for devices |

### AVR ISP
| Command | Description |
|---------|-------------|
| `avr-sig` | Read AVR signature |
| `isp-enter` | Enter ISP mode |
| `isp-exit` | Exit ISP mode |

## QSPI Mode Reference

| Mode | Name | CMD | ADDR | DATA |
|------|------|-----|------|------|
| 0 | Standard | 1 | 1 | 1 |
| 1 | Dual Output | 1 | 1 | 2 |
| 2 | Dual I/O | 1 | 2 | 2 |
| 3 | Quad Output | 1 | 1 | 4 |
| 4 | Quad I/O | 1 | 4 | 4 |
| 5 | QPI | 4 | 4 | 4 |

## Examples

```bash
# Test connection
python uniprog.py -p /dev/ttyACM0 ping

# Detect SPI flash
python uniprog.py -p /dev/ttyACM0 spi-scan

# Set Quad SPI mode
python uniprog.py -p /dev/ttyACM0 qspi-mode 3

# Read 256 bytes from address 0
python uniprog.py -p /dev/ttyACM0 qspi-read 0x000000 256

# Fast read 1 page (256 bytes)
python uniprog.py -p /dev/ttyACM0 qspi-fast-read 0x000000 1

# Test all QSPI modes
python uniprog.py -p /dev/ttyACM0 qspi-test

# Read JEDEC ID via raw command
python uniprog.py -p /dev/ttyACM0 qspi-cmd 9F 000000
```

## Troubleshooting

### Permission denied (Linux)
```bash
sudo chmod 666 /dev/ttyACM0
# or add to dialout group
sudo usermod -a -G dialout $USER
```

### No response
- Check USB connection
- Verify port: `ls /dev/ttyACM* /dev/ttyUSB*`
- Reset UniProg-X device
