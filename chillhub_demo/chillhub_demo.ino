#define FIVE_MINUTE_TIMER_ID  0x70

uint8_t buf[16] = { 0 };

unsigned int doorCounts = 0;

void setup() {
  Serial.begin(115200); // usb firmware set up as 115200
  delay(200);

  // register device type with chillhub mailman
  buf[0] = 12; // length of the following message
  buf[1] = 0x00; // register name message type
  buf[2] = 0x02; // string data type
  buf[3] = 10; // string length
  buf[4] = 'c';
  buf[5] = 'h';
  buf[6] = 'i';
  buf[7] = 'l';
  buf[8] = 'l';
  buf[9] = 'd';
  buf[10] = 'e';
  buf[11] = 'm';
  buf[12] = 'o';
  Serial.write(buf, 13);

  delay(200);

  // subscribe to door status updates
  buf[0] = 3; // length of the following message
  buf[1] = 0x01; // subscribe message type
  buf[2] = 0x03; // unsigned char data type
  buf[3] = 0x22; // door status
  Serial.write(buf, 4);
  
  // listen for multiples of five minutes
  buf[0] = 17; // message length
  buf[1] = 0x03; // set alarm
  buf[2] = 0x02; // string
  buf[3] = 14; // string length
  buf[4] = FIVE_MINUTE_TIMER_ID; // callback id... it's best to use a character here otherwise things don't work right
  Serial.write(buf,5); // send all that so that we can use Serial.print for the string
  Serial.print("0 */5 * * * *"); // cron string
}

void loop() {
  if(Serial.available() >= 0) {
    int length = Serial.read();
    if (length > 0) {
      delay(5);
      int msgType = Serial.read();
      delay(5);
      if (msgType == 0x22) { // door status
        Serial.read(); // discard data type.  we know it's a U8
        int doorStatus = Serial.read();
        delay(5);

        digitalWrite(12, doorStatus & 0x01); // light up an LED on pin 12 if fresh food door open
        digitalWrite(13, doorStatus & 0x02); // light up an LED on pin 13 if freezer door open

        doorCounts++;

        // send the number of door counts off to the cloud!
        buf[0] = 4; // length of the following message
        buf[1] = 0x50; // first user-defined message available
        buf[2] = 0x05; // unsigned int
        buf[3] = (doorCounts >> 8) & 0xff;
        buf[4] = (doorCounts & 0xff);
        Serial.write(buf, 5);
      }
      else {
        // toss remainder of message that we don't care about
        for (int j = 0; j < (length-1); j++)
          Serial.read();
      }
      
      if (msgType == 0x05) {
        // cancel the timer after we get the first one...
        buf[0] = 3;
        buf[1] = 0x04; // alarm unset
        buf[2] = 0x04; // uint8
        buf[3] = FIVE_MINUTE_TIMER_ID;
        Serial.write(buf, 4);
      }
    }
  }
}


