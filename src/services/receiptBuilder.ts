import { EscPosEncoder } from './escPosEncoder';
import { Bill, BillItem, Shop } from '../data/database';

export function buildReceipt(
  bill: Bill, 
  items: BillItem[], 
  shop: Shop | null = null,
  paperSize: '58mm' | '80mm' = '58mm'
): Uint8Array {
  const encoder = new EscPosEncoder();
  const lineLength = paperSize === '58mm' ? 32 : 48;
  const shopName = shop?.name || "Ezy POS";
  
  encoder.initialize()
    .alignCenter()
    .bold(true)
    .size(2, 2)
    .line(shopName)
    .size(1, 1)
    .bold(false)
    .newline()
    .alignLeft()
    .line(`Bill No: ${bill.billNo}`)
    .line(`Date: ${bill.createdAt.toLocaleString()}`);

  if (bill.customerName) {
    encoder.line(`Customer: ${bill.customerName}`);
  }
  if (bill.tableNo) {
    encoder.line(`Table: ${bill.tableNo}`);
  }

  encoder.separator(paperSize);

  // Header: Item (flex) | Qty (4) | Amt (8)
  const qtyWidth = 4;
  const amtWidth = 8;
  const nameWidth = lineLength - qtyWidth - amtWidth - 2; // 2 spaces

  const headerName = "Item".padEnd(nameWidth, ' ');
  const headerQty = "Qty".padStart(qtyWidth, ' ');
  const headerAmt = "Amount".padStart(amtWidth, ' ');
  
  encoder.bold(true)
    .line(`${headerName} ${headerQty} ${headerAmt}`)
    .bold(false)
    .separator(paperSize);

  items.forEach(item => {
    let name = item.productName;
    if (name.length > nameWidth) {
      name = name.substring(0, nameWidth - 2) + "..";
    } else {
      name = name.padEnd(nameWidth, ' ');
    }
    
    const qty = `${item.qty}`.padStart(qtyWidth, ' ');
    const amt = `${item.amount.toFixed(2)}`.padStart(amtWidth, ' ');
    
    encoder.line(`${name} ${qty} ${amt}`);
  });

  encoder.separator(paperSize)
    .alignRight()
    .line(`Subtotal: ${bill.subtotal.toFixed(2)}`);
    
  if (bill.discount > 0) {
    encoder.line(`Discount: -${bill.discount.toFixed(2)}`);
  }
  if (bill.taxAmount > 0) {
    encoder.line(`Tax: +${bill.taxAmount.toFixed(2)}`);
  }
  
  encoder.bold(true)
    .size(1, 2)
    .line(`Total: ${bill.total.toFixed(2)}`)
    .size(1, 1)
    .bold(false)
    .line(`Paid via: ${bill.paymentMode}`)
    .newline();

  if (shop?.upiId) {
    const upiLink = `upi://pay?pa=${shop.upiId}&pn=${encodeURIComponent(shopName)}&am=${bill.total.toFixed(2)}&cu=INR`;
    encoder.alignCenter()
      .line("Scan to Pay")
      .qrcode(upiLink, 6)
      .newline();
  }

  encoder.alignCenter()
    .line("Thank you! Visit again.")
    .newline()
    .newline()
    .newline()
    .cut();

  return encoder.encode();
}
