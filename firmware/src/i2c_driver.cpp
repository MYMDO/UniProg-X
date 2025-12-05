#include "i2c_driver.h"
#include "Board.h"

void I2CDriver::begin() {
  Wire.setSDA(Board::PIN_I2C_SDA);
  Wire.setSCL(Board::PIN_I2C_SCL);
  Wire.begin();
  Wire.setClock(400000); // 400kHz Fast Mode
}

void I2CDriver::scan(uint8_t *found_addresses, uint8_t &count) {
  count = 0;
  for (uint8_t address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    uint8_t error = Wire.endTransmission();
    if (error == 0) {
      found_addresses[count++] = address;
      if (count >= 128)
        break; // Safety
    }
  }
}

bool I2CDriver::read(uint8_t addr, uint16_t len, uint8_t *data) {
  uint16_t received = 0;

  // Chunked reading if necessary, but Wire buffer is usually limited
  // For large reads, we might need multiple requests or a custom driver.
  // Standard Wire buffer is 256 bytes on RP2040 usually.

  uint8_t requested = Wire.requestFrom(addr, (size_t)len);
  if (requested != len)
    return false;

  while (Wire.available()) {
    data[received++] = Wire.read();
  }
  return received == len;
}

bool I2CDriver::write(uint8_t addr, uint8_t *data, uint16_t len) {
  Wire.beginTransmission(addr);
  size_t written = Wire.write(data, len);
  if (written != len) {
    Wire.endTransmission();
    return false;
  }
  return Wire.endTransmission() == 0;
}
