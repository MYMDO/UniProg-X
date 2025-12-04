# OPUP (OpenProg Universal Protocol) Specification v1.0

## 1. Overview

OPUP is a modern binary communication protocol designed for hardware programming devices. It provides robust error handling, CRC32 checksums, sequence tracking, and a modular driver architecture.

**Key Features:**
- CRC32 integrity checking
- Sequence number tracking for request/response matching
- Type, error, and async flags
- Little-endian byte order
- Modular and extensible command structure

## 2. Physical Layer

- **Interface**: USB Serial (CDC)
- **Baud Rate**: 115200 (virtual, actual speed is USB Full-Speed ~12 Mbps)
- **Endianness**: Little Endian
- **Flow Control**: None

## 3. Packet Structure

All communication uses the following frame format:

| Offset | Field   | Size | Description                          |
|--------|---------|------|--------------------------------------|
| 0      | SOF     | 1    | Start of Frame = `0xA5`              |
| 1      | SEQ     | 1    | Sequence Number (0-255, rolls over)  |
| 2      | CMD     | 1    | Command ID                           |
| 3      | FLAGS   | 1    | Status Flags (see below)             |
| 4-5    | LEN     | 2    | Payload Length (uint16, LE)          |
| 6      | DATA    | N    | Payload Data                         |
| 6+N    | CRC     | 4    | CRC32 (Poly: 0x04C11DB7, LE)         |

### 3.1 FLAGS Byte

| Bit | Name    | Description                      |
|-----|---------|----------------------------------|
| 0   | TYPE    | 0=Request, 1=Response            |
| 1   | ERROR   | 0=Success, 1=Error               |
| 2   | ASYNC   | 0=Sync, 1=Async Event            |
| 3-7 | Reserved| Must be 0                        |

**Common FLAG Values:**
- `0x00` = Request (client to device)
- `0x01` = Response, success (device to client)
- `0x03` = Response, error (device to client)

## 4. Command Structure

Commands are organized by functional groups:

| Range       | Group          | Description                    |
|-------------|----------------|--------------------------------|
| 0x01-0x0F   | System         | System-level commands          |
| 0x10-0x1F   | I2C            | I2C EEPROM operations          |
| 0x20-0x2F   | SPI            | SPI Flash operations           |
| 0x30-0x3F   | AVR ISP        | AVR microcontroller programming|
| 0x40-0x4F   | SWD            | STM32 SWD operations           |

## 5. System Commands (0x01 - 0x0F)

### 0x01: SYS_PING
- **Request**: Empty payload
- **Response**: `[0xCA, 0xFE]` (Pong magic bytes)
- **Description**: Connection health check / keep-alive

### 0x02: SYS_GET_CAPS
- **Request**: Empty payload
- **Response**: JSON string or binary capability structure
  - Example: `{"fw":"1.0","proto":"opup","drivers":["i2c","spi","isp","swd"]}`
- **Description**: Query device capabilities and firmware version

### 0x03: SYS_GET_STATUS
- **Request**: Empty payload
- **Response**:
  - `[0]`: Status Code (0=Idle, 1=Busy, 2=Error)
  - `[1-4]`: Uptime (ms, uint32, LE)
  - `[5-8]`: Free RAM (bytes, uint32, LE)
- **Description**: Get device runtime status

### 0x04: SYS_RESET
- **Request**: `[0xDE, 0xAD]` (safety confirmation bytes)
- **Response**: ACK before device resets
- **Description**: Perform soft reset

## 6. I2C Commands (0x10 - 0x1F)

### 0x10: I2C_SCAN
- **Request**: Empty payload
- **Response**: `[Count:1][Addr1][Addr2]...`
  - `Count`: Number of devices found (0-127)
  - `Addr1...`: I2C addresses of detected devices
- **Description**: Scan I2C bus for connected devices

### 0x11: I2C_READ
- **Request**: `[Addr:1][Len_L:1][Len_H:1]`
  - `Addr`: I2C device address
  - `Len`: Number of bytes to read (uint16, LE)
- **Response**: `[Data...]` (N bytes)
- **Description**: Read N bytes from I2C device

