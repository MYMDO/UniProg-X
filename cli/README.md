# UniProg-X CLI

Command-line interface for testing UniProg-X OPUP protocol.

## Installation

```bash
cd cli/
pip install -r requirements.txt
```

## Usage

```bash
# Basic syntax
python uniprog.py -p <port> <command> [args]

# Examples (Linux)
python uniprog.py -p /dev/ttyACM0 ping
python uniprog.py -p /dev/ttyACM0 spi-scan
python uniprog.py -p /dev/ttyACM0 i2c-scan

# Examples (macOS)
python uniprog.py -p /dev/cu.usbmodem* ping

# Examples (Windows)
python uniprog.py -p COM3 ping
```

## Commands

| Command | Description |
|---------|-------------|
| `ping` | Test connection |
| `status` | Get device status (uptime, RAM) |
| `i2c-scan` | Scan I2C bus for devices |
| `spi-scan` | Detect SPI flash (JEDEC ID) |
| `spi-raw <hex>` | Raw SPI transfer |
| `spi-jedec` | Read JEDEC ID directly |
| `qspi-mode <0-5>` | Set QSPI mode |
| `avr-sig` | Read AVR signature |
| `isp-enter` | Enter ISP mode |
| `isp-exit` | Exit ISP mode |

## QSPI Modes

| Mode | Name | Description |
|------|------|-------------|
| 0 | Standard | 1-1-1 (default) |
| 1 | Dual Output | 1-1-2 |
| 2 | Dual I/O | 1-2-2 |
| 3 | Quad Output | 1-1-4 |
| 4 | Quad I/O | 1-4-4 |
| 5 | QPI | 4-4-4 |

## Examples

### Test Connection
```bash
$ python uniprog.py -p /dev/ttyACM0 ping
✓ Connected to /dev/ttyACM0
TX: a5 01 01 00 00 00 ...
RX: a5 01 01 01 02 00 ca fe ...
✓ PING OK (CAFE)
```

### Scan SPI Flash
```bash
$ python uniprog.py -p /dev/ttyACM0 spi-scan
✓ Connected to /dev/ttyACM0
TX: a5 01 20 00 00 00 ...
RX: a5 01 20 01 04 00 01 ef 40 17 ...
✓ SPI Flash detected:
  Manufacturer: Winbond (0xEF)
  Device ID: 0x4017
```

### Raw SPI Transfer
```bash
$ python uniprog.py -p /dev/ttyACM0 spi-raw 9F000000
✓ Connected to /dev/ttyACM0
TX: a5 01 22 00 04 00 9f 00 00 00 ...
RX: a5 01 22 01 04 00 ff ef 40 17 ...
✓ SPI transfer: 9f 00 00 00 -> ff ef 40 17
```

## Troubleshooting

### "Permission denied" on Linux
```bash
sudo chmod 666 /dev/ttyACM0
# or add yourself to dialout group
sudo usermod -a -G dialout $USER
```

### No response
- Check USB cable
- Verify correct port: `ls /dev/ttyACM* /dev/ttyUSB*`
- Reset UniProg-X
