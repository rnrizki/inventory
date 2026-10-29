/**
 * ⚡ Native TSPL Thermal Printer Engine for Xprinter XP-420B
 * Engineered for SkyConnection Asset & Inventory Management
 */

export interface LabelData {
  name: string;
  model: string;
  serial: string;
  purchaseDate: string;
  supplier: string;
  address?: string;
  qrData: string;
}

export interface PrintOptions {
  widthMm?: number;
  heightMm?: number;
  gapMm?: number;
  density?: number;
  speed?: number;
  direction?: number;
  copies?: number;
}

export const DEFAULT_ADDRESS = "Jl. Gotong Royong I No.50 . Ragunan, Ps. Minggu, Kota Jakarta Selatan.";

export function wrapTextLines(text: string, maxChars: number): string[] {
  const trimmed = (text || "").trim();
  if (!trimmed) return [];
  const rawLines = trimmed.split(/\r?\n/);
  const finalLines: string[] = [];

  for (const rLine of rawLines) {
    const words = rLine.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    let cur = "";
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (test.length <= maxChars) {
        cur = test;
      } else {
        if (cur) finalLines.push(cur);
        if (w.length > maxChars) {
          for (let i = 0; i < w.length; i += maxChars) {
            const chunk = w.slice(i, i + maxChars);
            if (i + maxChars >= w.length) cur = chunk;
            else finalLines.push(chunk);
          }
        } else {
          cur = w;
        }
      }
    }
    if (cur) finalLines.push(cur);
  }
  return finalLines;
}

export function buildTsplCommand(label: LabelData, options: PrintOptions = {}) {
  const widthMm = Number(options.widthMm) || 60;
  const heightMm = Number(options.heightMm) || 50;
  const gapMm = Number(options.gapMm) || 2;
  const density = Number(options.density) || 10;
  const speed = Number(options.speed) || 4;
  const direction = options.direction !== undefined ? Number(options.direction) : 1;
  const copies = Math.max(1, Number(options.copies) || 1);

  const dotsW = widthMm * 8; // e.g. 60mm = 480 dots
  const dotsH = heightMm * 8; // e.g. 50mm = 400 dots
  const marginX = 14;
  const curY = 12;

  const lines: string[] = [];
  lines.push(`SIZE ${widthMm} mm, ${heightMm} mm`);
  lines.push(`GAP ${gapMm} mm, 0 mm`);
  lines.push(`DIRECTION ${direction}`);
  lines.push(`DENSITY ${density}`);
  lines.push(`SPEED ${speed}`);
  lines.push(`REFERENCE 0,0`);
  lines.push(`CODEPAGE 1252`);
  lines.push(`CLS`);

  const clean = (s: string) => (s || "").trim().replace(/"/g, "'");

  // 1. TOP SECTION (50/50 Split)
  // Left: QR Code (cellWidth = 4: ~156 dots total with quiet zone)
  const qrData = clean(label.qrData);
  const cellWidth = 4;
  lines.push(`QRCODE ${marginX},${curY},M,${cellWidth},A,0,"${qrData}"`);

  // Right: Specification : + Multi-line specs
  const midX = Math.floor(dotsW / 2);
  const specX = midX + 6;
  lines.push(`TEXT ${specX},${curY + 2},"2",0,1,1,"Specification :"`);

  // Margin below "Specification :" so content does not collide or sit too close
  const specContentStartY = curY + 2 + 28;
  const maxSpecChars = Math.max(8, Math.floor((dotsW - specX - marginX) / 12));
  const modelLines = wrapTextLines(clean(label.model), maxSpecChars);
  let specLineY = specContentStartY;
  for (let i = 0; i < Math.min(modelLines.length, 7); i++) {
    lines.push(`TEXT ${specX},${specLineY},"2",0,1,1,"${modelLines[i]}"`);
    specLineY += 20;
  }

  // Top section bottom boundary (ensures Asset Name NEVER collides with QR code)
  const qrEstimatedBottom = curY + 162;
  const topSectionBottom = Math.max(qrEstimatedBottom, specLineY);

  // 2. BOTTOM SECTION (Anchored directly at the very bottom of the label)
  const printableW = dotsW - marginX * 2;
  const bottomMargin = 12;
  const addrLine2Y = dotsH - bottomMargin - 12; // Font 1 height 12
  const addrLine1Y = addrLine2Y - 14;           // 14 dots line spacing
  const supplierY = addrLine1Y - 24;            // Font 2 height 20
  const propertyY = supplierY - 16;             // Font 1 height 12

  // 3. MIDDLE SECTION (Asset Name, Tahun Pembelian, Serial Number)
  // Evenly distributed in the generous space between top section and bottom section
  const midStartY = topSectionBottom + 18;
  const midAvailable = propertyY - midStartY - 10;
  const midStep = Math.max(22, Math.min(32, Math.floor(midAvailable / 3)));

  const maxCharsFull = Math.floor(printableW / 12);
  const assetName = clean(label.name);
  lines.push(`TEXT ${marginX},${midStartY},"2",0,1,1,"Asset Name : ${assetName.substring(0, maxCharsFull)}"`);

  const dateStr = clean(label.purchaseDate);
  lines.push(`TEXT ${marginX},${midStartY + midStep},"2",0,1,1,"Tahun Pembelian: ${dateStr.substring(0, maxCharsFull)}"`);

  const serialStr = clean(label.serial);
  lines.push(`TEXT ${marginX},${midStartY + midStep * 2},"2",0,1,1,"Serial Number: ${serialStr.substring(0, maxCharsFull)}"`);

  // Render Bottom Section
  // Property (smaller font size)
  lines.push(`TEXT ${marginX},${propertyY},"1",0,1,1,"Property"`);

  // Supplier Name
  const supplier = clean(label.supplier);
  lines.push(`TEXT ${marginX},${supplierY},"2",0,1,1,"${supplier.substring(0, maxCharsFull)}"`);

  // Address (Wrapped to 38 chars per line so it NEVER cuts off on right edge)
  const address = clean(label.address || DEFAULT_ADDRESS);
  const addressLines = wrapTextLines(address, 38);
  lines.push(`TEXT ${marginX},${addrLine1Y},"1",0,1,1,"${addressLines[0] || ''}"`);
  if (addressLines[1]) {
    lines.push(`TEXT ${marginX},${addrLine2Y},"1",0,1,1,"${addressLines[1]}"`);
  }

  lines.push(`PRINT 1,${copies}`);

  const commandText = lines.join("\r\n") + "\r\n";
  return {
    commandText,
    bytes: new TextEncoder().encode(commandText),
    copies,
  };
}