### 0x12: I2C_WRITE
- **Request**: `[Addr:1][Data...]`
  - `Addr`: I2C device address
  - `Data`: Bytes to write
- **Response**: Empty (success) or error
- **Description**: Write data to I2C device

## 7. SPI Commands (0x20 - 0x2F)

### 0x20: SPI_CONFIG
- **Request**: `[Mode:1][Speed:4]`
  - `Mode`: SPI mode (0-3)
  - `Speed`: Clock frequency in Hz (uint32, LE)
- **Response**: Empty (success) or error
- **Description**: Configure SPI bus parameters

### 0x21: SPI_XFER
- **Request**: `[Data...]`
  - `Data`: Bytes to transfer
- **Response**: `[Data...]` (same length as request)
- **Description**: Full-duplex SPI transfer

### 0x22: SPI_SCAN
- **Request**: Empty payload
- **Response**: `[Count:1][Mfg:1][Dev_L:1][Dev_H:1]`
  - `Count`: Number of detected chips (0 or 1)
  - `Mfg`: Manufacturer ID (JEDEC)
  - `Dev`: Device ID (uint16, LE)
- **Description**: Scan for SPI Flash using JEDEC ID (0x9F)

## 7.1 QSPI Commands (0x25 - 0x29)

UniProg-X supports advanced Quad SPI modes for high-speed Serial Flash programming.

### QSPI Mode Values

| Mode | Value | Name | Description |
|------|-------|------|-------------|
| Standard | 0 | 1-1-1 | Classic single-wire SPI |
| Dual Output | 1 | 1-1-2 | Data output on IO0+IO1 |
| Dual I/O | 2 | 1-2-2 | Address+Data on IO0+IO1 |
| Quad Output | 3 | 1-1-4 | Data on IO0-IO3 |
| Quad I/O | 4 | 1-4-4 | Address+Data on IO0-IO3 |
| QPI | 5 | 4-4-4 | Full 4-wire mode |

### 0x25: QSPI_SET_MODE
- **Request**: `[Mode:1]` (0-5, see table above)
- **Response**: `[CurrentMode:1]`
- **Description**: Set QSPI operating mode. Mode persists until changed.

### 0x26: QSPI_READ
- **Request**: `[Cmd:1][AddrLen:1][Addr:3-4][DummyCycles:1][ReadLen:2]`
  - `Cmd`: Flash read command (e.g., 0x03, 0x0B, 0x3B, 0x6B, 0xEB)
  - `AddrLen`: Address length (3 or 4 bytes)
  - `Addr`: Address (little-endian)
  - `DummyCycles`: Number of dummy clock cycles
  - `ReadLen`: Bytes to read (uint16, LE)
- **Response**: `[Data:N]`
- **Description**: Read data using current QSPI mode

### 0x27: QSPI_WRITE
- **Request**: `[Cmd:1][AddrLen:1][Addr:3-4][Data:N]`
  - `Cmd`: Flash write command (e.g., 0x02, 0x32)
  - `AddrLen`: Address length (3 or 4 bytes)
  - `Addr`: Address (little-endian)
  - `Data`: Data to write
- **Response**: Empty (success) or error
- **Description**: Write data using current QSPI mode

### 0x28: QSPI_FAST_READ
- **Request**: `[Addr:3][PageCount:1]`
  - `Addr`: 24-bit start address
  - `PageCount`: Number of 256-byte pages to read (max 16)
- **Response**: `[Data:256*PageCount]`
- **Description**: Optimized page read using mode-appropriate fast read command

### 0x29: QSPI_CMD
- **Request**: `[Cmd:1][TxLen:1][TxData:N]`
  - `Cmd`: Flash command to execute
  - `TxLen`: Data length (for read or both directions)
  - `TxData`: Optional data to send
- **Response**: `[RxData:TxLen]`
- **Description**: Execute raw flash command

## 8. AVR ISP Commands (0x30 - 0x3F)

### 0x30: ISP_ENTER
- **Request**: Empty payload
- **Response**: `[Success:1]` (1=entered, 0=failed)
- **Description**: Enter AVR programming mode

