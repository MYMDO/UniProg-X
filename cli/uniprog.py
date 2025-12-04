#!/usr/bin/env python3
"""
UniProg-X CLI - Command Line Interface for OPUP Protocol Testing
Usage: python uniprog.py [options] <command> [arguments]
"""

import serial
import struct
import sys
import argparse
import time
from typing import Optional, Tuple, List

# OPUP Protocol Constants
OPUP_SOF = 0xA5
OPUP_FLAG_RESP = 0x01
OPUP_FLAG_ERROR = 0x02

# OPUP Commands
class OpupCmd:
    SYS_PING = 0x01
    SYS_GET_CAPS = 0x02
    SYS_GET_STATUS = 0x03
    SYS_RESET = 0x04
    SYS_GPIO_TEST = 0x05  # Debug: Read GPIO states
    
    I2C_SCAN = 0x10
    I2C_READ = 0x11
    I2C_WRITE = 0x12
    
    SPI_SCAN = 0x20
    SPI_CONFIG = 0x21
    SPI_XFER = 0x22
    
    QSPI_SET_MODE = 0x25
    QSPI_READ = 0x26
    QSPI_WRITE = 0x27
    QSPI_FAST_READ = 0x28
    QSPI_CMD = 0x29
    
    ISP_ENTER = 0x30
    ISP_XFER = 0x31
    ISP_EXIT = 0x32
    
    SWD_INIT = 0x40
    SWD_READ = 0x41
    SWD_WRITE = 0x42

# CRC32 Table (same as in protocol)
CRC32_TABLE = []

def init_crc32_table():
    global CRC32_TABLE
    for i in range(256):
        crc = i
        for _ in range(8):
            if crc & 1:
                crc = (crc >> 1) ^ 0xEDB88320
            else:
                crc >>= 1
        CRC32_TABLE.append(crc)

def calculate_crc32(data: bytes) -> int:
    crc = 0xFFFFFFFF
    for byte in data:
        crc = CRC32_TABLE[(crc ^ byte) & 0xFF] ^ (crc >> 8)
    return crc ^ 0xFFFFFFFF

