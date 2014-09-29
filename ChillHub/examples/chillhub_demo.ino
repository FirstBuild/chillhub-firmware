#include "chillhub.h"
#define FIVE_MINUTE_TIMER_ID  0x70

unsigned int doorCounts = 0;

void setup() {
  // register the name (type) of this device with the chillhub
  // syntax is ChillHub.setup(DEVICE_NAME, LENGTH_OF_DEVICE_NAME);
  ChillHub.setup("chilldemo", 9);

  // subscribe to refrigerator door open/close events
  // syntax is ChillHub.subscribe(REFRIGERATOR_EVENT_TYPE, FUNCTION_THAT_HANDLES_MESSAGE);
  ChillHub.subscribe(doorStatusMsgType, (chillhubCallbackFunction)doorMessageCallback);
  
  // listen for multiples of five minutes (10:00, 10:05, 10:10, 10:15, etc)
  // syntax is ChillHub.setAlarm(ALARM_ID, CRON_STRING, CRON_STRING_LENGTH, FUNCTION_THAT_HANDLES_ALARM);
  ChillHub.setAlarm(FIVE_MINUTE_TIMER_ID, "0 */2 * * * *", 13, (chillhubCallbackFunction)alarmCallback);
}

void loop() {
  ChillHub.loop();
  // you can do other stuff here as your application requires
}

void doorMessageCallback(unsigned char doorStatus) {
  digitalWrite(12, doorStatus & 0x01); // light up an LED on pin 12 if fresh food door open
  digitalWrite(13, doorStatus & 0x02); // light up an LED on pin 13 if freezer door open

  doorCounts++;

  // send a raw message to the ChillHub.  this one is directed at the cloud and has contents of 
  ChillHub.sendU16Msg(0x50, doorCounts);
}

void alarmCallback(unsigned char[4] currentTime) {
  // destroy the alarm that was set on line 17
  // syntax is ChillHub.unsetAlarm(ALARM_ID);
  ChillHub.unsetAlarm(FIVE_MINUTE_TIMER_ID);
}