### 0x31: ISP_XFER
- **Request**: `[B0][B1][B2][B3]` (4-byte ISP command)
- **Response**: `[B0][B1][B2][B3]` (4-byte ISP response)
- **Description**: Execute standard AVR ISP command

### 0x32: ISP_EXIT
- **Request**: Empty payload
- **Response**: Empty (success) or error
- **Description**: Exit AVR programming mode

## 9. SWD Commands (0x40 - 0x4F)

### 0x40: SWD_INIT
- **Request**: Empty payload
- **Response**: `[IDCODE:4]` (uint32, LE)
- **Description**: Initialize SWD and read target IDCODE

### 0x41: SWD_READ
- **Request**: `[AP/DP:1][Addr:4]`
  - `AP/DP`: 0=DP, 1=AP
  - `Addr`: Register address (uint32, LE)
- **Response**: `[Data:4]` (uint32, LE)
- **Description**: Read SWD AP or DP register

### 0x42: SWD_WRITE
- **Request**: `[AP/DP:1][Addr:4][Data:4]`
  - `AP/DP`: 0=DP, 1=AP
  - `Addr`: Register address (uint32, LE)
  - `Data`: Data to write (uint32, LE)
- **Response**: Empty (success) or error
- **Description**: Write SWD AP or DP register

## 10. Error Handling

When an error occurs, the device responds with:
- **FLAGS**: `0x03` (Response + Error)
- **Payload**: `[ErrorCode:1]`

### Error Codes

| Code | Name          | Description                        |
|------|---------------|------------------------------------|
| 0x00 | UNKNOWN       | Unknown/unspecified error          |
| 0x01 | INVALID_CMD   | Unrecognized command ID            |
| 0x02 | CRC_ERROR     | CRC32 checksum mismatch            |  
| 0x03 | TIMEOUT       | Bus/device timeout                 |
| 0x04 | NACK          | I2C NACK received                  |
| 0x05 | BUSY          | Device is busy                     |
| 0x06 | INVALID_LEN   | Invalid payload length             |

## 11. CRC32 Calculation

OPUP uses CRC32 with polynomial `0x04C11DB7`:
- Initial value: `0xFFFFFFFF`
- XOR out: `0xFFFFFFFF`
- Computed over: SOF + SEQ + CMD + FLAGS + LEN + DATA
- Byte order: Little-endian (LSB first)

## 12. Sequence Numbers

- Each request increments the sequence number (0-255, rolls over)
- Response must use the same sequence number as the request
- Client uses sequence numbers to match responses to requests
- Timeout: 2000ms (client-side)

## 13. Example Packet

**Request (I2C_SCAN):**
```
A5 01 10 00 00 00 D1 5F 6A 95
│  │  │  │  └──┴─ LEN (0x0000)
│  │  │  └─────── FLAGS (0x00 = Request)
│  │  └────────── CMD (0x10 = I2C_SCAN)
│  └───────────── SEQ (0x01)
└──────────────── SOF (0xA5)
                 └──────────┘ CRC32
```

**Response (0 devices found):**
```
A5 01 10 01 01 00 00 E6 35 A8 94
│  │  │  │  └──┴─ LEN (0x0001)
│  │  │  └─────── FLAGS (0x01 = Response, success)
│  │  └────────── CMD (0x10 = I2C_SCAN)
│  └───────────── SEQ (0x01, matches request)
└──────────────── SOF (0xA5)
            │  └────────────┘ CRC32
            └─ PAYLOAD (count=0)
```

## 14. Implementation Notes

- **Firmware**: Modular driver architecture (`OPUPDriver` base class)
- **Client**: TypeScript implementation with `OPUPClient` and `WebSerialTransport`
- **Transport**: USB CDC (no special drivers required)
- **Debugging**: Console logs show TX/RX packets in hex format

## 15. Version History

- **v1.0** (2025-01-30): Initial OPUP specification
  - CRC32 integrity checking
  - Sequence number tracking
  - Modular command structure
  - Support for I2C, SPI, ISP, SWD protocols