class OPUPClient:
    def __init__(self, port: str, baudrate: int = 115200, timeout: float = 2.0):
        self.port = port
        self.baudrate = baudrate
        self.timeout = timeout
        self.serial: Optional[serial.Serial] = None
        self.seq = 0
        init_crc32_table()
    
    def connect(self):
        """Connect to UniProg-X"""
        try:
            self.serial = serial.Serial(
                port=self.port,
                baudrate=self.baudrate,
                timeout=self.timeout
            )
            # Wait for device to initialize
            time.sleep(0.5)
            self.serial.reset_input_buffer()
            print(f"✓ Connected to {self.port}")
            return True
        except serial.SerialException as e:
            print(f"✗ Failed to connect: {e}")
            return False
    
    def disconnect(self):
        """Disconnect from UniProg-X"""
        if self.serial:
            self.serial.close()
            self.serial = None
    
    def send_command(self, cmd: int, payload: bytes = b'') -> Tuple[bool, bytes]:
        """Send OPUP command and receive response"""
        if not self.serial:
            return False, b''
        
        self.seq = (self.seq + 1) & 0xFF
        
        # Build packet: SOF + SEQ + CMD + FLAGS + LEN_L + LEN_H + DATA + CRC32
        header = bytes([
            OPUP_SOF,
            self.seq,
            cmd,
            0,  # FLAGS = 0 for request
            len(payload) & 0xFF,
            (len(payload) >> 8) & 0xFF
        ])
        
        packet = header + payload
        crc = calculate_crc32(packet)
        packet += struct.pack('<I', crc)
        
        # Send
        self.serial.write(packet)
        print(f"TX: {packet.hex(' ')}")
        
        # Receive response
        try:
            # Read header (6 bytes)
            rx_header = self.serial.read(6)
            if len(rx_header) < 6:
                print(f"✗ Timeout waiting for response header")
                return False, b''
            
            if rx_header[0] != OPUP_SOF:
                print(f"✗ Invalid SOF: 0x{rx_header[0]:02x}")
                return False, b''
            
            rx_seq = rx_header[1]
            rx_cmd = rx_header[2]
            rx_flags = rx_header[3]
            rx_len = rx_header[4] | (rx_header[5] << 8)
            
            # Read payload
            rx_payload = self.serial.read(rx_len) if rx_len > 0 else b''
            
            # Read CRC
            rx_crc_bytes = self.serial.read(4)
            rx_crc = struct.unpack('<I', rx_crc_bytes)[0]
            
            # Verify CRC
            full_rx = rx_header + rx_payload
            calc_crc = calculate_crc32(full_rx)
            
            print(f"RX: {(rx_header + rx_payload + rx_crc_bytes).hex(' ')}")
            
            if rx_crc != calc_crc:
                print(f"✗ CRC mismatch: RX=0x{rx_crc:08x} CALC=0x{calc_crc:08x}")
                return False, b''
            
            if rx_flags & OPUP_FLAG_ERROR:
                print(f"✗ Error response: {rx_payload.hex(' ')}")
                return False, rx_payload
            
            return True, rx_payload
            
        except Exception as e:
            print(f"✗ Error receiving response: {e}")
            return False, b''
    
    # === High-Level Commands ===
    
    def ping(self) -> bool:
        """Test connection with PING command"""
        ok, payload = self.send_command(OpupCmd.SYS_PING)
        if ok and payload == bytes([0xCA, 0xFE]):
            print("✓ PING OK (CAFE)")
            return True
        print("✗ PING failed")
        return False
    
    def get_status(self):
        """Get device status"""
        ok, payload = self.send_command(OpupCmd.SYS_GET_STATUS)
        if ok and len(payload) >= 9:
            status = payload[0]
            uptime = struct.unpack('<I', payload[1:5])[0]
            free_ram = struct.unpack('<I', payload[5:9])[0]
            status_str = ['Idle', 'Busy', 'Error'][status] if status < 3 else 'Unknown'
            print(f"Status: {status_str}")
            print(f"Uptime: {uptime}ms ({uptime/1000:.1f}s)")
            print(f"Free RAM: {free_ram} bytes")
            return True
        return False
    
    def gpio_test(self):
        """Read SPI GPIO states for debugging"""
        ok, payload = self.send_command(OpupCmd.SYS_GPIO_TEST)
        if ok and len(payload) >= 6:
            cs = payload[0]
            sck = payload[1]
            mosi = payload[2]
            miso = payload[3]
            io2 = payload[4]
            io3 = payload[5]
            print("SPI GPIO States:")
            print(f"  GP17 (CS)   = {cs} {'(HIGH)' if cs else '(LOW)'}")
            print(f"  GP18 (SCK)  = {sck}")
            print(f"  GP19 (MOSI) = {mosi}")
            print(f"  GP16 (MISO) = {miso} {'<-- Should be HIGH with pullup' if not miso else ''}")
            print(f"  GP21 (IO2)  = {io2}")
            print(f"  GP22 (IO3)  = {io3}")
            return True
        print("✗ GPIO test failed")
        return False
    
    def i2c_scan(self) -> List[int]:
        """Scan I2C bus for devices"""
        ok, payload = self.send_command(OpupCmd.I2C_SCAN)
        if ok and len(payload) >= 1:
            count = payload[0]
            addresses = list(payload[1:count+1]) if count > 0 else []
            if count > 0:
                print(f"✓ Found {count} I2C device(s): {[hex(a) for a in addresses]}")
            else:
                print("✓ No I2C devices found")
            return addresses
        print("✗ I2C scan failed")
        return []
    
    def spi_scan(self) -> Tuple[int, int, int]:
        """Scan SPI bus for flash chip (JEDEC ID)"""
        ok, payload = self.send_command(OpupCmd.SPI_SCAN)
        if ok and len(payload) >= 1:
            count = payload[0]
            if count > 0 and len(payload) >= 4:
                mfg = payload[1]
                dev_h = payload[2]
                dev_l = payload[3]
                dev_id = (dev_h << 8) | dev_l
                
                # Decode manufacturer
                mfg_names = {
                    0xEF: "Winbond",
                    0xC8: "GigaDevice",
                    0xC2: "Macronix",
                    0x01: "Spansion/Cypress",
                    0x20: "Micron/Numonyx",
                    0xBF: "SST/Microchip",
                }
                mfg_name = mfg_names.get(mfg, f"Unknown(0x{mfg:02x})")
                
                print(f"✓ SPI Flash detected:")
                print(f"  Manufacturer: {mfg_name} (0x{mfg:02X})")
                print(f"  Device ID: 0x{dev_id:04X}")
                return mfg, dev_h, dev_l
            else:
                print("✓ No SPI flash detected")
                return 0, 0, 0
        print("✗ SPI scan failed")
        return 0, 0, 0
    
    def spi_transfer(self, data: bytes) -> bytes:
        """Raw SPI transfer"""
        ok, payload = self.send_command(OpupCmd.SPI_XFER, data)
        if ok:
            print(f"✓ SPI transfer: {data.hex(' ')} -> {payload.hex(' ')}")
            return payload
        print("✗ SPI transfer failed")
        return b''
    
    def spi_read_jedec(self) -> bytes:
        """Read JEDEC ID directly via SPI_XFER"""
        # 0x9F = Read JEDEC ID, followed by 3 dummy bytes
        return self.spi_transfer(bytes([0x9F, 0x00, 0x00, 0x00]))
    
    def qspi_set_mode(self, mode: int) -> bool:
        """Set QSPI mode (0-5)"""
        mode_names = {
            0: "Standard (1-1-1)",
            1: "Dual Output (1-1-2)",
            2: "Dual I/O (1-2-2)",
            3: "Quad Output (1-1-4)",
            4: "Quad I/O (1-4-4)",
            5: "QPI (4-4-4)",
        }
        ok, payload = self.send_command(OpupCmd.QSPI_SET_MODE, bytes([mode]))
        if ok and len(payload) >= 1:
            current = payload[0]
            print(f"✓ QSPI mode set to {mode}: {mode_names.get(mode, 'Unknown')}")
            return True
        print("✗ Failed to set QSPI mode")
        return False
    
    def qspi_read(self, cmd: int, addr: int, addr_len: int, dummy: int, read_len: int) -> bytes:
        """QSPI read operation"""
        # Build payload: [Cmd:1][AddrLen:1][Addr:3-4][DummyCycles:1][ReadLen:2]
        payload = bytes([cmd, addr_len])
        # Add address bytes (little-endian)
        for i in range(addr_len):
            payload += bytes([(addr >> (i * 8)) & 0xFF])
        payload += bytes([dummy])
        payload += bytes([read_len & 0xFF, (read_len >> 8) & 0xFF])
        
        ok, data = self.send_command(OpupCmd.QSPI_READ, payload)
        if ok:
            print(f"✓ QSPI read {read_len} bytes from 0x{addr:06X}")
            return data
        print("✗ QSPI read failed")
        return b''
    
    def qspi_fast_read(self, addr: int, pages: int = 1) -> bytes:
        """Fast read pages using current QSPI mode"""
        # Payload: [Addr:3][PageCount:1]
        payload = bytes([
            addr & 0xFF,
            (addr >> 8) & 0xFF,
            (addr >> 16) & 0xFF,
            pages
        ])
        ok, data = self.send_command(OpupCmd.QSPI_FAST_READ, payload)
        if ok:
            print(f"✓ Fast read {pages} pages ({len(data)} bytes) from 0x{addr:06X}")
            return data
        print("✗ Fast read failed")
        return b''
    
    def qspi_cmd(self, cmd: int, tx_data: bytes = b'') -> bytes:
        """Execute raw QSPI command"""
        # Payload: [Cmd:1][TxLen:1][TxData:N]
        payload = bytes([cmd, len(tx_data)]) + tx_data
        ok, data = self.send_command(OpupCmd.QSPI_CMD, payload)
        if ok:
            print(f"✓ QSPI cmd 0x{cmd:02X}: TX {len(tx_data)} -> RX {len(data)}")
            return data
        print("✗ QSPI cmd failed")
        return b''
    
    def qspi_test_all_modes(self):
        """Test JEDEC ID read in all QSPI modes"""
        print("\n=== Testing All QSPI Modes ===")
        mode_names = [
            (0, "Standard (1-1-1)", 0x9F),      # JEDEC command
            (1, "Dual Output (1-1-2)", 0x9F),   # JEDEC still works
            (2, "Dual I/O (1-2-2)", 0x9F),      # JEDEC still works
            (3, "Quad Output (1-1-4)", 0x9F),   # JEDEC still works
            (4, "Quad I/O (1-4-4)", 0x9F),      # JEDEC still works
        ]
        
        results = []
        for mode, name, cmd in mode_names:
            print(f"\n--- Mode {mode}: {name} ---")
            self.qspi_set_mode(mode)
            # Read JEDEC ID using qspi_cmd
            data = self.qspi_cmd(cmd, b'\x00\x00\x00')
            if len(data) >= 3:
                mfg, dev_h, dev_l = data[0], data[1], data[2]
                dev_id = (dev_h << 8) | dev_l
                ok = mfg != 0x00 and mfg != 0xFF
                status = "✓" if ok else "✗"
                print(f"{status} JEDEC ID: Mfg=0x{mfg:02X} Dev=0x{dev_id:04X}")
                results.append((mode, name, ok, mfg, dev_id))
            else:
                print("✗ No data received")
                results.append((mode, name, False, 0, 0))
        
        # Reset to standard mode
        self.qspi_set_mode(0)
        
        print("\n=== Results Summary ===")
        for mode, name, ok, mfg, dev_id in results:
            status = "PASS" if ok else "FAIL"
            print(f"  Mode {mode}: {name} -> [{status}]")
        
        return results
    
    def isp_enter(self) -> bool:
        """Enter ISP programming mode"""
        ok, payload = self.send_command(OpupCmd.ISP_ENTER)
        if ok and len(payload) >= 1 and payload[0] == 1:
            print("✓ Entered ISP mode")
            return True
        print("✗ Failed to enter ISP mode")
        return False
    
    def isp_exit(self) -> bool:
        """Exit ISP programming mode"""
        ok, _ = self.send_command(OpupCmd.ISP_EXIT)
        if ok:
            print("✓ Exited ISP mode")
            return True
        print("✗ Failed to exit ISP mode")
        return False
    
    def isp_xfer(self, b0: int, b1: int, b2: int, b3: int) -> Tuple[int, int, int, int]:
        """Execute 4-byte ISP command"""
        ok, payload = self.send_command(OpupCmd.ISP_XFER, bytes([b0, b1, b2, b3]))
        if ok and len(payload) >= 4:
            return payload[0], payload[1], payload[2], payload[3]
        return 0, 0, 0, 0
    
    def avr_read_signature(self) -> Tuple[int, int, int]:
        """Read AVR device signature"""
        if self.isp_enter():
            # Read signature bytes
            _, _, _, s0 = self.isp_xfer(0x30, 0x00, 0x00, 0x00)
            _, _, _, s1 = self.isp_xfer(0x30, 0x00, 0x01, 0x00)
            _, _, _, s2 = self.isp_xfer(0x30, 0x00, 0x02, 0x00)
            print(f"✓ AVR Signature: 0x{s0:02X} 0x{s1:02X} 0x{s2:02X}")
            self.isp_exit()
            return s0, s1, s2
        return 0, 0, 0


