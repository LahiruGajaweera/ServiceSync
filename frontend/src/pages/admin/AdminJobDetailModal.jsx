import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import JobStatusBadge from "../../components/JobStatusBadge";
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

const HISTORY_STYLES = {
  pending: {
    color: "text-gray-500", bg: "bg-gray-100 dark:bg-gray-800", line: "bg-gray-300 dark:bg-gray-700",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  },
  in_progress: {
    color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30", line: "bg-blue-300 dark:bg-blue-700",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
  },
  completed: {
    color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/30", line: "bg-purple-300 dark:bg-purple-700",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
  },
  ready_for_pickup: {
    color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30", line: "bg-amber-300 dark:bg-amber-700",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
  },
  delivered: {
    color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/30", line: "bg-green-300 dark:bg-green-700",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
  },
  unclaimed: {
    color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/30", line: "bg-red-300 dark:bg-red-700",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  },
};

export default function AdminJobDetailModal({ open, jobId, onClose, onDone }) {
  const [job, setJob]           = useState(null);
  const [parts, setParts]       = useState([]);
  const [history, setHistory]   = useState([]);
  const [invoice, setInvoice]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [promoSetting, setPromoSetting] = useState(null);

  // Add part modal
  const [showPart, setShowPart]         = useState(false);
  const [invItems, setInvItems]         = useState([]);
  const [partSource, setPartSource]     = useState("inventory");
  const [selectedItem, setSelectedItem] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [quantity, setQuantity]         = useState(1);
  const [unitCost, setUnitCost]         = useState("");
  const [actualCost, setActualCost]     = useState("");
  const [overridePrice, setOverridePrice] = useState("");
  const [partError, setPartError]       = useState("");
  const [savingPart, setSavingPart]     = useState(false);

  // Invoice modal
  const [showInvoice, setShowInvoice] = useState(false);
  const [laborCost, setLaborCost]     = useState("");
  const [invError, setInvError]       = useState("");
  const [savingInv, setSavingInv]     = useState(false);

  // Pay modal
  const [showPay, setShowPay]     = useState(false);
  const [payMethod, setPayMethod] = useState("cash");
  const [paymentRef, setPaymentRef] = useState("");

  const [newStatus, setNewStatus] = useState("");
  const [statusNotes, setStatusNotes] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  // QR Code for PayHere
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  useEffect(() => {
    if (showPay && payMethod === "payhere" && invoice?.id) {
      const paymentLink = `${window.location.origin}/pay/${invoice.id}`;
      QRCode.toDataURL(paymentLink, { width: 160, margin: 1, color: { dark: '#3730a3', light: '#ffffff' } })
        .then(url => setQrCodeUrl(url))
        .catch(err => console.error(err));
    }
  }, [showPay, payMethod, invoice]);

  // Revert request handling
  const [processingRevert, setProcessingRevert] = useState(false);

  // Warranty Claim modal
  const [showWarrantyModal, setShowWarrantyModal] = useState(false);
  const [warrantyFault, setWarrantyFault]         = useState("");
  const [warrantyTechId, setWarrantyTechId]       = useState("");
  const [warrantyNotes, setWarrantyNotes]         = useState("");
  const [technicians, setTechnicians]             = useState([]);
  const [savingWarranty, setSavingWarranty]       = useState(false);
  const [warrantyError, setWarrantyError]         = useState("");

  const openWarrantyModal = async () => {
    setWarrantyFault(job?.fault_description || "");
    setWarrantyTechId(job?.technician_id || "");
    setWarrantyNotes("");
    setWarrantyError("");
    try {
      const { data } = await api.get("/users/", { params: { role: "technician" } });
      setTechnicians(data);
    } catch {
      setTechnicians([]);
    }
    setShowWarrantyModal(true);
  };

  const handleCreateWarrantyClaim = async (e) => {
    e.preventDefault();
    setWarrantyError("");
    setSavingWarranty(true);
    try {
      const payload = {
        customer_id: job.customer_id,
        technician_id: warrantyTechId || null,
        rework_of_job_id: job.id,
        device_brand: job.device_brand,
        device_model: job.device_model,
        device_imei: job.device_imei,
        fault_category: job.fault_category,
        fault_description: warrantyFault.trim() || job.fault_description,
        estimated_cost: 0,
        notes: warrantyNotes ? `[Warranty Claim for ${job.job_id}] ${warrantyNotes}` : `[Warranty Claim for ${job.job_id}]`,
      };
      await api.post("/jobs/", payload);
      setShowWarrantyModal(false);
      alert(`Warranty Claim registered successfully for Job #${job.job_id}!`);
      onDone?.();
      onClose();
    } catch (err) {
      setWarrantyError(err.response?.data?.detail || "Failed to register Warranty Claim");
    } finally {
      setSavingWarranty(false);
    }
  };

  const handleApproveRevert = async () => {
    setProcessingRevert(true);
    try {
      await api.post(`/jobs/${job.id}/revert-approve`);
      fetchAll();
      onDone?.();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to approve revert");
    } finally {
      setProcessingRevert(false);
    }
  };

  const handleRejectRevert = async () => {
    if (!window.confirm("Are you sure you want to reject this revert request?")) return;
    setProcessingRevert(true);
    try {
      await api.post(`/jobs/${job.id}/revert-reject`);
      fetchAll();
      onDone?.();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to reject revert");
    } finally {
      setProcessingRevert(false);
    }
  };

  const fetchAll = async () => {
    if (!open || !jobId) return;
    setLoading(true);
    setJob(null);
    setParts([]);
    setHistory([]);
    setInvoice(null);
    try {
      const [jobRes, partsRes, historyRes, invoiceRes, settingsRes] = await Promise.allSettled([
        api.get(`/jobs/${jobId}`),
        api.get(`/jobs/${jobId}/parts`),
        api.get(`/jobs/${jobId}/history`),
        api.get(`/jobs/${jobId}/invoice`),
        api.get(`/settings`),
      ]);
      if (jobRes.status === "fulfilled")     setJob(jobRes.value.data);
      if (partsRes.status === "fulfilled")   setParts(partsRes.value.data);
      if (historyRes.status === "fulfilled") setHistory(historyRes.value.data);
      if (invoiceRes.status === "fulfilled" && invoiceRes.value.data)
        setInvoice(invoiceRes.value.data);
      if (settingsRes.status === "fulfilled" && settingsRes.value.data)
        setPromoSetting(settingsRes.value.data.promotional_offers);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [jobId, open]);

  const openAddPart = async () => {
    setPartError(""); setSelectedItem(""); setSelectedBatchId(""); setQuantity(1); setUnitCost(""); setActualCost(""); setOverridePrice(""); setPartSource("inventory");
    try {
      const { data } = await api.get("/inventory/", { params: {} });
      setInvItems(data.filter((i) => i.quantity > 0));
    } catch { setInvItems([]); }
    setShowPart(true);
  };

  const handleAddPart = async (e) => {
    e.preventDefault();
    setPartError("");
    setSavingPart(true);
    try {
      const payload = {
        part_source: partSource,
        inventory_item_id: partSource === "inventory" ? selectedItem || null : null,
        donor_part_id: partSource === "donor" ? selectedItem || null : null,
        quantity: parseInt(quantity, 10),
        unit_cost: partSource === "donor" ? parseFloat(unitCost) : null,
      };
      if (selectedBatchId) {
        payload.batch_id = selectedBatchId;
      }
      if (overridePrice) {
        payload.override_price = parseFloat(overridePrice);
      }
      await api.post(`/jobs/${jobId}/parts`, payload);
      setShowPart(false);
      fetchAll();
    } catch (err) {
      setPartError(err.response?.data?.detail || "Failed to add part");
    } finally {
      setSavingPart(false);
    }
  };

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    setInvError("");
    setSavingInv(true);
    try {
      const partsTotalCost = parts.reduce((acc, p) => acc + ((Number(p.unit_cost) || 0) * (p.quantity || 1)), 0);
      const partsTotal = parts.reduce((acc, p) => acc + (Number(p.unit_price) * p.quantity), 0);
      const baseSub = partsTotal + (Number(laborCost) || 0);
      
      let calcDiscountAmt = 0;
      if (promoSetting && job) {
        try {
          const promo = JSON.parse(promoSetting);
          if (promo.active && promo.offers && promo.offers[job.fault_category]) {
             const offer = promo.offers[job.fault_category];
             if (offer.type === "fixed") {
                calcDiscountAmt = Number(offer.value);
             } else if (offer.type === "percentage") {
                calcDiscountAmt = baseSub * (Number(offer.value) / 100);
             }
             const minMarginPct = Number(promo.min_margin_percent || 0);
             if (minMarginPct > 0) {
                const absoluteMinTotal = partsTotalCost + (partsTotalCost * (minMarginPct / 100));
                let proposedTotal = baseSub - calcDiscountAmt;
                if (proposedTotal < absoluteMinTotal) {
                    calcDiscountAmt = Math.max(0, baseSub - absoluteMinTotal);
                }
             }
          }
        } catch(err) {}
      }

      await api.post("/invoices/", {
        job_id: jobId,
        labor_cost: parseFloat(laborCost) || 0,
        discount_amount: calcDiscountAmt,
        tax_rate: 0,
      });
      setShowInvoice(false);
      await fetchAll();
      setPayMethod("payhere");
      setShowPay(true);
    } catch (err) {
      setInvError(err.response?.data?.detail || "Failed to generate invoice");
    } finally {
      setSavingInv(false);
    }
  };

  const handlePrintFinalBill = async () => {
    try {
      const { data: settings } = await api.get("/settings");
      const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-LK", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
      
      const htmlContent = `<!doctype html><html><head><title>Final Invoice ${job.job_id}</title>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        @page { margin: 0; }
        body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #1f2937; margin: 0 auto; padding: 15px; width: 80mm; }
        .wrap { width: 100%; max-width: 100%; margin: 0 auto; }
        .center { text-align: center; }
        .brand { font-size: 22px; font-weight: 800; color: #000; letter-spacing: -.5px; }
        .muted { color: #6b7280; font-size: 12px; }
        .divider { border: none; border-top: 1px dashed #d1d5db; margin: 14px 0; }
        .jobid { font-size: 20px; font-weight: 800; letter-spacing: 1px; margin: 4px 0; }
        table { width: 100%; font-size: 12px; border-collapse: collapse; margin-bottom: 10px; }
        td { padding: 4px 0; vertical-align: top; }
        td.k { color: #6b7280; width: 50%; }
        td.v { font-weight: 600; text-align: right; }
        .foot { font-size: 11px; color: #9ca3af; margin-top: 10px; text-align: center; }
        .totals-table td { padding: 2px 0; }
        .totals-table td.k { font-weight: 400; color: #374151; }
      </style></head><body>
      <div class="wrap">
        <div class="center">
          <div class="brand">${settings.shop_name || "ServiceSync"}</div>
          <div class="muted">${settings.shop_address || "123 Galle Road, Colombo 03"}</div>
          <div class="muted">${settings.shop_phone || "+94 11 234 5678"}</div>
        </div>
        <hr class="divider" />
        <div class="center">
          <div class="muted">FINAL INVOICE / RECEIPT</div>
          <div class="jobid">${job.job_id}</div>
          <div class="muted">${fmtDate(invoice.created_at || new Date())}</div>
        </div>
        <hr class="divider" />
        <table>
          <tr><td class="k">Customer</td><td class="v">${job.customer_name || "—"}</td></tr>
          <tr><td class="k">Device</td><td class="v">${job.device_brand} ${job.device_model}</td></tr>
          ${job.device_imei ? `<tr><td class="k">IMEI</td><td class="v">${job.device_imei}</td></tr>` : ""}
          <tr><td class="k">Fault</td><td class="v">${job.fault_category ? job.fault_category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—"}</td></tr>
        </table>
        <hr class="divider" />
        <table class="totals-table">
          <tr><td class="k">Subtotal (Parts & Labor)</td><td class="v">LKR ${Number(invoice.subtotal).toLocaleString()}</td></tr>
          ${Number(invoice.discount_amount) > 0 ? `<tr><td class="k" style="color:#16a34a">Discount</td><td class="v" style="color:#16a34a">- LKR ${Number(invoice.discount_amount).toLocaleString()}</td></tr>` : ""}
          <tr><td class="k">Tax</td><td class="v">LKR ${Number(invoice.tax_amount).toLocaleString()}</td></tr>
          <tr><td class="k" style="font-size:14px; font-weight:800; padding-top:6px; color:#000;">Total Paid</td><td class="v" style="font-size:14px; font-weight:800; padding-top:6px; color:#000;">LKR ${Number(invoice.total_amount).toLocaleString()}</td></tr>
          <tr><td class="k" style="font-size:11px; padding-top:4px;">Payment Method</td><td class="v" style="font-size:11px; padding-top:4px; text-transform:uppercase;">${payMethod || 'CASH'}</td></tr>
          ${paymentRef ? `<tr><td class="k" style="font-size:11px; padding-top:2px;">Reference</td><td class="v" style="font-size:11px; padding-top:2px;">${paymentRef}</td></tr>` : ""}
        </table>
        <hr class="divider" />
        <div class="foot">
          ${settings.invoice_footer_note ? settings.invoice_footer_note.replace(/\n/g, '<br/>') : "Thank you for choosing ServiceSync!"}
        </div>
      </div>
      </body></html>`;
      
      // Use a hidden iframe to bypass popup blockers
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      
      iframe.contentWindow.document.open();
      iframe.contentWindow.document.write(htmlContent);
      iframe.contentWindow.document.close();
      
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => { document.body.removeChild(iframe); }, 2000);
      }, 500);
    } catch (err) {
      console.error(err);
      alert("Failed to print invoice.");
    }
  };

  const handleMarkPaid = async (e) => {
    e.preventDefault();
    if (payMethod === "payhere") {
      return handlePayHerePayment();
    }
    
    try {
      await api.patch(`/invoices/${invoice.id}/pay`, { payment_method: payMethod, payment_reference: paymentRef });
      // Automatically set job to delivered upon payment
      if (job.status !== "delivered") {
         await api.patch(`/jobs/${jobId}/status`, { status: "delivered", notes: "Automatically marked as delivered upon payment." });
      }
      setShowPay(false);
      fetchAll();
      onDone?.();
      handlePrintFinalBill();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to process payment and delivery");
    }
  };

  const handlePayHerePayment = async () => {
    try {
      const res = await api.get(`/payments/hash?order_id=${invoice.id}&amount=${invoice.total_amount}`);
      const hashData = res.data;

      const payment = {
        sandbox: true,
        merchant_id: hashData.merchant_id,
        return_url: window.location.origin,
        cancel_url: window.location.origin,
        notify_url: "https://sandbox.payhere.lk", // dummy for frontend
        order_id: hashData.order_id,
        items: `ServiceSync Invoice ${job.job_id}`,
        amount: hashData.amount,
        currency: hashData.currency,
        hash: hashData.hash,
        first_name: job.customer_name || "Customer",
        last_name: "",
        email: "customer@servicesync.lk",
        phone: job.customer_phone || "",
        address: "Sri Lanka",
        city: "Colombo",
        country: "Sri Lanka",
      };

      window.payhere.onCompleted = async function onCompleted(orderId) {
        alert("Payment Success via PayHere!");
        
        // Since we are running locally, the PayHere webhook cannot reach localhost.
        // We manually trigger the payment success API call here.
        try {
          await api.patch(`/invoices/${invoice.id}/pay`, { payment_method: "payhere", payment_reference: orderId });
          if (job.status !== "delivered") {
             await api.patch(`/jobs/${jobId}/status`, { status: "delivered", notes: "Automatically marked as delivered upon PayHere payment." });
          }
        } catch (err) {
          console.error("Failed to update status locally", err);
        }

        setShowPay(false);
        fetchAll();
        onDone?.();
        handlePrintFinalBill();
      };
      window.payhere.onDismissed = function onDismissed() {};
      window.payhere.onError = function onError(error) {
        alert("Payment Error: " + error);
      };

      window.payhere.startPayment(payment);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to initiate PayHere payment");
    }
  };

  const [sendingSms, setSendingSms] = useState(false);
  const handleSendSmsLink = async () => {
    try {
      setSendingSms(true);
      const formData = new FormData();
      formData.append("order_id", invoice.id);
      formData.append("phone_number", job.customer_phone || "");
      const res = await api.post(`/payments/send-link`, formData);
      alert(res.data.message + "\\n\\nPreview:\\n" + res.data.preview);
      setShowPay(false);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to send SMS link");
    } finally {
      setSendingSms(false);
    }
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!newStatus) return;
    setSavingStatus(true);
    try {
      await api.patch(`/jobs/${jobId}/status`, { status: newStatus, notes: statusNotes });
      setNewStatus("");
      setStatusNotes("");
      fetchAll();
      onDone?.();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update status");
    } finally {
      setSavingStatus(false);
    }
  };

  const partsTotal = parts.reduce((acc, p) => acc + (Number(p.unit_price) * p.quantity), 0);
  const partsTotalCost = parts.reduce((acc, p) => acc + ((Number(p.unit_cost) || 0) * (p.quantity || 1)), 0);
  const baseSub = partsTotal + (Number(laborCost) || 0);
  
  let discountAmt = 0;
  let discountCapped = false;
  let minMarginPct = 0;
  let absoluteMinTotal = 0;
  let rawDiscountAmt = 0;

  if (promoSetting && job) {
    try {
      const promo = JSON.parse(promoSetting);
      if (promo.active && promo.offers && promo.offers[job.fault_category]) {
         const offer = promo.offers[job.fault_category];
         if (offer.type === "fixed") {
            rawDiscountAmt = Number(offer.value);
         } else if (offer.type === "percentage") {
            rawDiscountAmt = baseSub * (Number(offer.value) / 100);
         }
         discountAmt = rawDiscountAmt;

         minMarginPct = Number(promo.min_margin_percent || 0);
         if (minMarginPct > 0) {
            absoluteMinTotal = partsTotalCost + (partsTotalCost * (minMarginPct / 100));
            
            let proposedTotal = baseSub - discountAmt;
            if (proposedTotal < absoluteMinTotal) {
                const maxAllowedDiscount = baseSub - absoluteMinTotal;
                discountAmt = Math.max(0, maxAllowedDiscount);
                if (maxAllowedDiscount < rawDiscountAmt) {
                    discountCapped = true;
                }
            }
         }
      }
    } catch(e) {}
  }
  const total = Math.max(0, baseSub - discountAmt);
  const currentProfit = total - partsTotalCost;
  const isLosingMoney = currentProfit < 0;

  if (!job && !loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Job not found.</p>
          <button onClick={onClose} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">Close</button>
        </div>
      </div>
    );
  }


  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
      <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto relative">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Job Detail & Management</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Job ID: {job?.job_id || "Loading..."}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-3xl leading-none">&times;</button>
        </div>

        <div className="p-8 space-y-6">
          {loading ? (
            <div className="text-center text-gray-400 text-sm py-20">Loading job details…</div>
          ) : (
            <>

      {job.revert_requested_to && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-amber-800 font-bold flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                Revert Request Pending
              </h3>
              <p className="text-amber-700 text-sm mt-1">
                Technician requested to revert the status back to <b>{job.revert_requested_to.replace(/_/g, " ")}</b>.
              </p>
              {job.revert_reason && (
                <p className="text-amber-700 text-sm italic mt-1 bg-amber-100/50 p-2 rounded w-fit">"{job.revert_reason}"</p>
              )}
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleRejectRevert}
                disabled={processingRevert}
                className="bg-white dark:bg-gray-800 text-amber-700 border border-amber-300 hover:bg-amber-100 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
              >
                Reject
              </button>
              <button 
                onClick={handleApproveRevert}
                disabled={processingRevert}
                className="bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
              >
                Approve Revert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warranty Rework Banner if this job is a warranty claim */}
      {job.rework_of_job_id && (
        <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-purple-900 dark:text-purple-200 font-bold text-sm">
              Warranty Claim / Free Rework Job
            </h3>
            <p className="text-purple-700 dark:text-purple-300 text-xs mt-0.5">
              This repair is a free warranty claim linked to an original repair job.
            </p>
          </div>
          <span className="text-xs bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200 font-mono font-bold px-3 py-1 rounded-lg">
            Free Warranty
          </span>
        </div>
      )}

      {/* Job Header - Full Width */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5 md:p-6 border border-gray-100 dark:border-gray-700/50 mb-6">
            <div className="flex items-start justify-between flex-wrap gap-4 border-b border-gray-100 dark:border-gray-700/50 pb-4">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-1">Job ID</p>
                <div className="flex items-center gap-3">
                  <p className="text-3xl font-bold font-mono text-gray-900 dark:text-white tracking-tight">{job.job_id}</p>
                  {job.rework_of_job_id && (
                    <span className="bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1 rounded-full border border-purple-200">
                      Warranty Rework
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <JobStatusBadge status={job.status} />
                {(job.status === "completed" || job.status === "delivered") && (
                  <button
                    type="button"
                    onClick={openWarrantyModal}
                    className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-sm font-semibold px-4 py-1.5 rounded-full shadow-sm transition-colors"
                    title="Create a free Warranty Claim / Rework Job for this customer"
                  >
                    Claim Warranty
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-y-4 gap-x-6 mt-4 text-sm">
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Customer</p>
                <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{job.customer_name}</p>
                <p className="text-gray-500 dark:text-gray-400 font-medium text-[11px]">{job.customer_phone}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Device</p>
                <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{job.device_brand} {job.device_model}</p>
                {job.device_imei && <p className="text-gray-500 dark:text-gray-400 font-mono text-[11px] mt-0.5">IMEI: {job.device_imei}</p>}
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Technician</p>
                <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{job.technician_name || "Unassigned"}</p>
                {job.estimated_completion_date && (
                  <p className="text-gray-500 dark:text-gray-400 font-medium text-[11px]">Est. {new Date(job.estimated_completion_date).toLocaleDateString("en-LK")}</p>
                )}
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Fault</p>
                <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm capitalize">{job.fault_category?.replace(/_/g, " ")}</p>
                {job.fault_description && <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 truncate" title={job.fault_description}>{job.fault_description}</p>}
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Estimated Cost</p>
                <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">
                  {job.estimated_cost != null ? `LKR ${Number(job.estimated_cost).toLocaleString()}` : "Not quoted"}
                </p>
                <p className="text-gray-500 dark:text-gray-400 font-medium text-[11px]">{job.investigated ? "Investigated" : "Not investigated"}</p>
              </div>
            </div>

            {/* Physical Condition & Photos */}
            {(job.physical_condition || (job.images && job.images.length > 0)) && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                {job.physical_condition && (
                  <div className="mb-2">
                    <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Physical Condition</p>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{job.physical_condition}</p>
                  </div>
                )}
                {job.images && job.images.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-3">Condition Photos</p>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                      {job.images.map((img) => (
                        <a key={img.id} href={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}${img.file_path}`} target="_blank" rel="noreferrer" className="shrink-0">
                          <img src={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}${img.file_path}`} className="w-24 h-24 object-cover rounded-xl border border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity shadow-sm" alt="Condition" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
      
      {/* Horizontal Activity Timeline */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-7 border border-gray-100 dark:border-gray-700/50 overflow-hidden mb-8">
        <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-8 flex items-center gap-2 text-lg">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Activity Timeline
        </h3>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400">No history recorded</p>
        ) : (
          <div className="flex overflow-x-auto pb-4 pt-2 px-2 scrollbar-thin">
            {history.map((h, i) => {
              const style = HISTORY_STYLES[h.status] || HISTORY_STYLES.pending;
              
              return (
                <div key={h.id} className="relative min-w-[220px] pr-8 shrink-0 group">
                  {/* Connecting Line */}
                  {i !== history.length - 1 && (
                    <div className={`absolute top-5 left-10 w-[calc(100%-1rem)] h-[3px] rounded-full ${style.line} opacity-60 group-hover:opacity-100 transition-opacity`} />
                  )}
                  
                  {/* Node Icon */}
                  <div className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full mb-4 shadow-sm ring-4 ring-white dark:ring-gray-800 ${style.bg} ${style.color}`}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {style.icon}
                    </svg>
                  </div>
                  
                  {/* Content */}
                  <p className="text-sm font-bold text-gray-900 dark:text-white capitalize tracking-wide mb-1.5">{h.status.replace(/_/g, " ")}</p>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <svg className="w-3 h-3 text-gray-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                    </div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 truncate">{h.changed_by_name}</p>
                  </div>
                  
                  {h.notes && (
                    <div className="mb-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800 mr-2 shadow-sm">
                      <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-3" title={h.notes}>
                        {h.notes}
                      </p>
                    </div>
                  )}
                  
                  <p className="text-[11px] text-gray-400 mt-1 font-mono font-medium">
                    {h.created_at ? new Date(h.created_at).toLocaleString("en-LK", {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) : ""}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Parts Used (Full Width) */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-7 border border-gray-100 dark:border-gray-700/50 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg">Parts & Labor</h3>
            </div>

          {parts.length === 0 ? (
            <div className="py-10 text-center border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl">
              <p className="text-sm text-gray-400">No parts recorded for this job</p>
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    {["Part", "Source", "Batch", "Used By", "Qty", "Cost", "Price", "Subtotal"].map((h) => (
                      <th key={h} className="text-left pb-2 text-xs font-semibold text-gray-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {parts.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 font-medium text-gray-800 dark:text-gray-100">{p.part_name || "—"}</td>
                      <td className="py-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${p.part_source === "inventory" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                          {p.part_source}
                        </span>
                      </td>
                      <td className="py-2.5 text-gray-500 dark:text-gray-400 font-mono text-xs">{p.batch_code || "—"}{p.supplier ? <span className="block text-gray-400">{p.supplier}</span> : null}</td>
                      <td className="py-2.5 text-gray-600 dark:text-gray-300">{p.used_by_name || "—"}</td>
                      <td className="py-2.5 text-gray-600 dark:text-gray-300">{p.quantity}</td>
                      <td className="py-2.5 text-gray-500 dark:text-gray-400 line-through text-xs">LKR {Number(p.unit_cost).toLocaleString()}</td>
                      <td className="py-2.5 text-gray-800 dark:text-gray-100 font-medium">LKR {Number(p.unit_price).toLocaleString()}</td>
                      <td className="py-2.5 font-bold text-gray-800 dark:text-gray-100">LKR {(Number(p.unit_price) * p.quantity).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                <p className="text-base font-bold text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-700/50 px-4 py-2 rounded-lg">Parts Total: LKR {partsTotal.toLocaleString()}</p>
              </div>
            </>
          )}
        </div>

      {/* Grid for Status and Invoice (Side-by-Side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Status Update Form */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700/50">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-5 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Update Status
            </h3>
            {job.status === "pending" || job.status === "in_progress" ? (
              <div className="bg-amber-50 text-amber-800 text-sm p-4 rounded-lg">
                This job is currently <strong>{job.status.replace("_", " ")}</strong>. Admins cannot update its status to Ready or Delivered until the technician marks it as Completed.
              </div>
            ) : (
              <form onSubmit={handleUpdateStatus} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">New Status</label>
                  <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} required
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="" disabled>— Select Status —</option>
                    {[
                      { value: "ready_for_pickup", label: "Ready for Pickup", order: 3 },
                      { value: "delivered",        label: "Delivered",        order: 4 },
                      { value: "unclaimed",        label: "Unclaimed",        order: 4 }
                    ].map((s) => {
                      const currentOrder = { completed: 2, ready_for_pickup: 3, delivered: 4, unclaimed: 4 }[job.status] || 0;
                      let isOptionDisabled = s.order <= currentOrder;
                      
                      // Allow switching between delivered and unclaimed
                      if ((job.status === "delivered" && s.value === "unclaimed") || 
                          (job.status === "unclaimed" && s.value === "delivered")) {
                        isOptionDisabled = false;
                      }

                      if (s.value === "delivered") {
                        const isPaid = invoice && invoice.payment_status === "paid";
                        if (!isPaid) {
                          isOptionDisabled = true;
                        }
                      }
                      return (
                        <option key={s.value} value={s.value} disabled={isOptionDisabled}>
                          {s.label} {s.value === "delivered" && !isOptionDisabled ? "" : (s.value === "delivered" ? "(Requires Payment)" : "")}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Notes (optional)</label>
                  <textarea value={statusNotes} onChange={(e) => setStatusNotes(e.target.value)} rows={2}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition-shadow bg-gray-50 dark:bg-gray-900/50"
                    placeholder="Reason for change..." />
                </div>
                <button type="submit" disabled={savingStatus || !newStatus}
                  className="w-full bg-gray-900 dark:bg-gray-700 hover:bg-black dark:hover:bg-gray-600 disabled:bg-gray-400 text-white py-2.5 px-4 rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center justify-center gap-2">
                  {savingStatus ? "Updating…" : "Update Status"}
                </button>
              </form>
            )}
          </div>

          {/* Modern Invoice Card */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-6 border border-gray-100 dark:border-gray-700/50 relative overflow-hidden shadow-sm">
            {invoice ? (
               <div className={`absolute top-0 left-0 w-full h-1.5 ${invoice.payment_status === 'paid' ? 'bg-green-500' : 'bg-blue-500'}`} />
            ) : null}

            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-5 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Payment Summary
            </h3>
            
            {!invoice ? (
              <div className="space-y-4 text-center py-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">No invoice has been generated for this job yet.</p>
                <button
                  onClick={() => { setInvError(""); setLaborCost(job.labor_cost || ""); setShowInvoice(true); }}
                  disabled={job.status !== "ready_for_pickup"}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:dark:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-bold py-2.5 px-4 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                  Generate Invoice
                </button>
              </div>
            ) : (
              <div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-300">
                    <span>Subtotal</span>
                    <span className="font-medium text-gray-900 dark:text-white">LKR {Number(invoice.subtotal).toLocaleString()}</span>
                  </div>
                  
                  {Number(invoice.discount_amount) > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-green-600 dark:text-green-400 flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                        Discount applied
                      </span>
                      <span className="font-bold text-green-600 dark:text-green-400">- LKR {Number(invoice.discount_amount).toLocaleString()}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-300">
                    <span>Tax</span>
                    <span className="font-medium text-gray-900 dark:text-white">LKR {Number(invoice.tax_amount).toLocaleString()}</span>
                  </div>
                </div>

                <div className="my-5 border-t border-dashed border-gray-300 dark:border-gray-600" />
                
                <div className="flex justify-between items-end mb-6">
                  <span className="text-base font-semibold text-gray-900 dark:text-white">Total Due</span>
                  <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 tracking-tight">LKR {Number(invoice.total_amount).toLocaleString()}</span>
                </div>

                {invoice.payment_status === "paid" ? (
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3.5 flex items-center justify-between border border-green-100 dark:border-green-800/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-800/50 flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <div>
                        <p className="text-sm font-extrabold text-green-800 dark:text-green-400 leading-tight">Paid in Full</p>
                        <p className="text-xs font-medium text-green-600 dark:text-green-500 uppercase tracking-wide mt-0.5">via {invoice.payment_method}</p>
                      </div>
                    </div>
                    <button onClick={handlePrintFinalBill} className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                      Receipt
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setPayMethod("cash"); setShowPay(true); }}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-sm transition-all hover:shadow-md transform hover:-translate-y-0.5"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                    Process Payment
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

      {/* Add Part Modal */}
      <Modal open={showPart} onClose={() => setShowPart(false)} title="Add Part to Job">
        <form onSubmit={handleAddPart} className="space-y-4">
          {partError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{partError}</div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Part Source</label>
            <select value={partSource} onChange={(e) => { setPartSource(e.target.value); setSelectedItem(""); }}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="inventory">Inventory Stock</option>
              <option value="donor">Donor Part</option>
            </select>
          </div>

          {partSource === "inventory" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Select Part *</label>
                <select required value={selectedItem} onChange={(e) => {
                  setSelectedItem(e.target.value);
                  setSelectedBatchId("");
                  const item = invItems.find((i) => i.id === e.target.value);
                  if (item) {
                    setOverridePrice(item.unit_price?.toString() || "");
                    // If batches are available in the response, get the cost of the oldest available batch
                    // Currently invItems list may not have full batch data, so we can display what's known or leave it empty if not.
                    if (item.batches && item.batches.length > 0) {
                       setActualCost(item.batches.filter(b => b.quantity_remaining > 0)[0]?.unit_cost || item.batches[item.batches.length-1].unit_cost);
                    } else {
                       setActualCost("Hidden (Load from oldest batch)");
                    }
                  }
                }}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Select inventory item —</option>
                  {invItems.map((i) => (
                    <option key={i.id} value={i.id}>{i.sku ? `${i.sku} · ` : ""}{i.name} (Stock: {i.quantity})</option>
                  ))}
                </select>
                {selectedItem && (() => {
                  const item = invItems.find((i) => i.id === selectedItem);
                  if (item && item.batches && item.batches.length > 0) {
                    return (
                      <div className="mt-3">
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Select Specific Batch (Optional)</label>
                        <select value={selectedBatchId} onChange={(e) => {
                          const bid = e.target.value;
                          setSelectedBatchId(bid);
                          if (bid) {
                            const b = item.batches.find(b => b.id === bid);
                            if (b) setActualCost(b.unit_cost);
                          } else {
                            setActualCost(item.batches.filter(b => b.quantity_remaining > 0)[0]?.unit_cost || item.batches[item.batches.length-1].unit_cost);
                          }
                        }}
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="">Auto-Select (Oldest First)</option>
                          {item.batches.filter(b => b.quantity_remaining > 0).map(b => (
                            <option key={b.id} value={b.id}>{b.batch_code} — LKR {b.unit_cost} ({b.quantity_remaining} left)</option>
                          ))}
                        </select>
                      </div>
                    );
                  }
                  return null;
                })()}
                {selectedItem && (
                   <p className="text-xs text-orange-600 mt-1 font-medium">Est. Unit Cost: {actualCost === "Hidden (Load from oldest batch)" ? actualCost : `LKR ${actualCost}`}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Final Selling Price (LKR) *</label>
                <input type="number" step="0.01" min="0" required value={overridePrice} onChange={(e) => setOverridePrice(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50" />
                <p className="text-xs text-gray-400 mt-1">Lower this value to give the customer a discount.</p>
              </div>
            </>
          )}

          {partSource === "donor" && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Donor Part ID</label>
              <input value={selectedItem} onChange={(e) => setSelectedItem(e.target.value)}
                placeholder="Paste donor part UUID"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Quantity *</label>
              <input type="number" min="1" required value={quantity} onChange={(e) => setQuantity(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {partSource === "donor" && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Unit Cost (LKR) *</label>
                <input type="number" min="0" step="0.01" required value={unitCost} onChange={(e) => setUnitCost(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00" />
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setShowPart(false)}
              className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
              Cancel
            </button>
            <button type="submit" disabled={savingPart}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded-lg text-sm font-semibold">
              {savingPart ? "Adding…" : "Add Part"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Generate Invoice Modal */}
      <Modal open={showInvoice} onClose={() => setShowInvoice(false)} title="Generate Invoice">
        <form onSubmit={handleCreateInvoice} className="space-y-4">
          {invError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{invError}</div>
          )}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg px-4 py-2 text-sm text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
            Parts total: <strong>LKR {partsTotal.toLocaleString()}</strong>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Labor Cost (LKR)</label>
              <input type="number" min="0" step="0.01" value={laborCost} onChange={(e) => setLaborCost(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800"
                placeholder="0.00" />
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-sm space-y-2 border border-gray-100 dark:border-gray-800 shadow-inner">
            <div className="flex justify-between text-gray-600 dark:text-gray-300">
              <span>Subtotal</span>
              <span>LKR {baseSub.toLocaleString()}</span>
            </div>
            
            <div className={`flex justify-between font-medium ${discountAmt > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500 text-xs'}`}>
              <span className="flex items-center gap-1">
                Seasonal Discount
                {discountAmt === 0 && !discountCapped && <span className="text-[10px] font-normal italic">(No active promo for this job)</span>}
                {discountCapped && <span className="text-[10px] text-orange-500 font-normal italic" title="Discount was limited to protect minimum profit margin.">(Capped by Margin Protection)</span>}
              </span>
              <span>- LKR {discountAmt.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>

            <div className="flex justify-between font-bold text-gray-800 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700 pt-2 mt-2 text-base">
              <span>Final Total</span><span>LKR {total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
          </div>
          
          {/* Admin Insights: Margin Breakdown */}
          <div className="bg-orange-50/50 dark:bg-orange-900/10 border border-orange-200/60 dark:border-orange-800/50 rounded-lg p-3 text-xs space-y-1.5">
            <div className="flex justify-between items-center text-orange-800 dark:text-orange-300 font-semibold mb-1">
               <span className="flex items-center gap-1">🛡️ Admin Margin Protection</span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
               <span>Total Parts Cost (Buying Price)</span>
               <span>LKR {partsTotalCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
               <span>Required Minimum Margin</span>
               <span>{minMarginPct}% (LKR {(absoluteMinTotal - partsTotalCost).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})})</span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
               <span>Absolute Minimum Selling Price</span>
               <span>LKR {absoluteMinTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
            {discountCapped && (
               <div className="flex justify-between text-red-600 dark:text-red-400 font-medium mt-1 pt-1 border-t border-orange-200 dark:border-orange-800/50">
                 <span>Original Discount (Blocked)</span>
                 <span>LKR {rawDiscountAmt.toLocaleString()}</span>
               </div>
            )}
            <div className="flex justify-between text-blue-700 dark:text-blue-400 font-bold mt-1 pt-1 border-t border-orange-200 dark:border-orange-800/50">
               <span>Current Invoice Profit</span>
               <span className={isLosingMoney ? "text-red-600" : "text-blue-700"}>LKR {currentProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowInvoice(false)}
              className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
              Cancel
            </button>
            <button type="submit" disabled={savingInv}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded-lg text-sm font-semibold">
              {savingInv ? "Generating…" : "Generate Invoice"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Mark Paid Modal */}
      <Modal open={showPay} onClose={() => setShowPay(false)} title="Confirm Payment & Deliver">
        <form onSubmit={handleMarkPaid} className="space-y-4">
          <div className="bg-green-50 text-green-800 text-xs px-3 py-2 rounded-lg border border-green-200">
            This will mark the invoice as paid, change the job status to <strong>Delivered</strong>, and generate the final bill printout.
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Total Due: <strong className="text-lg text-gray-800 dark:text-gray-100">LKR {Number(invoice?.total_amount || 0).toLocaleString()}</strong>
          </p>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Payment Method</label>
            <select value={payMethod} onChange={(e) => { setPayMethod(e.target.value); setPaymentRef(""); }}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="transfer">Bank Transfer</option>
              <option value="payhere">PayHere (Online/QR)</option>
            </select>
          </div>
          {payMethod === "transfer" && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Transaction Reference</label>
              <input type="text" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="e.g. 123456789 or Ref No"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          )}
          {payMethod === "card" && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Card Last 4 Digits / Auth Code</label>
              <input type="text" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="e.g. 1234 or Auth 5678"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          )}
          {payMethod === "payhere" && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl p-4 flex flex-col items-center justify-center gap-3">
              <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-300 text-center">Scan to Pay on Mobile</p>
              {qrCodeUrl ? (
                <div className="bg-white p-2 rounded-xl shadow-sm border border-indigo-100">
                   <img src={qrCodeUrl} alt="Payment QR" className="w-32 h-32 object-contain" />
                </div>
              ) : (
                <div className="w-32 h-32 bg-white flex items-center justify-center rounded-xl border border-indigo-100"><span className="text-xs text-gray-400">Loading QR...</span></div>
              )}
              <p className="text-xs text-indigo-700 dark:text-indigo-400 text-center px-4">Customer can scan this QR with their camera to securely pay on their own device.</p>
              
              <a href={`/pay/${invoice.id}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-full border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer">
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  Test Mode: Open Customer Link
                </span>
              </a>
            </div>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowPay(false)}
              className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
              Cancel
            </button>
            {payMethod === "payhere" ? (
              <>
                <button type="button" onClick={handleSendSmsLink} disabled={sendingSms}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-semibold">
                  {sendingSms ? "Sending..." : "Send SMS Link"}
                </button>
                <button type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-semibold">
                  Show PayHere Screen
                </button>
              </>
            ) : (
              <button type="submit"
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-semibold">
                Pay & Deliver
              </button>
            )}
          </div>
        </form>
      </Modal>

      {/* Create Warranty Claim Modal */}
      <Modal open={showWarrantyModal} onClose={() => setShowWarrantyModal(false)} title="Create Customer Warranty Claim (Rework)">
        <form onSubmit={handleCreateWarrantyClaim} className="space-y-4">
          <div className="bg-purple-50 dark:bg-purple-950/40 p-3 rounded-xl border border-purple-200 dark:border-purple-800 text-xs text-purple-900 dark:text-purple-200">
            <p className="font-bold mb-0.5">Free Guarantee Repair for Job #{job?.job_id}</p>
            <p>Customer: <strong>{job?.customer_name}</strong> ({job?.device_brand} {job?.device_model})</p>
          </div>

          {warrantyError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs font-medium">
              {warrantyError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
              New Issue / Claim Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={warrantyFault}
              onChange={(e) => setWarrantyFault(e.target.value)}
              placeholder="Describe the defect or reason for warranty claim (e.g. Touch stopped working after 2 days)..."
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
              Assign Technician for Warranty Repair
            </label>
            <select
              value={warrantyTechId}
              onChange={(e) => setWarrantyTechId(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">-- Assign Later --</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
              Additional Internal Notes (Optional)
            </label>
            <input
              type="text"
              value={warrantyNotes}
              onChange={(e) => setWarrantyNotes(e.target.value)}
              placeholder="e.g. Free replacement under 30-day screen warranty"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowWarrantyModal(false)}
              className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingWarranty}
              className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white py-2 rounded-lg text-sm font-semibold shadow-sm"
            >
              {savingWarranty ? "Registering Claim…" : "Register Warranty Job"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )}
</div>
</div>
</div>
);
}
