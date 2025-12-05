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
        # Firmware expects address in Little-Endian
        payload = bytes([cmd, addr_len])
        # Add address bytes (Little-Endian)
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
    
    def qspi_read_status(self) -> Tuple[int, int]:
        """Read Status Register 1 and 2"""
        self.qspi_set_mode(0)  # Standard mode
        # Read SR1
        sr1_data = self.qspi_cmd(0x05, b'\x00')  # Read Status Register 1
        sr1 = sr1_data[0] if sr1_data else 0
        # Read SR2
        sr2_data = self.qspi_cmd(0x35, b'\x00')  # Read Status Register 2
        sr2 = sr2_data[0] if sr2_data else 0
        print(f"Status Registers: SR1=0x{sr1:02X} SR2=0x{sr2:02X}")
        print(f"  SR1 bits: BUSY={sr1&1} WEL={(sr1>>1)&1} BP0-2={(sr1>>2)&7} TB={(sr1>>5)&1} SEC={(sr1>>6)&1} SRP={(sr1>>7)&1}")
        print(f"  SR2 bits: SRL={(sr2>>0)&1} QE={(sr2>>1)&1} LB1-3={(sr2>>2)&7} CMP={(sr2>>6)&1} SUS={(sr2>>7)&1}")
        return sr1, sr2
    
    def qspi_quad_enable(self) -> bool:
        """Enable Quad mode on the flash chip by setting QE bit"""
        print("\n=== Enabling Quad Mode ===")
        self.qspi_set_mode(0)  # Standard mode
        
        # First detect chip to use correct method
        jedec = self.qspi_cmd(0x9F, b'\x00\x00\x00')
        if len(jedec) < 3:
            print("✗ Failed to read JEDEC ID")
            return False
        
        mfg = jedec[0]
        print(f"Detected Manufacturer: 0x{mfg:02X}")
        
        # Read current status
        sr1_data = self.qspi_cmd(0x05, b'\x00')
        sr2_data = self.qspi_cmd(0x35, b'\x00')
        sr1 = sr1_data[0] if sr1_data else 0
        sr2 = sr2_data[0] if sr2_data else 0
        print(f"Current SR1=0x{sr1:02X} SR2=0x{sr2:02X}")
        
        # Check if QE is already set (bit 1 of SR2 for most chips)
        qe_bit = (sr2 >> 1) & 1
        if qe_bit:
            print("✓ QE bit already set, Quad mode enabled")
            return True
        
        # Different methods for different manufacturers
        if mfg == 0xEF:  # Winbond
            print("Using Winbond method: Write SR2 with 0x31")
            # Write Enable
            self.qspi_cmd(0x06, b'')
            # Write SR2 (0x31) with QE bit set
            self.qspi_cmd(0x31, bytes([0x02]))  # Set QE bit (bit 1)
            
        elif mfg == 0xC2:  # Macronix
            print("Using Macronix method: Write SR1 with 0x01 + 0x40")
            # For Macronix, QE is bit 6 of SR1
            # Write Enable
            self.qspi_cmd(0x06, b'')
            # Write Status Register (0x01) with QE bit
            new_sr1 = sr1 | 0x40  # Set bit 6
            self.qspi_cmd(0x01, bytes([new_sr1]))
            
        elif mfg == 0xC8:  # GigaDevice  
            print("Using GigaDevice method: Write SR2 with 0x31")
            # Write Enable
            self.qspi_cmd(0x06, b'')
            # Write SR2 with QE bit
            self.qspi_cmd(0x31, bytes([0x02]))
            
        else:
            print(f"Unknown manufacturer 0x{mfg:02X}, trying Winbond method")
            self.qspi_cmd(0x06, b'')
            self.qspi_cmd(0x31, bytes([0x02]))
        
        # Wait for write to complete
        import time
        time.sleep(0.1)  # 100ms wait
        
        # Verify QE is set
        sr1_data = self.qspi_cmd(0x05, b'\x00')
        sr2_data = self.qspi_cmd(0x35, b'\x00')
        sr1 = sr1_data[0] if sr1_data else 0
        sr2 = sr2_data[0] if sr2_data else 0
        print(f"After: SR1=0x{sr1:02X} SR2=0x{sr2:02X}")
        
        # Check QE based on manufacturer
        if mfg == 0xC2:  # Macronix - QE is bit 6 of SR1
            qe_enabled = (sr1 >> 6) & 1
        else:  # Others - QE is bit 1 of SR2
            qe_enabled = (sr2 >> 1) & 1
        
        if qe_enabled:
            print("✓ QE bit successfully set! Quad mode enabled.")
            return True
        else:
            print("✗ Failed to set QE bit")
            return False
    
    def flash_wait_busy(self, timeout_ms: int = 5000) -> bool:
        """Wait for flash to not be busy"""
        start = time.time()
        while (time.time() - start) * 1000 < timeout_ms:
            sr1_data = self.qspi_cmd(0x05, b'\x00')  # Read Status Register 1
            if sr1_data and (sr1_data[0] & 0x01) == 0:  # BUSY bit cleared
                return True
            time.sleep(0.001)  # 1ms
        print("✗ Flash timeout - busy too long")
        return False
    
    def flash_write_enable(self) -> bool:
        """Send Write Enable command"""
        self.qspi_cmd(0x06, b'')  # Write Enable
        sr1_data = self.qspi_cmd(0x05, b'\x00')  # Check WEL bit
        if sr1_data and (sr1_data[0] & 0x02):  # WEL = 1
            return True
        print("✗ Write Enable failed")
        return False
    
    def flash_read(self, addr: int, length: int, show_data: bool = True) -> bytes:
        """Read data from flash using current mode"""
        self.qspi_set_mode(0)  # Use standard mode for reliability
        
        # Use normal read (0x03) - works in all modes
        data = self.qspi_read(0x03, addr, 3, 0, length)
        
        if show_data and data:
            print(f"✓ Read {len(data)} bytes from 0x{addr:06X}")
            # Show hex dump (first 64 bytes)
            for i in range(0, min(len(data), 64), 16):
                hex_str = ' '.join(f'{b:02X}' for b in data[i:i+16])
                ascii_str = ''.join(chr(b) if 32 <= b < 127 else '.' for b in data[i:i+16])
                print(f"  {addr+i:06X}: {hex_str:<48} {ascii_str}")
            if len(data) > 64:
                print(f"  ... ({len(data) - 64} more bytes)")
        
        return data
    
    def flash_erase_sector(self, addr: int) -> bool:
        """Erase 4KB sector"""
        self.qspi_set_mode(0)  # Standard mode
        sector_addr = addr & 0xFFF000  # Align to 4KB boundary
        
        print(f"Erasing sector at 0x{sector_addr:06X} (4KB)...")
        
        if not self.flash_write_enable():
            return False
        
        # Sector Erase (0x20) with 24-bit address
        self.qspi_cmd(0x20, bytes([
            (sector_addr >> 16) & 0xFF,
            (sector_addr >> 8) & 0xFF,
            sector_addr & 0xFF
        ]))
        
        # Wait for erase to complete (typically 45-400ms)
        if self.flash_wait_busy(10000):  # 10 second timeout
            print(f"✓ Sector erased at 0x{sector_addr:06X}")
            return True
        return False
    
    def flash_erase_block(self, addr: int, size_kb: int = 64) -> bool:
        """Erase 32KB or 64KB block"""
        self.qspi_set_mode(0)
        
        if size_kb == 32:
            block_addr = addr & 0xFF8000  # Align to 32KB
            cmd = 0x52
        else:
            block_addr = addr & 0xFF0000  # Align to 64KB
            cmd = 0xD8
        
        print(f"Erasing {size_kb}KB block at 0x{block_addr:06X}...")
        
        if not self.flash_write_enable():
            return False
        
        self.qspi_cmd(cmd, bytes([
            (block_addr >> 16) & 0xFF,
            (block_addr >> 8) & 0xFF,
            block_addr & 0xFF
        ]))
        
        if self.flash_wait_busy(30000):  # 30 second timeout
            print(f"✓ {size_kb}KB block erased at 0x{block_addr:06X}")
            return True
        return False
    
    def flash_chip_erase(self) -> bool:
        """Erase entire chip (DANGEROUS!)"""
        self.qspi_set_mode(0)
        print("⚠ CHIP ERASE - This will take 40-200 seconds!")
        
        if not self.flash_write_enable():
            return False
        
        self.qspi_cmd(0xC7, b'')  # Chip Erase
        
        print("Erasing chip... (please wait)")
        if self.flash_wait_busy(300000):  # 5 minute timeout
            print("✓ Chip erased!")
            return True
        return False
    
    def flash_write_page(self, addr: int, data: bytes) -> bool:
        """Write up to 256 bytes (one page)"""
        self.qspi_set_mode(0)  # Standard mode for write
        
        if len(data) > 256:
            data = data[:256]
        
        # Use actual address, not page-aligned (allows partial page writes)
        write_addr = addr
        
        if not self.flash_write_enable():
            return False
        
        # Use QSPI_WRITE (0x27) which supports larger payloads
        # Format: [Cmd:1][AddrLen:1][Addr:3 (Little-Endian)][Data:N]
        # Firmware expects address Little-Endian
        payload = bytes([
            0x02,  # Page Program command
            3,     # Address length = 3 bytes
            write_addr & 0xFF,          # LSB first
            (write_addr >> 8) & 0xFF,
            (write_addr >> 16) & 0xFF   # MSB last
        ]) + data
        
        ok, _ = self.send_command(OpupCmd.QSPI_WRITE, payload)
        if not ok:
            print("✗ QSPI_WRITE failed")
            return False
        
        if self.flash_wait_busy(5000):  # 5 second timeout (typ 0.4-3ms)
            print(f"✓ Wrote {len(data)} bytes at 0x{write_addr:06X}")
            return True
        return False
    
    def flash_write(self, addr: int, data: bytes) -> bool:
        """Write data spanning multiple pages"""
        total = len(data)
        written = 0
        current_addr = addr
        
        print(f"Writing {total} bytes starting at 0x{addr:06X}...")
        
        while written < total:
            # Calculate bytes to write in this page
            page_offset = current_addr & 0xFF
            page_remaining = 256 - page_offset
            chunk_size = min(page_remaining, total - written)
            
            chunk = data[written:written + chunk_size]
            if not self.flash_write_page(current_addr, chunk):
                print(f"✗ Write failed at 0x{current_addr:06X}")
                return False
            
            written += chunk_size
            current_addr += chunk_size
            
            # Progress indicator
            pct = (written * 100) // total
            print(f"\r  Progress: {pct}% ({written}/{total} bytes)", end='', flush=True)
        
        print()  # Newline
        print(f"✓ Write complete: {written} bytes")
        return True
    
    def flash_test_rw(self, addr: int = 0x100000):
        """Test read/write at a specific address"""
        print(f"\n=== Flash Read/Write Test at 0x{addr:06X} ===")
        
        # Read original data
        print("\n1. Reading original data...")
        original = self.flash_read(addr, 256, show_data=True)
        
        # Erase sector
        print("\n2. Erasing sector...")
        if not self.flash_erase_sector(addr):
            return False
        
        # Verify erase (should be all 0xFF)
        print("\n3. Verifying erase...")
        erased = self.flash_read(addr, 256, show_data=False)
        all_ff = all(b == 0xFF for b in erased)
        if all_ff:
            print("✓ Sector erased (all 0xFF)")
        else:
            print("✗ Erase verification failed!")
            return False
        
        # Write test pattern
        print("\n4. Writing test pattern...")
        test_data = bytes(range(256))  # 0x00-0xFF
        if not self.flash_write_page(addr, test_data):
            return False
        
        # Verify write
        print("\n5. Verifying write...")
        readback = self.flash_read(addr, 256, show_data=True)
        if readback == test_data:
            print("✓ Write verification PASSED!")
        else:
            print("✗ Write verification FAILED!")
            # Show differences
            for i, (expected, actual) in enumerate(zip(test_data, readback)):
                if expected != actual:
                    print(f"  Mismatch at offset {i}: expected 0x{expected:02X}, got 0x{actual:02X}")
            return False
        
        print("\n=== Read/Write Test PASSED! ===")
        return True
    
    def flash_benchmark(self, test_size_kb: int = 4, addr: int = 0x100000):
        """Benchmark read/write speed in all QSPI modes"""
        test_size = test_size_kb * 1024
        
        print(f"\n{'='*60}")
        print(f"  UniProg-X Flash Benchmark")
        print(f"  Chip: W25Q128 | Test Size: {test_size_kb}KB | Address: 0x{addr:06X}")
        print(f"{'='*60}")
        
        # First, detect chip
        print("\n📟 Detecting flash chip...")
        self.qspi_set_mode(0)
        jedec = self.qspi_cmd(0x9F, b'\x00\x00\x00')
        if len(jedec) >= 3:
            mfg, dev_h, dev_l = jedec[0], jedec[1], jedec[2]
            print(f"   Manufacturer: 0x{mfg:02X} | Device: 0x{dev_h:02X}{dev_l:02X}")
        
        # Prepare test data
        test_data = bytes(range(256)) * (test_size // 256)
        
        # Define modes to test
        modes = [
            (0, "Standard (1-1-1)", 0x03, 0),      # Read, no dummy
            (0, "Fast Read (1-1-1)", 0x0B, 8),    # Fast Read, 8 dummy
            (1, "Dual Output (1-1-2)", 0x3B, 8),  # Dual Out
            (2, "Dual I/O (1-2-2)", 0xBB, 4),     # Dual I/O
            (3, "Quad Output (1-1-4)", 0x6B, 8),  # Quad Out
            (4, "Quad I/O (1-4-4)", 0xEB, 6),     # Quad I/O
        ]
        
        results = []
        
        # Erase test area first
        print(f"\n🗑️  Erasing {test_size_kb}KB at 0x{addr:06X}...")
        sectors = (test_size + 4095) // 4096
        erase_start = time.time()
        for i in range(sectors):
            sector_addr = addr + (i * 4096)
            self.qspi_set_mode(0)
            if not self.flash_write_enable():
                print("   Erase failed!")
                return
            self.qspi_cmd(0x20, bytes([
                (sector_addr >> 16) & 0xFF,
                (sector_addr >> 8) & 0xFF,
                sector_addr & 0xFF
            ]))
            self.flash_wait_busy(10000)
        erase_time = time.time() - erase_start
        print(f"   Erase: {erase_time:.2f}s ({test_size_kb / erase_time:.1f} KB/s)")
        
        # Write test data (standard mode only for now)
        print(f"\n📝 Writing {test_size_kb}KB test pattern...")
        self.qspi_set_mode(0)
        write_start = time.time()
        pages = test_size // 256
        for i in range(pages):
            page_addr = addr + (i * 256)
            page_data = test_data[i*256:(i+1)*256]
            
            if not self.flash_write_enable():
                print("   Write failed (WREN)!")
                return
            
            # Use QSPI_WRITE for large payload (address Little-Endian for firmware)
            payload = bytes([
                0x02,  # Page Program
                3,     # AddrLen
                page_addr & 0xFF,          # LSB first
                (page_addr >> 8) & 0xFF,
                (page_addr >> 16) & 0xFF   # MSB last
            ]) + page_data
            
            self.send_command(OpupCmd.QSPI_WRITE, payload)
            self.flash_wait_busy(5000)
            
            # Progress
            pct = ((i + 1) * 100) // pages
            print(f"\r   Progress: {pct}%", end='', flush=True)
        
        write_time = time.time() - write_start
        write_speed = test_size / write_time / 1024
        print(f"\n   Write: {write_time:.2f}s ({write_speed:.1f} KB/s)")
        results.append(("Write (Standard)", write_time, write_speed))
        
        # Benchmark READ in each mode
        print(f"\n📖 Reading {test_size_kb}KB in each mode...")
        
        for mode, mode_name, read_cmd, dummy in modes:
            self.qspi_set_mode(mode)
            
            # Read data
            read_start = time.time()
            read_data = b''
            
            # Read in chunks (256 bytes per QSPI_READ)
            chunks = test_size // 256
            for i in range(chunks):
                chunk_addr = addr + (i * 256)
                # Build QSPI_READ payload (address Little-Endian for firmware)
                payload = bytes([
                    read_cmd,  # Command
                    3,         # AddrLen
                    chunk_addr & 0xFF,          # LSB first
                    (chunk_addr >> 8) & 0xFF,
                    (chunk_addr >> 16) & 0xFF,  # MSB last
                    dummy,     # Dummy cycles
                    0, 1       # ReadLen = 256 (little endian)
                ])
                ok, data = self.send_command(OpupCmd.QSPI_READ, payload)
                if ok:
                    read_data += data
            
            read_time = time.time() - read_start
            read_speed = test_size / read_time / 1024
            
            # Verify data
            verified = read_data == test_data
            status = "✓" if verified else "✗"
            
            print(f"   {mode_name:24} | {read_time:6.2f}s | {read_speed:6.1f} KB/s | {status}")
            results.append((f"Read {mode_name}", read_time, read_speed, verified))
        
        # Summary
        print(f"\n{'='*60}")
        print("  BENCHMARK SUMMARY")
        print(f"{'='*60}")
        print(f"  {'Operation':<30} {'Time':>8} {'Speed':>10}")
        print(f"  {'-'*50}")
        for r in results:
            name = r[0]
            t = r[1]
            speed = r[2]
            verified = r[3] if len(r) > 3 else True
            status = " ✓" if verified else " ✗"
            print(f"  {name:<30} {t:>7.2f}s {speed:>8.1f} KB/s{status}")
        print(f"{'='*60}")
        
        # Reset to standard mode
        self.qspi_set_mode(0)
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
        
        elif cmd == 'qspi-quad-enable':
            client.qspi_quad_enable()
        
        elif cmd == 'qspi-status':
            client.qspi_read_status()
        
        elif cmd == 'flash-read':
            if len(args.args) < 1:
                print("Usage: flash-read <addr> [length]")
                print("Example: flash-read 0x000000 256")
            else:
                addr = int(args.args[0], 0)
                length = int(args.args[1]) if len(args.args) > 1 else 256
                client.flash_read(addr, length)
        
        elif cmd == 'flash-write':
            if len(args.args) < 2:
                print("Usage: flash-write <addr> <hex_data>")
                print("Example: flash-write 0x100000 DEADBEEFCAFE")
            else:
                addr = int(args.args[0], 0)
                data = bytes.fromhex(args.args[1])
                client.flash_write(addr, data)
        
        elif cmd == 'flash-erase':
            if len(args.args) < 1:
                print("Usage: flash-erase <addr> [sector|block32|block64|chip]")
                print("Example: flash-erase 0x100000 sector")
            else:
                addr = int(args.args[0], 0)
                erase_type = args.args[1] if len(args.args) > 1 else "sector"
                if erase_type == "sector":
                    client.flash_erase_sector(addr)
                elif erase_type == "block32":
                    client.flash_erase_block(addr, 32)
                elif erase_type == "block64":
                    client.flash_erase_block(addr, 64)
                elif erase_type == "chip":
                    confirm = input("⚠️ CHIP ERASE will delete ALL data! Type 'YES' to confirm: ")
                    if confirm == "YES":
                        client.flash_chip_erase()
                    else:
                        print("Aborted.")
        
        elif cmd == 'flash-test':
            addr = int(args.args[0], 0) if args.args else 0x100000
            client.flash_test_rw(addr)
        
        elif cmd == 'flash-benchmark':
            size_kb = int(args.args[0]) if args.args else 4
            addr = int(args.args[1], 0) if len(args.args) > 1 else 0x100000
            client.flash_benchmark(size_kb, addr)
        
        else:
            print(f"Unknown command: {cmd}")
            print("Use 'help' for available commands")
    
    finally:
        client.disconnect()


if __name__ == '__main__':
    main()
