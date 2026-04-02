export class EscPosEncoder {
  private buffer: number[] = [];

  initialize() {
    this.buffer.push(0x1B, 0x40);
    return this;
  }

  text(str: string) {
    for (let i = 0; i < str.length; i++) {
      // Basic ASCII encoding. For advanced characters, a proper codepage mapping is needed.
      this.buffer.push(str.charCodeAt(i) & 0xFF);
    }
    return this;
  }

  newline() {
    this.buffer.push(0x0A);
    return this;
  }

  line(str: string) {
    return this.text(str).newline();
  }

  alignCenter() {
    this.buffer.push(0x1B, 0x61, 0x01);
    return this;
  }

  alignLeft() {
    this.buffer.push(0x1B, 0x61, 0x00);
    return this;
  }

  alignRight() {
    this.buffer.push(0x1B, 0x61, 0x02);
    return this;
  }

  bold(on: boolean) {
    this.buffer.push(0x1B, 0x45, on ? 0x01 : 0x00);
    return this;
  }

  size(width: number, height: number) {
    // width and height should be between 1 and 8
    const val = ((width - 1) << 4) | (height - 1);
    this.buffer.push(0x1D, 0x21, val);
    return this;
  }

  separator(paperSize: '58mm' | '80mm' = '58mm') {
    const chars = paperSize === '58mm' ? 32 : 48;
    return this.line('-'.repeat(chars));
  }

  cut() {
    // Partial cut
    this.buffer.push(0x1D, 0x56, 0x41, 0x10);
    return this;
  }

  qrcode(data: string, size: number = 6) {
    const dataLen = data.length + 3;
    const pL = dataLen % 256;
    const pH = Math.floor(dataLen / 256);

    // Select model 2
    this.buffer.push(0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    
    // Set size
    this.buffer.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, size);
    
    // Set error correction level (L=48, M=49, Q=50, H=51) -> using M
    this.buffer.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31);
    
    // Store data
    this.buffer.push(0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30);
    for (let i = 0; i < data.length; i++) {
      this.buffer.push(data.charCodeAt(i) & 0xFF);
    }
    
    // Print QR code
    this.buffer.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30);
    
    return this;
  }

  encode(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}
