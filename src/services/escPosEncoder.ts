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

  encode(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}