def main():
    parser = argparse.ArgumentParser(
        description='UniProg-X CLI - OPUP Protocol Testing Tool',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Commands:
  ping              Test connection
  status            Get device status
  i2c-scan          Scan I2C bus
  spi-scan          Scan for SPI flash (JEDEC ID)
  spi-raw <hex>     Raw SPI transfer (hex bytes)
  qspi-mode <0-5>   Set QSPI mode
  avr-sig           Read AVR signature

Examples:
  python uniprog.py -p /dev/ttyACM0 ping
  python uniprog.py -p /dev/ttyACM0 spi-scan
  python uniprog.py -p /dev/ttyACM0 spi-raw 9F000000
  python uniprog.py -p /dev/ttyACM0 qspi-mode 3
"""
    )
    
    parser.add_argument('-p', '--port', default='/dev/ttyACM0',
                        help='Serial port (default: /dev/ttyACM0)')
    parser.add_argument('-b', '--baud', type=int, default=115200,
                        help='Baud rate (default: 115200)')
    parser.add_argument('-t', '--timeout', type=float, default=2.0,
                        help='Timeout in seconds (default: 2.0)')
    parser.add_argument('-v', '--verbose', action='store_true',
                        help='Verbose output')
    parser.add_argument('command', nargs='?', default='ping',
                        help='Command to execute')
    parser.add_argument('args', nargs='*', help='Command arguments')
    
    args = parser.parse_args()
    
    client = OPUPClient(args.port, args.baud, args.timeout)
    
    if not client.connect():
        sys.exit(1)
    
    try:
        cmd = args.command.lower()
        
        if cmd == 'ping':
            client.ping()
        
        elif cmd == 'status':
            client.get_status()
        
        elif cmd == 'i2c-scan':
            client.i2c_scan()
        
        elif cmd == 'spi-scan':
            client.spi_scan()
        
        elif cmd == 'spi-raw':
            if not args.args:
                print("Usage: spi-raw <hex bytes>")
                print("Example: spi-raw 9F000000")
            else:
                hex_data = ''.join(args.args).replace(' ', '')
                data = bytes.fromhex(hex_data)
                client.spi_transfer(data)
        
        elif cmd == 'spi-jedec':
            client.spi_read_jedec()
        
        elif cmd == 'qspi-mode':
            if not args.args:
                print("Usage: qspi-mode <0-5>")
                print("  0 = Standard (1-1-1)")
                print("  1 = Dual Output (1-1-2)")
                print("  2 = Dual I/O (1-2-2)")
                print("  3 = Quad Output (1-1-4)")
                print("  4 = Quad I/O (1-4-4)")
                print("  5 = QPI (4-4-4)")
            else:
                mode = int(args.args[0])
                client.qspi_set_mode(mode)
        
        elif cmd == 'avr-sig':
            client.avr_read_signature()
        
        elif cmd == 'isp-enter':
            client.isp_enter()
        
        elif cmd == 'isp-exit':
            client.isp_exit()
        
        elif cmd == 'help':
            parser.print_help()
        
        elif cmd == 'gpio-test':
            client.gpio_test()
        
        elif cmd == 'qspi-read':
            if len(args.args) < 2:
                print("Usage: qspi-read <addr> <len>")
                print("Example: qspi-read 0x000000 256")
            else:
                addr = int(args.args[0], 0)
                length = int(args.args[1])
                data = client.qspi_read(0x03, addr, 3, 0, length)
                if data:
                    print(f"Data: {data[:32].hex(' ')}{'...' if len(data) > 32 else ''}")
        
        elif cmd == 'qspi-fast-read':
            if len(args.args) < 1:
                print("Usage: qspi-fast-read <addr> [pages]")
                print("Example: qspi-fast-read 0x000000 1")
            else:
                addr = int(args.args[0], 0)
                pages = int(args.args[1]) if len(args.args) > 1 else 1
                data = client.qspi_fast_read(addr, pages)
                if data:
                    print(f"Data: {data[:32].hex(' ')}{'...' if len(data) > 32 else ''}")
        
        elif cmd == 'qspi-cmd':
            if not args.args:
                print("Usage: qspi-cmd <cmd_hex> [data_hex]")
                print("Example: qspi-cmd 9F 000000")
            else:
                cmd_byte = int(args.args[0], 16)
                tx_data = bytes.fromhex(args.args[1]) if len(args.args) > 1 else b''
                data = client.qspi_cmd(cmd_byte, tx_data)
                if data:
                    print(f"RX: {data.hex(' ')}")
        
        elif cmd == 'qspi-test':
            client.qspi_test_all_modes()
        
        else:
            print(f"Unknown command: {cmd}")
            print("Use 'help' for available commands")
    
    finally:
        client.disconnect()


if __name__ == '__main__':
    main()
