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
  // Wider left, right, and top margins (24 dots = 3.0mm; bottom kept as-is)
  const marginLeft = dotsW >= 450 ? 24 : 16;
  const marginRight = dotsW >= 450 ? 24 : 16;
  const marginTop = dotsH >= 350 ? 24 : 16;

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

  // 1. TOP SECTION: Enlarged QR code + Specification adjacent (with comfortable margins)
  const qrData = clean(label.qrData);
  const cellWidth = dotsW >= 450 ? 5 : 4;
  lines.push(`QRCODE ${marginLeft},${marginTop},M,${cellWidth},A,0,"${qrData}"`);

  // Position Specification directly adjacent to QR code (eliminates awkward empty gap)
  const specX = cellWidth === 5 ? 208 : 175;
  lines.push(`TEXT ${specX},${marginTop + 2},"2",0,1,1,"Specification :"`);

  // Multi-line specs (with comfortable gap / enter spacing below "Specification :")
  const specGap = 10;
  const specContentStartY = marginTop + 2 + 24 + specGap;
  const maxSpecChars = Math.max(8, Math.floor((dotsW - specX - marginRight) / 12));
  const modelLines = wrapTextLines(clean(label.model), maxSpecChars);
  let specLineY = specContentStartY;
  for (let i = 0; i < Math.min(modelLines.length, 6); i++) {
    lines.push(`TEXT ${specX},${specLineY},"2",0,1,1,"${modelLines[i]}"`);
    specLineY += 20;
  }

  // Top section bottom boundary (approx 175 dots for cellWidth 5)
  const qrEstimatedBottom = marginTop + (cellWidth === 5 ? 175 : 145);
  const topSectionBottom = Math.max(qrEstimatedBottom, specLineY);

  // 2. BOTTOM SECTION (Anchored cleanly at bottom — unchanged as requested)
  const printableW = dotsW - marginLeft - marginRight;
  const bottomMargin = 10;
  const addrLine2Y = dotsH - bottomMargin - 12; // Font 1 height 12
  const addrLine1Y = addrLine2Y - 14;           // 14 dots line spacing
  const supplierY = addrLine1Y - 22;            // Font 2 height 20
  const propertyY = supplierY - 16;             // Font 1 height 12

  // 3. MIDDLE SECTION (Asset Name, Tahun Pembelian, Serial Number + Small Barcode)
  const serialStr = clean(label.serial);
  const hasBarcode = Boolean(serialStr && serialStr !== '-');
  const midStartY = topSectionBottom + 10;
  const maxCharsFull = Math.floor(printableW / 12);
  const assetName = clean(label.name);
  const dateStr = clean(label.purchaseDate);

  if (hasBarcode) {
    const lineStep = 22;
    const nameY = midStartY;
    const dateY = nameY + lineStep;
    const serialY = dateY + lineStep;
    const barcodeY = serialY + 22;
    const barcodeHeight = 22; // Small 1D barcode ~2.75mm
    const narrow = serialStr.length > 18 ? 1 : 2;

    lines.push(`TEXT ${marginLeft},${nameY},"2",0,1,1,"Asset Name : ${assetName.substring(0, maxCharsFull)}"`);
    lines.push(`TEXT ${marginLeft},${dateY},"2",0,1,1,"Tahun Pembelian: ${dateStr.substring(0, maxCharsFull)}"`);
    lines.push(`TEXT ${marginLeft},${serialY},"2",0,1,1,"Serial Number: ${serialStr.substring(0, maxCharsFull)}"`);
    lines.push(`BARCODE ${marginLeft},${barcodeY},"128",${barcodeHeight},0,0,${narrow},2,"${serialStr}"`);
  } else {
    const midAvailable = propertyY - midStartY - 8;
    const midStep = Math.max(22, Math.min(28, Math.floor(midAvailable / 3)));

    lines.push(`TEXT ${marginLeft},${midStartY},"2",0,1,1,"Asset Name : ${assetName.substring(0, maxCharsFull)}"`);
    lines.push(`TEXT ${marginLeft},${midStartY + midStep},"2",0,1,1,"Tahun Pembelian: ${dateStr.substring(0, maxCharsFull)}"`);
    lines.push(`TEXT ${marginLeft},${midStartY + midStep * 2},"2",0,1,1,"Serial Number: ${serialStr.substring(0, maxCharsFull)}"`);
  }

  // Render Bottom Section (aligned to marginLeft)
  lines.push(`TEXT ${marginLeft},${propertyY},"1",0,1,1,"Property"`);

  const supplier = clean(label.supplier);
  lines.push(`TEXT ${marginLeft},${supplierY},"2",0,1,1,"${supplier.substring(0, maxCharsFull)}"`);

  const address = clean(label.address || DEFAULT_ADDRESS);
  const addressLines = wrapTextLines(address, 38);
  lines.push(`TEXT ${marginLeft},${addrLine1Y},"1",0,1,1,"${addressLines[0] || ''}"`);
  if (addressLines[1]) {
    lines.push(`TEXT ${marginLeft},${addrLine2Y},"1",0,1,1,"${addressLines[1]}"`);
  }

  lines.push(`PRINT 1,${copies}`);

  const commandText = lines.join("\r\n") + "\r\n";
  return {
    commandText,
    bytes: new TextEncoder().encode(commandText),
    copies,
  };
}
