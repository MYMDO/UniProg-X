# UniProg-X Communication Protocol

## Overview
The protocol is a simple binary command-response protocol over USB Serial (CDC).
All multi-byte integers are Little Endian.

## Packet Structure
| Offset | Field | Size | Description |
| :--- | :--- | :--- | :--- |
| 0 | Magic | 1 | `0xAA` (Start of Frame) |
| 1 | Command | 1 | Command ID |
| 2 | Length | 2 | Payload Length (N) |
| 4 | Payload | N | Command Data |
| 4+N | CRC8 | 1 | Checksum of Command + Length + Payload |

## Commands

### System (0x00 - 0x0F)
| ID | Name | Payload (Req) | Payload (Resp) | Description |
| :--- | :--- | :--- | :--- | :--- |
| 0x01 | PING | None | None | Keep-alive / Connection check |
| 0x02 | GET_INFO | None | `[Version:4][Serial:16]` | Get firmware version and serial |
| 0x03 | RESET | None | None | Soft reset the device |

### I2C (0x10 - 0x1F)
| ID | Name | Payload (Req) | Payload (Resp) | Description |
| :--- | :--- | :--- | :--- | :--- |
| 0x10 | I2C_SCAN | None | `[Count:1][Addr1][Addr2]...` | Scan I2C bus |
| 0x11 | I2C_READ | `[Addr:1][Len:2]` | `[Data:N]` | Read N bytes from address |
| 0x12 | I2C_WRITE | `[Addr:1][Data:N]` | None | Write N bytes to address |

### SPI (0x20 - 0x2F)
| ID | Name | Payload (Req) | Payload (Resp) | Description |
| :--- | :--- | :--- | :--- | :--- |
| 0x20 | SPI_SCAN | None | `[Count:1][Mfg:1][Dev:2]` | Scan for SPI Flash (JEDEC ID) |
| 0x21 | SPI_CONFIG | `[Freq:4][Mode:1]` | None | Configure SPI bus |
| 0x22 | SPI_XFER | `[CS:1][Len:2][Data:N]` | `[Data:N]` | Transfer N bytes |

## Error Codes
If a command fails, the device responds with `CMD_ERROR (0xFF)`:
`[0xAA][0xFF][0x01][0x00][ErrorCode][CRC]`

| Code | Name | Description |
| :--- | :--- | :--- |
| 0x01 | INVALID_CMD | Unknown command ID |
| 0x02 | CRC_ERROR | Checksum mismatch |
| 0x03 | TIMEOUT | Bus timeout |
| 0x04 | NACK | I2C NACK |
