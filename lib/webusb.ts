/**
 * WebUSB Driver for Xprinter & Thermal Barcode Printers
 */

export const KNOWN_DEVICES = [
  { vendorId: 0x2d37, productId: 0x83d7, name: "Xprinter XP-420B" },
  { vendorId: 0x2d37, name: "Xprinter (official)" },
  { vendorId: 0x6868, productId: 0x0200, name: "Xprinter OEM" },
  { vendorId: 0x6868, name: "Xprinter OEM" },
  { vendorId: 0x0483, productId: 0x5720, name: "STMicroelectronics Bridge" },
  { vendorId: 0x0483, name: "STMicroelectronics" },
  { vendorId: 0x0416, productId: 0x5011, name: "Winbond / Nuvoton" },
  { vendorId: 0x0416, productId: 0x0501, name: "Winbond / Nuvoton" },
  { vendorId: 0x0416, name: "Winbond / Nuvoton" },
  { vendorId: 0x28e9, name: "GigaDevice (Xprinter)" },
  { vendorId: 0x1a86, name: "QinHeng / WCH" },
  { vendorId: 0x0fe6, name: "HPRT / Rongta" },
  { vendorId: 0x04b8, name: "Epson" },
  { vendorId: 0x0a5f, name: "Zebra" }
];

export function isSupportedPrinter(device: any): boolean {
  if (KNOWN_DEVICES.some(d => d.vendorId === device.vendorId && (!d.productId || d.productId === device.productId))) {
    return true;
  }
  try {
    for (const cfg of device.configurations || []) {
      for (const intf of cfg.interfaces || []) {
        for (const alt of intf.alternates || []) {
          if (alt.interfaceClass === 7) return true;
        }
      }
    }
  } catch (e) {}
  return false;
}

export class WebUsbPrinter {
  device: any = null;
  endpoint: any = null;
  claimedInterface: number | null = null;

  get connected(): boolean {
    return this.device !== null;
  }

  get deviceInfo(): string {
    if (!this.device) return "";
    const name = this.device.productName || "Xprinter XP-420B";
    const vid = (this.device.vendorId || 0).toString(16).padStart(4, "0");
    const pid = (this.device.productId || 0).toString(16).padStart(4, "0");
    return `${name} (VID: 0x${vid}, PID: 0x${pid})`;
  }

  async autoConnect(): Promise<any> {
    if (typeof navigator === "undefined" || !("usb" in navigator)) return null;
    try {
      const devices = await (navigator as any).usb.getDevices();
      const match = devices.find((d: any) => isSupportedPrinter(d));
      if (match) {
        await this.openDevice(match);
        return match;
      }
    } catch (e) {
      console.warn("[TSPL] AutoConnect error:", e);
    }
    return null;
  }

  async connect(): Promise<any> {
    if (typeof navigator === "undefined" || !("usb" in navigator)) {
      throw new Error("WebUSB is not supported in this browser. Please open in Google Chrome or Microsoft Edge via HTTPS.");
    }
    const filters = KNOWN_DEVICES.map(d =>
      d.productId !== undefined ? { vendorId: d.vendorId, productId: d.productId } : { vendorId: d.vendorId }
    );

    let device: any;
    try {
      device = await (navigator as any).usb.requestDevice({ filters });
    } catch (err) {
      device = await (navigator as any).usb.requestDevice({ filters: [] });
    }

    await this.openDevice(device);
    return device;
  }

  async openDevice(device: any): Promise<void> {
    try {
      await device.open();
    } catch (e) {}

    this.endpoint = null;
    let targetInterfaceNumber: number | null = null;
    let targetConfigValue: number | null = null;

    for (const cfg of device.configurations || []) {
      for (const intf of cfg.interfaces || []) {
        for (const alt of intf.alternates || []) {
          for (const ep of alt.endpoints || []) {
            if (ep.direction === "out" && ep.type === "bulk") {
              this.endpoint = ep;
              targetInterfaceNumber = intf.interfaceNumber;
              targetConfigValue = cfg.configurationValue;
              break;
            }
          }
          if (this.endpoint) break;
        }
        if (this.endpoint) break;
      }
      if (this.endpoint) break;
    }

    if (!this.endpoint || targetInterfaceNumber === null) {
      throw new Error("No bulk OUT endpoint found on device.");
    }

    if (targetConfigValue !== null && device.configuration?.configurationValue !== targetConfigValue) {
      await device.selectConfiguration(targetConfigValue).catch(() => {});
    }

    try {
      await device.claimInterface(targetInterfaceNumber);
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.toLowerCase().includes("claim") || msg.toLowerCase().includes("unable") || msg.toLowerCase().includes("denied")) {
        throw new Error("Could not claim USB interface " + targetInterfaceNumber + " (" + msg + "). On macOS, the system printer driver (CUPS) may be holding the printer. Try removing the printer from macOS System Settings → Printers & Scanners, or unplug and replug the USB cable, or use the 'Browser Print' button.");
      }
      throw err;
    }

    this.claimedInterface = targetInterfaceNumber;
    this.device = device;
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.device || !this.endpoint) throw new Error("Printer not connected.");
    const chunk = 512;
    for (let i = 0; i < data.length; i += chunk) {
      const slice = data.subarray(i, Math.min(i + chunk, data.length));
      const res = await this.device.transferOut(this.endpoint.endpointNumber, slice);
      if (res.status !== "ok") {
        throw new Error(`Transfer failed on endpoint ${this.endpoint.endpointNumber}: ${res.status}`);
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.device) {
      if (this.claimedInterface !== null) {
        await this.device.releaseInterface(this.claimedInterface).catch(() => {});
        this.claimedInterface = null;
      }
      await this.device.close().catch(() => {});
      this.device = null;
      this.endpoint = null;
    }
  }
}
