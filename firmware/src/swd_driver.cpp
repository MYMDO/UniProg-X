#include "swd_driver.h"
#include "Board.h"

void SWDDriver::begin() {
  pinMode(Board::PIN_SWD_CLK, OUTPUT);
  pinMode(Board::PIN_SWD_DIO, OUTPUT);
  digitalWrite(Board::PIN_SWD_CLK, LOW);
}

// Basic bit-banging implementation (simplified for prototype)
// Real SWD requires strict timing and parity checks

void SWDDriver::writeBits(uint32_t data, uint8_t bits) {
  pinMode(Board::PIN_SWD_DIO, OUTPUT);
  for (int i = 0; i < bits; i++) {
    digitalWrite(Board::PIN_SWD_DIO, (data >> i) & 1);
    digitalWrite(Board::PIN_SWD_CLK, LOW);
    delayMicroseconds(1);
    digitalWrite(Board::PIN_SWD_CLK, HIGH);
    delayMicroseconds(1);
  }
}

uint32_t SWDDriver::readBits(uint8_t bits) {
  pinMode(Board::PIN_SWD_DIO, INPUT);
  uint32_t data = 0;
  for (int i = 0; i < bits; i++) {
    digitalWrite(Board::PIN_SWD_CLK, LOW);
    delayMicroseconds(1);
    if (digitalRead(Board::PIN_SWD_DIO)) {
      data |= (1 << i);
    }
    digitalWrite(Board::PIN_SWD_CLK, HIGH);
    delayMicroseconds(1);
  }
  return data;
}

void SWDDriver::turnAround() {
  pinMode(Board::PIN_SWD_DIO, INPUT);
  digitalWrite(Board::PIN_SWD_CLK, LOW);
  delayMicroseconds(1);
  digitalWrite(Board::PIN_SWD_CLK, HIGH);
  delayMicroseconds(1);
}

uint32_t SWDDriver::init() {
  // 1. Line Reset (50+ clocks with SWDIO high)
  writeBits(0xFFFFFFFF, 32);
  writeBits(0xFFFFFFFF, 32);

  // 2. JTAG-to-SWD switching sequence (0xE79E)
  writeBits(0xE79E, 16);

  // 3. Line Reset again
  writeBits(0xFFFFFFFF, 32);
  writeBits(0xFFFFFFFF, 32);

  // 4. Idle cycles
  writeBits(0x00, 8);

  // 5. Read IDCODE (DP Register 0)
  // Header: Start(1) | APnDP(0) | RnW(1) | A[2:3](00) | Parity(1) | Stop(0) |
  // Park(1) 1 0 1 00 1 0 1 = 0xA5
  writeBits(0xA5, 8);
  turnAround();

  // ACK (3 bits) + Data (32 bits) + Parity (1 bit)
  uint8_t ack = readBits(3);
  if (ack != 1)
    return 0; // Expect OK (001)

  uint32_t idcode = readBits(32);
  readBits(1); // Parity
  turnAround();

  return idcode;
}

// Helper to calculate parity
bool checkParity(uint32_t val) {
  uint32_t p = 0;
  for (int i = 0; i < 32; i++) {
    if (val & (1 << i))
      p++;
  }
  return (p & 1);
}

// DP/AP Register Access
// Packet: Start(1) | APnDP(1) | RnW(1) | A[2:3](2) | Parity(1) | Stop(0) |
// Park(1)

bool SWDDriver::writeAP(uint8_t ap, uint32_t addr, uint32_t data) {
  // 1. Select AP Bank (if needed) - simplified, assuming Bank 0 for now
  // Write DP Select (0x08)
  // Header: 1 0 0 10 0 0 1 = 0x89 (Write DP Reg 8 - SELECT)
  writeBits(0x89, 8);
  turnAround();
  if (readBits(3) != 1)
    return false; // ACK
  turnAround();
  writeBits(0x00000000 | (ap << 24), 32); // Select AP and Bank 0
  writeBits(checkParity(0x00000000 | (ap << 24)), 1);

  // 2. Write AP Register
  // Header construction:
  // Start=1, APnDP=1, RnW=0, A[2:3]=(addr>>2)&3, Parity, Stop=0, Park=1
  uint8_t a23 = (addr >> 2) & 0x03;
  uint8_t header = 0x81 | (a23 << 2);
  if (checkParity(header))
    header |= 0x20; // Parity bit position in header byte? No, header is 8 bits.
  // Actually, SWD header is 8 bits:
  // Start(1) | APnDP(1) | RnW(1) | A[2:3](2) | Parity(1) | Stop(0) | Park(1)
  // Let's use a lookup or calc.
  // Write AP: APnDP=1, RnW=0.

  uint8_t req = 0x81 | (1 << 5) | (0 << 2) |
                (a23 << 3); // Start(1) | Park(1) | Stop(0) | Parity(?) | A3 |
                            // A2 | RnW | APnDP
  // Wait, standard order LSB first:
  // Start(1), APnDP, RnW, A2, A3, Parity, Stop(0), Park(1)

  req = 1;           // Start
  req |= (1 << 1);   // APnDP = 1
  req |= (0 << 2);   // RnW = 0
  req |= (a23 << 3); // A[2:3]

  // Parity of (APnDP + RnW + A2 + A3)
  int p = 1 + 0 + ((a23 >> 0) & 1) + ((a23 >> 1) & 1);
  if (p & 1)
    req |= (1 << 5);

  req |= (0 << 6); // Stop
  req |= (1 << 7); // Park

  writeBits(req, 8);
  turnAround();
  if (readBits(3) != 1)
    return false; // ACK
  turnAround();

  writeBits(data, 32);
  writeBits(checkParity(data), 1);

  return true;
}

bool SWDDriver::readAP(uint8_t ap, uint32_t addr, uint32_t *data) {
  // 1. Select AP Bank
  // Write DP Select (0x08) -> 0x89
  writeBits(0x89, 8);
  turnAround();
  if (readBits(3) != 1)
    return false;
  turnAround();
  writeBits(0x00000000 | (ap << 24), 32);
  writeBits(checkParity(0x00000000 | (ap << 24)), 1);

  // 2. Read AP Register
  // APnDP=1, RnW=1
  uint8_t a23 = (addr >> 2) & 0x03;
  uint8_t req = 1;   // Start
  req |= (1 << 1);   // APnDP = 1
  req |= (1 << 2);   // RnW = 1
  req |= (a23 << 3); // A[2:3]

  int p = 1 + 1 + ((a23 >> 0) & 1) + ((a23 >> 1) & 1);
  if (p & 1)
    req |= (1 << 5);

  req |= (0 << 6); // Stop
  req |= (1 << 7); // Park

  writeBits(req, 8);
  turnAround();
  if (readBits(3) != 1)
    return false; // ACK

  *data = readBits(32);
  readBits(1); // Parity
  turnAround();

  // Read RDBUFF to get actual data (pipelined)
  // Read DP RDBUFF (0x0C) -> 0xBD (Start=1, APnDP=0, RnW=1, A=3, P=1, S=0, P=1)
  writeBits(0xBD, 8);
  turnAround();
  if (readBits(3) != 1)
    return false;
  *data = readBits(32);
  readBits(1);
  turnAround();

  return true;
}
