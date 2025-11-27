# UniProg-X: Universal Hardware Programmer

UniProg-X is a professional-grade, hyper-scalable, and automated hardware programmer designed for the modern era. Built on the powerful Raspberry Pi Pico (RP2040) and featuring a sleek, web-based interface, it brings hardware programming into the 21st century.

![UniProg-X Interface](UniProg-X_Interface.jpg)

## 🚀 Features

*   **Universal Support**: Native support for I2C EEPROMs, SPI Flash chips, AVR microcontrollers (ISP), and STM32 microcontrollers (SWD).
*   **Web-First Interface**: No drivers needed. Works directly in Chrome, Edge, and Opera via the Web Serial API.
*   **Auto-Detection**: Smart scanning automatically identifies connected chips (I2C & SPI).
*   **Multi-Protocol**: Supports I2C, SPI, AVR ISP, and STM32 SWD protocols.
*   **High Performance**: 2-4x faster transfers with adaptive chunking. Powered by RP2040's PIO and dual-core architecture.
*   **Modern UI**: Cyberpunk-themed, responsive interface with glassmorphism and real-time feedback.
*   **Mode-Aware Interface**: Separate tabs for I2C, SPI, AVR, and STM32 with context-specific controls.
*   **Virtualized Hex Editor**: Smoothly handle large binary files with efficient virtualization.
*   **Advanced Features**:
    - **AVR Fuse Editor**: Read/write fuse bits with safety confirmations and presets
    - **STM32 Option Bytes**: View read protection, user flags, and write protection status
*   **Comprehensive Toolset**: Read, Write, Verify, Erase, and File Management (.bin, .hex, .eep).

## 🛠️ Hardware Setup

UniProg-X runs on a standard **Raspberry Pi Pico** (RP2040).

### Pinout Configuration

| Signal | GPIO Pin | Physical Pin | Description |
| :--- | :--- | :--- | :--- |
| **I2C SDA** | GPIO 4 | Pin 6 | I2C Data |
| **I2C SCL** | GPIO 5 | Pin 7 | I2C Clock |
| **SPI RX** | GPIO 16 | Pin 21 | MISO (Master In Slave Out) |
| **SPI CS** | GPIO 17 | Pin 22 | Chip Select |
| **SPI SCK** | GPIO 18 | Pin 24 | SPI Clock |
| **SPI TX** | GPIO 19 | Pin 25 | MOSI (Master Out Slave In) |
| **AVR RESET** | GPIO 20 | Pin 26 | AVR Reset (ISP) |
| **SWD SWCLK** | GPIO 2 | Pin 4 | SWD Clock (STM32) |
| **SWD SWDIO** | GPIO 3 | Pin 5 | SWD Data (STM32) |
| **GND** | GND | Pin 3, 8, etc. | Ground |
| **3V3** | 3V3(OUT) | Pin 36 | 3.3V Power Supply |

> **Note**: Ensure your target chip operates at 3.3V. For 1.8V or 5V chips, level shifters are required.

## 💾 Supported Chips

### I2C EEPROMs (24CXX / AT24CXX)
*   **Standard**: 24C01, 24C02, 24C04, 24C08, 24C16, 24C32, 24C64, 24C128, 24C256, 24C512
*   **Atmel**: AT24C01 - AT24C512
*   *Auto-detection supported for standard address 0x50*

### SPI Flash (W25QXX)
*   **Winbond**: W25Q16 (2MB), W25Q32 (4MB), W25Q64 (8MB), W25Q128 (16MB), W25Q256 (32MB)
*   **Generic**: Compatible with most standard SPI Flash chips supporting JEDEC ID (0x9F).

### AVR Microcontrollers (ISP)
*   **ATmega**: ATmega328P (32KB), ATmega168 (16KB)
*   **ATtiny**: ATtiny85 (8KB)
*   *In-System Programming (ISP) via SPI protocol*

### STM32 Microcontrollers (SWD)
*   **STM32F1**: STM32F103C8 (64KB), STM32F103CB (128KB)
*   *Serial Wire Debug (SWD) for flash read and RAM write*

## 📦 Installation & Build

### Firmware (RP2040)
1.  Install **PlatformIO** (VS Code extension or CLI).
2.  Navigate to the `firmware/` directory.
3.  Build and upload:
    ```bash
    pio run -t upload
    ```

### Web Client
1.  Install **Node.js** (v16+).
2.  Navigate to the `web-client/` directory.
3.  Install dependencies:
    ```bash
    npm install
    ```
4.  Start the development server:
    ```bash
    npm run dev
    ```
5.  Open `http://localhost:5173` in a compatible browser.

## 📖 Usage Guide

1.  **Connect**: Plug in your RP2040 and click **"INITIALIZE LINK"** in the web interface. Select the device from the browser prompt.
2.  **Select Mode**: Choose the appropriate tab:
    *   **I2C**: For I2C EEPROMs
    *   **SPI**: For SPI Flash chips
    *   **AVR**: For AVR microcontrollers (ISP)
    *   **STM32**: For STM32 microcontrollers (SWD)
3.  **Scan** (I2C/SPI modes):
    *   Click **"SCAN I2C"** for EEPROMs (I2C mode).
    *   Click **"SCAN SPI"** for Flash chips (SPI mode).
    *   *The system will attempt to auto-select the detected chip.*
4.  **Select Target**: Choose your chip from the dropdown (auto-selected on mode change).
5.  **Read**: Click **"READ"** to dump the chip's memory into the Hex Editor.
6.  **Edit/Load**: Modify data directly in the editor or use **"LOAD FILE"** to import a binary.
7.  **Write**: Click **"WRITE"** to program the chip.
8.  **Verify**: Click **"VERIFY"** to ensure data integrity.
9.  **Erase**: Click **"ERASE"** to clear the chip (not available for STM32).

## 🤝 Contributing

Contributions are welcome! Please read `protocol.md` to understand the communication standard before submitting PRs.

## 📄 License

MIT License - Copyright (c) 2025 UniProg-X Team
