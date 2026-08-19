import { useEffect, useState } from "react";
import api from "../../services/api";
import QRCode from "qrcode";

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

const STATUS_COLORS = {
  unpaid:  "bg-red-100 text-red-700",
  paid:    "bg-green-100 text-green-700",
  partial: "bg-amber-100 text-amber-700",
};

export default function InvoiceManager() {
  const [invoices, setInvoices]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showPay, setShowPay]         = useState(false);
  const [selectedInv, setSelectedInv] = useState(null);
  const [showQr, setShowQr]           = useState(false);
  const [formError, setFormError]     = useState("");
  const [saving, setSaving]           = useState(false);
  const [payMethod, setPayMethod]     = useState("cash");
  const [qrImgSrc, setQrImgSrc]       = useState("");

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/invoices/");
      setInvoices(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInvoices(); }, []);

  useEffect(() => {
    if (showQr && selectedInv?.qr_code_data) {
      QRCode.toDataURL(selectedInv.qr_code_data, { width: 300, margin: 2 })
        .then(url => setQrImgSrc(url))
        .catch(err => console.error("Error generating QR", err));
    } else {
      setQrImgSrc("");
    }
  }, [showQr, selectedInv]);
  const handleMarkPaid = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/invoices/${selectedInv.id}/pay`, { payment_method: payMethod });
      setShowPay(false);
      fetchInvoices();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to mark as paid");
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Invoice Manager</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{invoices.length} invoice{invoices.length !== 1 ? "s" : ""} generated</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-gray-400 text-sm">Loading…</div>
        ) : invoices.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl mx-4 my-4">
            <p className="font-medium text-gray-500 dark:text-gray-400">No invoices yet</p>
            <p className="text-sm text-gray-400 mt-1">Generate an invoice for a completed job</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                {["Job ID", "Customer", "Device", "Subtotal", "Tax", "Total", "Status", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-blue-600 text-xs">{inv.job_public_id}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800 dark:text-gray-100">{inv.customer_name}</p>
                    <p className="text-xs text-gray-400">{inv.customer_phone}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-xs">{inv.device}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200">LKR {Number(inv.subtotal).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">LKR {Number(inv.tax_amount).toLocaleString()}</td>
                  <td className="px-4 py-3 font-bold text-gray-800 dark:text-gray-100">LKR {Number(inv.total_amount).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[inv.payment_status] ?? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"}`}>
                      {inv.payment_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {inv.payment_status !== "paid" && (
                        <button
                          onClick={() => { setSelectedInv(inv); setPayMethod("cash"); setShowPay(true); }}
                          className="text-green-600 hover:text-green-800 text-xs font-medium"
                        >
                          Mark Paid
                        </button>
                      )}
                      {inv.qr_code_data && (
                        <button
                          onClick={() => { setSelectedInv(inv); setShowQr(true); }}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          QR
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>


      {/* Mark Paid Modal */}
      <Modal open={showPay} onClose={() => setShowPay(false)} title="Mark Invoice as Paid">
        <form onSubmit={handleMarkPaid} className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Total due: <strong className="text-gray-800 dark:text-gray-100">LKR {Number(selectedInv?.total_amount || 0).toLocaleString()}</strong>
          </p>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Payment Method</label>
            <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="transfer">Bank Transfer</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowPay(false)}
              className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white py-2 rounded-lg text-sm font-semibold">
              {saving ? "Saving…" : "Confirm Payment"}
            </button>
          </div>
        </form>
      </Modal>

      {/* QR Code Modal */}
      <Modal open={showQr} onClose={() => setShowQr(false)} title="Invoice QR Data">
<<<<<<< Updated upstream
        <div className="space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Scan or share this data string with the customer receipt:</p>
          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 font-mono text-xs text-gray-700 dark:text-gray-200 break-all">
=======
        <div className="space-y-4">
          <p className="text-sm text-gray-600 text-center">Scan this QR code to view invoice details:</p>
          
          <div className="flex justify-center bg-gray-50 p-4 rounded-xl border border-gray-100">
            {qrImgSrc ? (
              <img src={qrImgSrc} alt="QR Code" className="w-48 h-48 rounded-lg shadow-sm" />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-gray-400 text-sm">Generating...</div>
            )}
          </div>
          
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 font-mono text-[10px] text-gray-500 break-all text-center">
>>>>>>> Stashed changes
            {selectedInv?.qr_code_data}
          </div>
          <button onClick={() => setShowQr(false)}
            className="w-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
            Close
          </button>
        </div>
      </Modal>
    </div>
  );
}
