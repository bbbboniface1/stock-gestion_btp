import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, QrCode, ExternalLink } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  productId: number;
  productName: string;
  currentStock: number;
  unit: string;
}

export default function QRCodeModal({ open, onClose, productId, productName, currentStock, unit }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const scanUrl = `${window.location.origin}${base}/scan?product_id=${productId}`;

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const svgEl = printRef.current?.querySelector("svg");
    const svgHtml = svgEl ? svgEl.outerHTML : "";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code — ${productName}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: monospace;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              padding: 32px;
              background: #fff;
            }
            .label {
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.1em;
              color: #666;
              margin-bottom: 8px;
            }
            .name {
              font-size: 20px;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #111;
              margin-bottom: 4px;
            }
            .stock {
              font-size: 13px;
              color: #888;
              text-transform: uppercase;
              margin-bottom: 24px;
            }
            svg { display: block; margin: 0 auto 20px; }
            .url {
              font-size: 9px;
              color: #aaa;
              word-break: break-all;
              max-width: 240px;
              text-align: center;
            }
            .border-box {
              border: 2px solid #ea580c;
              border-radius: 8px;
              padding: 24px 32px;
              text-align: center;
            }
            @media print {
              body { min-height: auto; }
            }
          </style>
        </head>
        <body>
          <div class="border-box">
            <div class="label">STOCK BTP — QR Code Produit</div>
            <div class="name">${productName}</div>
            <div class="stock">Stock actuel : ${currentStock} ${unit}</div>
            ${svgHtml}
            <div class="url">${scanUrl}</div>
          </div>
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-wide flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            QR Code Produit
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-5 py-2">
          {/* Product info */}
          <div className="text-center">
            <div className="font-bold text-lg uppercase tracking-wide">{productName}</div>
            <div className="text-sm text-muted-foreground font-mono">Stock : {currentStock} {unit}</div>
          </div>

          {/* QR Code */}
          <div
            ref={printRef}
            className="bg-white p-4 rounded-lg border-2 border-primary/30 shadow-inner"
          >
            <QRCodeSVG
              value={scanUrl}
              size={220}
              bgColor="#ffffff"
              fgColor="#111111"
              level="M"
              includeMargin={false}
            />
          </div>

          {/* Scan URL */}
          <div className="w-full bg-muted/40 rounded-sm px-3 py-2 border border-border">
            <div className="text-xs text-muted-foreground uppercase font-mono mb-1">URL de scan</div>
            <div className="text-xs font-mono text-foreground break-all">{scanUrl}</div>
          </div>

          {/* Instructions */}
          <div className="text-xs text-muted-foreground text-center leading-relaxed">
            Scannez avec l'appareil photo de votre téléphone — s'ouvre directement dans le navigateur.
          </div>

          {/* Actions */}
          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              className="flex-1 uppercase font-bold text-xs border-border"
              onClick={handlePrint}
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimer
            </Button>
            <Button
              variant="outline"
              className="flex-1 uppercase font-bold text-xs border-primary/40 text-primary hover:bg-primary/10"
              onClick={() => window.open(scanUrl, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Ouvrir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
