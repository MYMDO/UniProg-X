#include "i2c_driver.h"
#include "spi_driver.h"
#include "usb_config.h"
#include <Arduino.h>
#include <cstring>

// Constants
const uint8_t MAGIC = 0xAA;
const uint8_t CMD_PING = 0x01;
const uint8_t CMD_GET_INFO = 0x02;
const uint8_t CMD_RESET = 0x03;
const uint8_t CMD_I2C_SCAN = 0x10;
const uint8_t CMD_I2C_READ = 0x11;
const uint8_t CMD_I2C_WRITE = 0x12;
const uint8_t CMD_SPI_SCAN = 0x20;
const uint8_t CMD_SPI_CONFIG = 0x21;
const uint8_t CMD_SPI_XFER = 0x22;
const uint8_t CMD_ERROR = 0xFF;

// Globals
I2CDriver i2c;
SPIDriver spi;
// Increased buffer size for better throughput
uint8_t buffer[4096];

void send_response(uint8_t cmd, uint8_t *data, uint16_t len) {
  Serial.write(MAGIC);
  Serial.write(cmd);
  Serial.write(len & 0xFF);
  Serial.write((len >> 8) & 0xFF);
  if (len > 0) {
    Serial.write(data, len);
  }
  // Checksum (Sum of everything except Magic)
  uint8_t crc = cmd + (len & 0xFF) + ((len >> 8) & 0xFF);
  for (uint16_t i = 0; i < len; i++) {
    crc += data[i];
  }
  Serial.write(crc);

  // Turn LED OFF after response sent
  digitalWrite(LED_BUILTIN, LOW);
}

void send_error(uint8_t code) {
  uint8_t payload[] = {code};
  send_response(CMD_ERROR, payload, 1);
}

