uint8_t buf[16] = { 0 };

unsigned int doorCounts = 0;

void setup() {
  Serial.begin(9600);
  randomSeed(analogRead(0));
  delay(200);
  
  // register device type with chillhub mailman
  buf[0] = 0x00; // register name message type
  buf[1] = 0x02; // string data type
  buf[2] = 13; // string length
  buf[3] = 'c';
  buf[4] = 'h';
  buf[5] = 'i';
  buf[6] = 'l';
  buf[7] = 'l';
  buf[8] = 'h';
  buf[9] = 'u';
  buf[10] = 'b';
  buf[11] = '-';
  buf[12] = 'd';
  buf[13] = 'e';
  buf[14] = 'm';
  buf[15] = 'o';
  Serial.write(buf, 16);
  
  delay(200);
  
  // subscribe to door status updates
  buf[0] = 0x01; // subscribe message type
  buf[1] = 0x03; // unsigned char data type
  buf[2] = 0x22; // door status
  Serial.write(buf, 3);
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
    buf[0] = 0x50; // first user-defined message available
    buf[1] = 0x05; // unsigned int
    buf[2] = (doorCounts >> 8) & 0xff;
    buf[3] = (doorCounts & 0xff);
    Serial.write(buf, 4);
  }
  else {
    // toss remainder of message that we don't care about
    for (int j = 0; j < (length-1); j++)
      Serial.read();
  }
}

