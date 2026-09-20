import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AppService } from './app.service';

export interface KitchenTicketItem {
  id: number;
  itemId: number;
  itemName: string;
  quantity: number;
  status?: number;
  createdAt?: string;
}

export interface KitchenGroup {
  printerId: string;
  queueNo: number;
  invoiceNo: number;
  locationId: number;
  items: KitchenTicketItem[];
}

export interface SendOrderToKitchensResponse {
  success: boolean;
  message?: string;
  invoiceNo?: number;
  locationId?: number;
  kitchenCount?: number;
  kitchens?: KitchenGroup[];
}

export interface KitchenPrintMeta {
  orderNumber: number | string;
  table?: string;
  orderType: string;
  orderDate: string;
  branchName: string;
  waiterOrDriver?: string;
  specialInstructions?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PosPrintService {
  private qzUnavailable = false;

  constructor(
    private http: HttpClient,
    private app: AppService
  ) { }

  public async sendOrderToKitchens(orderId: number, locationId: number): Promise<KitchenGroup[]> {
    const response = await firstValueFrom(
      this.http.post<SendOrderToKitchensResponse>('/api/sales/sendordertokitchens', {
        orderId,
        locationId
      })
    );

    return (response?.kitchens || []).filter(kitchen => Array.isArray(kitchen?.items) && kitchen.items.length > 0);
  }

  /**
   * Dine-in Fire: send to kitchens and print each group on its printer. No queue tickets.
   */
  public async printAfterDineInFire(orderId: number, locationId: number, meta: KitchenPrintMeta): Promise<void> {
    const kitchens = await this.sendOrderToKitchensSafe(orderId, locationId);
    await this.printKitchenTickets(kitchens, meta);
  }

  /**
   * Takeaway / Delivery Pay Now:
   * 1) kitchen tickets on their printers
   * 2) main invoice on the device default printer
   * 3) small queue tickets after the invoice
   */
  public async printAfterTakeawayOrDeliveryPayment(
    orderId: number,
    locationId: number,
    meta: KitchenPrintMeta,
    invoiceHtml: string
  ): Promise<void> {
    const kitchensPromise = this.sendOrderToKitchensSafe(orderId, locationId);
    await this.printOnDefaultPrinter(invoiceHtml);
    const kitchens = await kitchensPromise;
    await this.printKitchenTickets(kitchens, meta);
    await this.printQueueTickets(kitchens);
  }

  public printOnDefaultPrinter(html: any): Promise<void> {
    return this.printViaIframe(this.normalizePrintHtml(html));
  }

  private async sendOrderToKitchensSafe(orderId: number, locationId: number): Promise<KitchenGroup[]> {
    try {
      return await this.sendOrderToKitchens(orderId, locationId);
    } catch (error) {
      this.app.handleApiError(error);
      return [];
    }
  }

  private async printKitchenTickets(kitchens: KitchenGroup[], meta: KitchenPrintMeta): Promise<void> {
    for (const kitchen of kitchens) {
      const html = this.buildKitchenTicketHtml(kitchen, meta);
      await this.printHtml(html, kitchen.printerId);
    }
  }

  private async printQueueTickets(kitchens: KitchenGroup[]): Promise<void> {
    for (const kitchen of kitchens) {
      await this.printViaIframe(this.buildQueueTicketHtml(kitchen));
    }
  }

  private async printHtml(html: string, printerName?: string): Promise<void> {
    const targetPrinter = (printerName || '').trim();

    if (targetPrinter && this.printViaNativeHost(html, targetPrinter)) {
      await this.delay(400);
      return;
    }

    if (targetPrinter && await this.printViaQz(html, targetPrinter)) {
      await this.delay(300);
      return;
    }

    await this.printViaIframe(html);
  }

  private printViaNativeHost(html: string, printerName: string): boolean {
    const webview = (window as any).chrome?.webview;
    if (webview?.postMessage) {
      webview.postMessage({ type: 'printHtml', printerName, html });
      return true;
    }

    const bridge = (window as any).profPrint || (window as any).profPrintBridge;
    if (typeof bridge === 'function') {
      bridge(html, printerName);
      return true;
    }
    if (bridge?.print) {
      bridge.print(html, printerName);
      return true;
    }

    return false;
  }

  private async printViaQz(html: string, printerName: string): Promise<boolean> {
    if (this.qzUnavailable) {
      return false;
    }

    const qz = await this.getQz();
    if (!qz) {
      this.qzUnavailable = true;
      return false;
    }

    try {
      if (!qz.websocket.isActive()) {
        await Promise.race([
          qz.websocket.connect({ retries: 0, delay: 0.5 }),
          this.delay(2000).then(() => Promise.reject(new Error('QZ connect timeout')))
        ]);
      }
    } catch {
      this.qzUnavailable = true;
      return false;
    }

    try {
      let printer = printerName;
      try {
        printer = await qz.printers.find(printerName);
      } catch {
        printer = printerName;
      }

      const config = qz.configs.create(printer, {
        scaleContent: true,
        rasterize: false,
        margins: 0
      });

      await qz.print(config, [{
        type: 'pixel',
        format: 'html',
        flavor: 'plain',
        data: html
      }]);

      return true;
    } catch {
      return false;
    }
  }

  private async getQz(): Promise<any | null> {
    return (window as any).qz || null;
  }

  private normalizePrintHtml(html: any): string {
    const content = String(html || '');
    if (/<html[\s>]/i.test(content)) {
      return content;
    }

    return `<!doctype html>
      <html>
      <head><meta charset="utf-8"></head>
      <body>${content}</body>
      </html>`;
  }

  private printViaIframe(html: string): Promise<void> {
    return new Promise(resolve => {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const win = iframe.contentWindow;
      const doc = iframe.contentDocument;
      if (!win || !doc) {
        iframe.remove();
        resolve();
        return;
      }

      doc.open();
      doc.write(html);
      doc.close();

      let settled = false;
      const finish = () => {
        if (settled) {
          return;
        }
        settled = true;
        win.removeEventListener('afterprint', finish);
        iframe.remove();
        resolve();
      };

      win.addEventListener('afterprint', finish);

      const triggerPrint = () => {
        try {
          win.focus();
          win.print();
        } catch {
          finish();
        }
      };

      setTimeout(triggerPrint, 250);
      setTimeout(finish, 10000);
    });
  }

  private buildQueueTicketHtml(kitchen: KitchenGroup): string {
    const dir = document.documentElement.dir || 'ltr';
    return `<!doctype html>
      <html dir="${dir}">
      <head>
        <meta charset="utf-8">
        <title>${this.escapeHtml(this.app.localize('Queue No'))} ${this.escapeHtml(String(kitchen.queueNo ?? ''))}</title>
        ${this.queueTicketStyles()}
      </head>
      <body>
        ${this.buildQueueTicketMarkup(kitchen)}
      </body>
      </html>`;
  }

  private buildKitchenTicketHtml(kitchen: KitchenGroup, meta: KitchenPrintMeta): string {
    const dir = document.documentElement.dir || 'ltr';
    const itemRows = (kitchen.items || []).map(item => `
      <tr>
        <td>${this.escapeHtml(item.itemName || '')}</td>
        <td class="text-end">${this.escapeHtml(String(item.quantity ?? ''))}</td>
      </tr>
    `).join('');

    const tableRow = meta.table
      ? `<div class="mb-1">${this.escapeHtml(this.app.localize('Table'))}: ${this.escapeHtml(meta.table)}</div>`
      : '';
    const waiterRow = meta.waiterOrDriver
      ? `<div class="mb-1">${this.escapeHtml(this.app.localize('Waiter/Driver'))}: ${this.escapeHtml(meta.waiterOrDriver)}</div>`
      : '';
    const notesRow = meta.specialInstructions
      ? `<div class="footer">*** ${this.escapeHtml(meta.specialInstructions)} ***</div>`
      : '';

    return `<!doctype html>
      <html dir="${dir}">
      <head>
        <meta charset="utf-8">
        <title>${this.escapeHtml(kitchen.printerId || this.app.localize('Kitchen Order'))}</title>
        ${this.ticketStyles()}
      </head>
      <body>
        <div class="kitchen-ticket">
          <div class="header">
            <h4>${this.escapeHtml(this.app.localize('KITCHEN ORDER'))}</h4>
            <small>${this.escapeHtml(meta.branchName || '')}</small>
          </div>
          <div class="order-info">
            <div class="d-flex">
              <div>${this.escapeHtml(this.app.localize('Order #'))}${this.escapeHtml(String(meta.orderNumber || kitchen.invoiceNo || ''))}</div>
              <div>${this.escapeHtml(meta.orderDate || '')}</div>
            </div>
            <div class="mb-1">${this.escapeHtml(this.app.localize('Order Type'))}: ${this.escapeHtml(meta.orderType || '')}</div>
            ${tableRow}
            ${waiterRow}
          </div>
          <table>
            <thead>
              <tr>
                <th>${this.escapeHtml(this.app.localize('Item'))}</th>
                <th class="text-end">${this.escapeHtml(this.app.localize('Qty'))}</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
          ${notesRow}
        </div>
      </body>
      </html>`;
  }

  private buildQueueTicketMarkup(kitchen: KitchenGroup): string {
    const itemRows = (kitchen.items || []).map(item => `
      <tr>
        <td>${this.escapeHtml(item.itemName || '')}</td>
        <td class="qty">${this.escapeHtml(String(item.quantity ?? ''))}</td>
      </tr>
    `).join('');

    return `
      <div class="queue-ticket">
        <div class="queue-no">${this.escapeHtml(this.app.localize('Queue No'))} ${this.escapeHtml(String(kitchen.queueNo ?? ''))}</div>
        <table>
          <thead>
            <tr>
              <th>${this.escapeHtml(this.app.localize('Item'))}</th>
              <th class="qty">${this.escapeHtml(this.app.localize('Qty'))}</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
      </div>`;
  }

  private ticketStyles(): string {
    return `<style>
      @page { margin: 4mm; size: auto; }
      html, body {
        margin: 0;
        padding: 0;
        background: #fff;
        color: #000;
      }
      .kitchen-ticket {
        font-family: "Courier New", Tahoma, sans-serif;
        width: 80mm;
        max-width: 80mm;
        margin: 0 auto;
        padding: 6px;
      }
      .kitchen-ticket .header {
        text-align: center;
        border-bottom: 1px dashed #000;
        margin-bottom: 8px;
        padding-bottom: 4px;
      }
      .kitchen-ticket .header h4 {
        font-size: 16px;
        font-weight: bold;
        margin: 0;
        text-transform: uppercase;
      }
      .kitchen-ticket .header small {
        font-size: 11px;
        display: block;
      }
      .kitchen-ticket .order-info {
        border-bottom: 1px dashed #000;
        margin-bottom: 8px;
        padding-bottom: 4px;
        font-size: 11px;
        line-height: 1.3;
      }
      .kitchen-ticket .d-flex {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;
      }
      .kitchen-ticket .mb-1 { margin-bottom: 4px; }
      .kitchen-ticket table {
        width: 100%;
        border-collapse: collapse;
      }
      .kitchen-ticket th,
      .kitchen-ticket td {
        padding: 4px 0;
        font-size: 12px;
        vertical-align: top;
        border: none;
      }
      .kitchen-ticket thead th {
        border-bottom: 1px dashed #000;
        text-align: start;
      }
      .kitchen-ticket .text-end { text-align: end; }
      .kitchen-ticket .footer {
        text-align: center;
        border-top: 1px dashed #000;
        margin-top: 8px;
        padding-top: 4px;
        font-weight: bold;
        font-size: 11px;
      }
    </style>`;
  }

  private queueTicketStyles(): string {
    return `<style>
      @page { margin: 3mm; size: auto; }
      html, body {
        margin: 0;
        padding: 0;
        background: #fff;
      }
      .queue-ticket {
        font-family: "Courier New", Tahoma, sans-serif;
        width: 80mm;
        max-width: 80mm;
        margin: 0 auto;
        padding: 6px 4px 10px;
        color: #000;
      }
      .queue-ticket .queue-no {
        text-align: center;
        font-size: 28px;
        font-weight: 700;
        line-height: 1.15;
        margin: 4px 0 10px;
      }
      .queue-ticket table {
        width: 100%;
        border-collapse: collapse;
      }
      .queue-ticket th,
      .queue-ticket td {
        padding: 3px 0;
        font-size: 13px;
        border: none;
        text-align: start;
      }
      .queue-ticket thead th {
        border-bottom: 1px dashed #000;
      }
      .queue-ticket .qty {
        text-align: end;
        width: 28px;
      }
    </style>`;
  }

  private escapeHtml(value: string): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