void handle_command(uint8_t cmd, uint16_t len) {
  // Turn LED ON when processing command (visual feedback for I2C/SPI
  // operations)
  digitalWrite(LED_BUILTIN, HIGH);

  // Read payload
  if (len > sizeof(buffer)) {
    // Consume bytes to clear buffer if possible, or just error out
    // Since we can't store it, we can't easily consume it without blocking.
    // For now, just send error.
    send_error(0x05); // Buffer overflow
    return;
  }

  if (len > 0) {
    // Blocking read with timeout is acceptable here as we expect data to follow
    // immediately But we should be careful. Ideally we would state machine
    // this, but for now we optimize the read.
    uint16_t read_len = Serial.readBytes(buffer, len);
    if (read_len != len) {
      send_error(0x03); // Timeout/Partial read
      return;
    }
  }

  // Read CRC
  uint8_t received_crc;
  if (Serial.readBytes(&received_crc, 1) != 1) {
    send_error(0x03);
    return;
  }

  // Verify CRC
  uint8_t calc_crc = cmd + (len & 0xFF) + ((len >> 8) & 0xFF);
  for (uint16_t i = 0; i < len; i++) {
    calc_crc += buffer[i];
  }

  if (received_crc != calc_crc) {
    send_error(0x02); // CRC Error
    return;
  }

  switch (cmd) {
  case CMD_PING:
    send_response(CMD_PING, NULL, 0);
    break;

  case CMD_GET_INFO: {
    char info[] = "UniProg-X v1.1";
    send_response(CMD_GET_INFO, (uint8_t *)info, strlen(info));
    break;
  }

  case CMD_RESET:
    rp2040.reboot();
    break;

  case CMD_I2C_SCAN: {
    uint8_t found[128];
    uint8_t count = 0;
    i2c.scan(found, count);

    // Response: [Count][Addr1][Addr2]...
    buffer[0] = count;
    memcpy(buffer + 1, found, count);
    send_response(CMD_I2C_SCAN, buffer, count + 1);
    break;
  }

  case CMD_I2C_READ: {
    // Req: [Addr][Len:2]
    if (len < 3) {
      send_error(0x01);
      return;
    }
    uint8_t addr = buffer[0];
    uint16_t read_len = buffer[1] | (buffer[2] << 8);

    if (read_len > sizeof(buffer))
      read_len = sizeof(buffer);

    if (i2c.read(addr, read_len, buffer)) {
      send_response(CMD_I2C_READ, buffer, read_len);
    } else {
      send_error(0x04); // NACK/Fail
    }
    break;
  }

  case CMD_I2C_WRITE: {
    // Req: [Addr][Data...]
    if (len < 1) {
      send_error(0x01);
      return;
    }
    uint8_t addr = buffer[0];
    if (i2c.write(addr, buffer + 1, len - 1)) {
      send_response(CMD_I2C_WRITE, NULL, 0);
    } else {
      send_error(0x04);
    }
    break;
  }

  case CMD_SPI_SCAN: {
    // SPI Flash detection via JEDEC ID (0x9F command)
    // Try to read JEDEC ID from common SPI flash chips
    uint8_t cmd_buf[4] = {0x9F, 0, 0, 0}; // JEDEC Read ID command
    uint8_t response_buf[4];

    // Configure SPI to safe defaults (1MHz, Mode 0)
    spi.configure(1000000, 0);

    // Try CS pin 17 (default)
    spi.transfer(17, cmd_buf, 4);
    memcpy(response_buf, cmd_buf, 4);

    // Check if we got valid manufacturer ID (not 0x00 or 0xFF)
    if (response_buf[1] != 0x00 && response_buf[1] != 0xFF) {
      // Found a chip! Return [count=1][Manufacturer][DeviceID_Hi][DeviceID_Lo]
      buffer[0] = 1;               // Count
      buffer[1] = response_buf[1]; // Manufacturer ID
      buffer[2] = response_buf[2]; // Device ID byte 1
      buffer[3] = response_buf[3]; // Device ID byte 2
      send_response(CMD_SPI_SCAN, buffer, 4);
    } else {
      // No chip found
      buffer[0] = 0;
      send_response(CMD_SPI_SCAN, buffer, 1);
    }
    break;
  }

  case CMD_SPI_CONFIG: {
    // Req: [Freq:4][Mode:1]
    if (len < 5) {
      send_error(0x01);
      return;
    }
    uint32_t freq;
    memcpy(&freq, buffer, 4);
    uint8_t mode = buffer[4];
    spi.configure(freq, mode);
    send_response(CMD_SPI_CONFIG, NULL, 0);
    break;
  }

  case CMD_SPI_XFER: {
    // Req: [CS:1][Len:2][Data...]
    if (len < 3) {
      send_error(0x01);
      return;
    }
    uint8_t cs = buffer[0];
    uint16_t xfer_len = buffer[1] | (buffer[2] << 8);

    // Data starts at buffer[3]
    // We can do in-place transfer if xfer_len matches payload len
    // But payload len is len - 3.
    // Usually for SPI, we send X bytes and receive X bytes.
    // So payload should contain the TX data.

    if (xfer_len > sizeof(buffer))
      xfer_len = sizeof(buffer);

    // Copy TX data to beginning of buffer to simplify
    memmove(buffer, buffer + 3, xfer_len);

    spi.transfer(cs, buffer, xfer_len);

    send_response(CMD_SPI_XFER, buffer, xfer_len);
    break;
  }

  default:
    send_error(0x01); // Invalid CMD
    break;
  }
}

void setup() {
  Serial.begin(115200);   // USB Serial is actually always full speed
  Serial.setTimeout(100); // Set timeout to 100ms
  i2c.begin();
  spi.begin();
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  if (Serial.available() >= 4) { // Magic + Cmd + Len(2)
    if (Serial.read() != MAGIC) {
      return; // Wait for sync
    }

    uint8_t cmd = Serial.read();
    uint8_t len_l = Serial.read();
    uint8_t len_h = Serial.read();
    uint16_t len = len_l | (len_h << 8);

    handle_command(cmd, len);
  }
}
