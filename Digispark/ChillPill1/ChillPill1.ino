//This program will listen on the usb and then change the light color accordingly
//bpw 7/17/14

#include <DigiUSB.h>

// pins 0, 1, and 4 are pwm pins on digispark...
int LED_R = 0;
int LED_G = 1;
int LED_B = 2;  //blue led is currently off because pin 4 is needed for usb communications...


//convert a hue (0-1023) to rgb colors
void h2rgb(float H, int& R, int& G, int& B) {

  int var_i;
  float S=1, V=1, var_1, var_2, var_3, var_h, var_r, var_g, var_b;

  if ( S == 0 )                       //HSV values = 0 ÷ 1
  {
    R = V * 255;
    G = V * 255;
    B = V * 255;
  }
  else
  {
    var_h = H * 6;
    if ( var_h == 6 ) var_h = 0;      //H must be < 1
    var_i = int( var_h ) ;            //Or ... var_i = floor( var_h )
    var_1 = V * ( 1 - S );
    var_2 = V * ( 1 - S * ( var_h - var_i ) );
    var_3 = V * ( 1 - S * ( 1 - ( var_h - var_i ) ) );

    if      ( var_i == 0 ) {
      var_r = V     ;
      var_g = var_3 ;
      var_b = var_1 ;
    }
    else if ( var_i == 1 ) {
      var_r = var_2 ;
      var_g = V     ;
      var_b = var_1 ;
    }
    else if ( var_i == 2 ) {
      var_r = var_1 ;
      var_g = V     ;
      var_b = var_3 ;
    }
    else if ( var_i == 3 ) {
      var_r = var_1 ;
      var_g = var_2 ;
      var_b = V     ;
    }
    else if ( var_i == 4 ) {
      var_r = var_3 ;
      var_g = var_1 ;
      var_b = V     ;
    }
    else                   {
      var_r = V     ;
      var_g = var_1 ;
      var_b = var_2 ;
    }

    R = (1-var_r) * 255;                  //RGB results = 0 ÷ 255
    G = (1-var_g) * 255;
    B = (1-var_b) * 255;
  }
}

// make the RGB led light up.
void RGBLed(int r, int g, int b) {
    analogWrite(LED_R, r);
    analogWrite(LED_G, g);
    //analogWrite(LED_B, b);
    delay(1000);
}

void setup() {
  DigiUSB.begin();
  
  pinMode(LED_R, OUTPUT);
  pinMode(LED_G, OUTPUT);
  pinMode(LED_B, OUTPUT);
  

}

void get_input() {
  int lastRead;
  
  // when there are no characters to read, or the character isn't a newline
  while (true) { // loop forever
    if (DigiUSB.available()) {
      // something to read
      lastRead = DigiUSB.read();
      DigiUSB.write(lastRead);
      
      switch (char(lastRead)) {
        case '1':
            RGBLed(255,0,0);
          break;
        case '2':
            RGBLed(0,255,0);
          break;
        case '3':
            RGBLed(0,0,255);
          break;
        case '4':
            RGBLed(255,255,0);
          break;
        case '5':
            RGBLed(0,255,255);
          break;
         case '6':
            RGBLed(255,0,255);
          break;
        case '7':
            RGBLed(255,255,255);
          break;          
        default: 
            RGBLed(0,0,0); 
      }
      
      if (lastRead == '\n') {
        break; // when we get a newline, break out of loop
      }
    }
    
    // refresh the usb port for 10 milliseconds
    DigiUSB.delay(10);
  }
}

void loop() {
 
  DigiUSB.println("Waiting for input...");
  get_input();
     
}
