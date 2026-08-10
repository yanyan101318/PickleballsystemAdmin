import { useEffect, useState } from "react";
import { BRAND_NAME, buildReceiptLogoHtml } from "../lib/brand";

/**
 * Equipment Sale Receipt - Triggers automatic printing
 * Displays formatted receipt for equipment sales
 */
export default function EquipmentSaleReceipt({ sale, onAfterPrint }) {
  const [printTriggered, setPrintTriggered] = useState(false);

  useEffect(() => {
    if (!printTriggered) {
      setPrintTriggered(true);
      document.title = `${BRAND_NAME} EQUIPMENT SALE RECEIPT`;
      
      // Small delay to ensure DOM is ready, then trigger print
      setTimeout(() => {
        window.print();
        if (onAfterPrint) onAfterPrint();
      }, 100);
    }
  }, [printTriggered, onAfterPrint]);

  if (!sale) return null;

  const { transactionId, buyerName, contactNumber, items, total, paymentMethod, createdAt } = sale;
  const date = createdAt ? new Date(createdAt) : new Date();
  const dateStr = date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeStr = date.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div id="equipment-sale-receipt" className="hidden print:block w-full p-6 bg-white text-black">
      <style>{`
        @media print {
          body { margin: 0; padding: 0; }
          #equipment-sale-receipt { display: block !important; page-break-after: avoid; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="text-center mb-4">
        {/* Logo/Brand */}
        <div dangerouslySetInnerHTML={{ __html: buildReceiptLogoHtml({ maxWidth: "120px", marginBottom: "4px" }) }} />
        <p className="font-bold text-xs uppercase tracking-wider mb-1">Equipment Sale Receipt</p>
        <p className="text-[10px] text-gray-600">{BRAND_NAME}</p>
      </div>

      <div className="border-t border-b border-gray-400 py-3 mb-3 text-[10px]">
        <div className="flex justify-between mb-1">
          <span className="font-semibold">Transaction ID:</span>
          <span className="font-mono">{transactionId}</span>
        </div>
        <div className="flex justify-between mb-1">
          <span className="font-semibold">Date:</span>
          <span>{dateStr} {timeStr}</span>
        </div>
      </div>

      {/* Buyer Info */}
      <div className="mb-3 text-[10px]">
        <div className="flex justify-between mb-1">
          <span className="font-semibold">Buyer:</span>
          <span>{buyerName}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold">Contact:</span>
          <span className="font-mono">{contactNumber}</span>
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full text-[10px] mb-3 border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-800">
            <th className="text-left py-1 pr-1">Item</th>
            <th className="text-right py-1 px-1">Qty</th>
            <th className="text-right py-1 px-1">Price</th>
            <th className="text-right py-1 pl-1">Total</th>
          </tr>
        </thead>
        <tbody>
          {(items || []).map((item, idx) => (
            <tr key={idx} className="border-b border-gray-300">
              <td className="text-left py-1 pr-1">{item.itemName}</td>
              <td className="text-right py-1 px-1">{item.quantity}</td>
              <td className="text-right py-1 px-1 font-mono">₱{Number(item.price).toFixed(2)}</td>
              <td className="text-right py-1 pl-1 font-mono font-semibold">
                ₱{(Number(item.quantity) * Number(item.price)).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Total */}
      <div className="border-t-2 border-b-2 border-gray-800 py-2 mb-3">
        <div className="flex justify-between text-sm font-bold">
          <span>TOTAL AMOUNT:</span>
          <span className="font-mono">₱{Number(total).toFixed(2)}</span>
        </div>
      </div>

      {/* Payment Info */}
      <div className="text-[10px] mb-4">
        <div className="flex justify-between">
          <span className="font-semibold">Payment Method:</span>
          <span>{paymentMethod}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[10px] text-gray-600 pt-2 border-t border-gray-400">
        <p className="font-semibold mb-1">Thank you for your purchase!</p>
        <p>Please keep this receipt for your records.</p>
        <p className="mt-2 text-[9px]">
          {`${BRAND_NAME} • ${new Date().getFullYear()}`}
        </p>
      </div>
    </div>
  );
}
