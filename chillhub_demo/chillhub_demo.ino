/* this demo code assumes the uno's been loaded with the LUFA midi-0.2 firmware
   http://hunt.net.nz/users/darran/
*/

uint8_t buf[32] = { 0 };

unsigned int doorCounts = 0;

void setup() {
  Serial.begin(9600);
  randomSeed(analogRead(0));
  delay(200);
  
  buf[0] = // length of following message
  buf[1] = 0x03; // define frame size
  buf[2] = 0x03; // U8
  buf[3] = 0x04; // frame size is 4 (defined by midi firmware)
  Serial.write(buf,4);
  
  delay(200);
  
  // register device type with chillhub mailman
  buf[0] = 13; // length of the following message
  buf[1] = 0x00; // register name message type
  buf[2] = 0x02; // string data type
  buf[3] = 13; // string length
  buf[4] = 'c';
  buf[5] = 'h';
  buf[6] = 'i';
  buf[7] = 'l';
  buf[8] = 'l';
  buf[9] = '-';
  buf[10] = 'd';
  buf[11] = 'e';
  buf[12] = 'm';
  buf[13] = 'o';
  buf[14] = 0;
  buf[15] = 0;
  Serial.write(buf, 16);  // note that the arduino midi firmware ONLY writes 4 bytes at a time, so padding out buffer to 16
  
  delay(200);
  
  // subscribe to door status updates
  buf[0] = 3; // length of the following message
  buf[1] = 0x01; // subscribe message type
  buf[2] = 0x03; // unsigned char data type
  buf[3] = 0x22; // door status
  Serial.write(buf, 4);
}

void loop() {
  while(Serial.available() <= 0);
  unsigned char length = Serial.read();
  unsigned char msgType = Serial.read();
  if (msgType == 0x22) { // door status
    Serial.read(); // discard data type.  we know it's a U8
    unsigned char doorStatus = Serial.read();
    
    digitalWrite(12, doorStatus & 0x01); // light up an LED on pin 12 if fresh food door open
    digitalWrite(13, doorStatus & 0x02); // light up an LED on pin 13 if freezer door open
    
    doorCounts++;
    
    // send the number of door counts off to the cloud!
    buf[0] = 4; // length of the following message
    buf[1] = 0x50; // first user-defined message available
    buf[2] = 0x05; // unsigned int
    buf[3] = (doorCounts >> 8) & 0xff;
    buf[4] = (doorCounts & 0xff);
    for (int i = 5; i < 8; i++)
      buf[i] = 0;
    Serial.write(buf, 8); // pad to multiple of four
  }
  else {
    // toss remainder of message that we don't care about
    for (int j = 0; j < (length-1); j++)
      Serial.read();
  }
}

