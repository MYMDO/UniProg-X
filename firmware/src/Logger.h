#pragma once
#include <Arduino.h>

/**
 * @brief UniProg-X Logging System
 *
 * To enable debug logs, define DEBUG_BUILD in platformio.ini or before
 * including this file.
 */

// #define DEBUG_BUILD // Uncomment to force debug locally

#ifdef DEBUG_BUILD
#define LOG_BEGIN(baud) Serial.begin(baud)
#define LOG_WAIT() while ((!Serial) && (millis() < 2000))

// Tagged logs
#define LOG_DEBUG(tag, msg)                                                    \
  Serial.print("[DEBUG] ");                                                    \
  Serial.print(tag);                                                           \
  Serial.print(": ");                                                          \
  Serial.println(msg)

#define LOG_INFO(tag, msg)                                                     \
  Serial.print("[INFO]  ");                                                    \
  Serial.print(tag);                                                           \
  Serial.print(": ");                                                          \
  Serial.println(msg)

#define LOG_WARN(tag, msg)                                                     \
  Serial.print("[WARN]  ");                                                    \
  Serial.print(tag);                                                           \
  Serial.print(": ");                                                          \
  Serial.println(msg)

#define LOG_ERROR(tag, msg)                                                    \
  Serial.print("[ERROR] ");                                                    \
  Serial.print(tag);                                                           \
  Serial.print(": ");                                                          \
  Serial.println(msg)

// Raw value logs
#define LOG_VAL(tag, label, val)                                               \
  Serial.print("[VAL]   ");                                                    \
  Serial.print(tag);                                                           \
  Serial.print(": ");                                                          \
  Serial.print(label);                                                         \
  Serial.print("=");                                                           \
  Serial.println(val)

#define LOG_HEX(tag, label, val)                                               \
  Serial.print("[HEX]   ");                                                    \
  Serial.print(tag);                                                           \
  Serial.print(": ");                                                          \
  Serial.print(label);                                                         \
  Serial.print("=0x");                                                         \
  Serial.println(val, HEX)

#else
// Production: Compile out logging to save space and time
#define LOG_BEGIN(baud) Serial.begin(baud)
#define LOG_WAIT() while ((!Serial) && (millis() < 2000))

#define LOG_DEBUG(tag, msg)
#define LOG_INFO(tag, msg)
#define LOG_WARN(tag, msg)
#define LOG_ERROR(tag, msg)
#define LOG_VAL(tag, label, val)
#define LOG_HEX(tag, label, val)

#endif
