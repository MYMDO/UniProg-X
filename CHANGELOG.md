# UniProg-X Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **OPUP Protocol v1.0**: Complete implementation of OpenProg Universal Protocol
  - CRC32 checksums for data integrity
  - Sequence number tracking for request/response matching
  - Modular driver architecture
  - Support for I2C, SPI, ISP, SWD protocols
- **QSPI/QPI Support (2025-12-04)**: Full Quad SPI implementation with all 6 modes
  - GPIO21 = IO2 (/WP), GPIO22 = IO3 (/HOLD)
  - Modes: Standard (1-1-1), Dual Out (1-1-2), Dual I/O (1-2-2), Quad Out (1-1-4), Quad I/O (1-4-4), QPI (4-4-4)
  - OPUP commands: 0x25-0x29 (QSPI_SET_MODE, READ, WRITE, FAST_READ, CMD)
  - Bit-bang implementation for maximum hardware compatibility
- **CLI Tool (2025-12-04)**: Python command-line interface (`cli/uniprog.py`)
  - Commands: ping, status, gpio-test, i2c-scan, spi-scan, spi-raw
  - QSPI commands: qspi-mode, qspi-read, qspi-fast-read, qspi-cmd, qspi-test
  - Status commands: qspi-status, qspi-quad-enable
  - Manufacturer-aware Quad Enable (Winbond, Macronix, GigaDevice)
- **Web Client**: Modern React-based interface with TypeScript
  - `OPUPClient` class for protocol handling
  - `WebSerialTransport` for Web Serial API integration
  - Virtualized hex editor, AVR fuse editor, STM32 option bytes viewer

### Verified Hardware (2025-12-04)
- **Winbond W25Q80** (0xEF 0x4014) - 1MB - All modes ✅
- **Winbond W25Q64** (0xEF 0x4017) - 8MB - All modes ✅
- **Winbond W25Q128** (0xEF 0x4018) - 16MB - All modes ✅
- **Macronix MX25L3206E** (0xC2 0x2016) - 4MB - Standard/Dual only (no Quad HW)

### Fixed
- **SPI Flash Detection (2025-12-04)**: Bit-bang SPI for RP2040 compatibility
- **GPIO Config**: IO2/IO3 set HIGH at init to disable /WP and /HOLD
- **GPIO Test**: No longer destroys SPI pin configuration when reading
- **SPI_XFER CS Pin**: Fixed parameter (was 0, now 17)
- **MISO Input**: Added INPUT_PULLUP for reliable reading
- **I2C_SCAN Response**: Firmware returns count as first byte
- **OPUPClient**: Single instance via useState lazy initializer

## [1.0.0] - 2025-01-15

### Initial Release
- Basic I2C EEPROM support (24CXX series)
- Basic SPI Flash support (W25QXX series)  
- AVR ISP programming (ATmega328P, ATtiny85)
- STM32 SWD support (STM32F103)
- Web-based interface
- RP2040 firmware with PlatformIO build system

---

## Version Numbering

- **Major**: Breaking protocol or API changes
- **Minor**: New features, backward compatible
- **Patch**: Bug fixes, documentation updates
