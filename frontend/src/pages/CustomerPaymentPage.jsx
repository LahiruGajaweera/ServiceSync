import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import { CreditCard, CheckCircle2, AlertCircle, Phone, Smartphone } from "lucide-react";

export default function CustomerPaymentPage() {
  const { invoiceId } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchInvoice();
  }, [invoiceId]);

  const fetchInvoice = async () => {
    try {
      const res = await api.get(`/payments/invoice/${invoiceId}`);
      setInvoice(res.data);
    } catch (err) {
      setError("Failed to load invoice details. It may be invalid or expired.");
    } finally {
      setLoading(false);
    }
  };

  const handlePayNow = async () => {
    try {
      const res = await api.get(`/payments/hash?order_id=${invoiceId}&amount=${invoice.total_amount}`);
      const hashData = res.data;

      const payment = {
        sandbox: true,
        merchant_id: hashData.merchant_id,
        return_url: window.location.origin + `/pay/${invoiceId}`,
        cancel_url: window.location.origin + `/pay/${invoiceId}`,
        notify_url: "https://sandbox.payhere.lk",
        order_id: hashData.order_id,
        items: `ServiceSync Invoice for ${invoice.device}`,
        amount: hashData.amount,
        currency: hashData.currency,
        hash: hashData.hash,
        first_name: invoice.customer_name,
        last_name: "",
        email: "customer@servicesync.lk",
        phone: invoice.customer_phone,
        address: "Sri Lanka",
        city: "Colombo",
        country: "Sri Lanka",
      };

      window.payhere.onCompleted = function onCompleted(orderId) {
        alert("Payment completed successfully!");
        fetchInvoice(); // Reload to show paid status
      };

      window.payhere.onDismissed = function onDismissed() {
        console.log("Payment dismissed");
      };

      window.payhere.onError = function onError(error) {
        alert("Payment Error: " + error);
      };

      window.payhere.startPayment(payment);
    } catch (err) {
      alert("Failed to initiate payment. Please try again later.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-300">Loading invoice...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Error</h2>
          <p className="text-gray-600 dark:text-gray-300">{error}</p>
        </div>
      </div>
    );
  }

  const isPaid = invoice.payment_status === "paid";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4 font-sans">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 dark:border-gray-700">
        
        {/* Header */}
        <div className={`p-8 text-center text-white ${isPaid ? 'bg-green-600' : 'bg-indigo-600'}`}>
          {isPaid ? (
            <CheckCircle2 className="w-20 h-20 mx-auto mb-4 text-green-200" />
          ) : (
            <CreditCard className="w-20 h-20 mx-auto mb-4 text-indigo-200" />
          )}
          <h1 className="text-3xl font-bold mb-2">
            {isPaid ? "Payment Successful" : "Secure Payment"}
          </h1>
          <p className="text-white/80 font-medium">ServiceSync Job #{invoice.job_id}</p>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="space-y-6">
            
            {/* Amount */}
            <div className="text-center pb-6 border-b border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">Total Due</p>
              <div className="text-4xl font-extrabold text-gray-900 dark:text-white">
                LKR {Number(invoice.total_amount).toLocaleString()}
              </div>
            </div>

            {/* Details */}
            <div className="space-y-4">
              <div className="flex items-center text-gray-600 dark:text-gray-300">
                <Smartphone className="w-5 h-5 mr-3 text-indigo-500" />
                <span className="font-medium">{invoice.device}</span>
              </div>
              <div className="flex items-center text-gray-600 dark:text-gray-300">
                <Phone className="w-5 h-5 mr-3 text-indigo-500" />
                <span className="font-medium">{invoice.customer_phone || "N/A"}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-6">
              {isPaid ? (
                <div className="bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300 p-4 rounded-xl text-center font-medium">
                  This invoice has been fully paid. Your device is ready for collection or delivery.
                </div>
              ) : (
                <button
                  onClick={handlePayNow}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-bold py-4 rounded-xl shadow-lg transition-transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-6 h-6" />
                  Pay LKR {Number(invoice.total_amount).toLocaleString()}
                </button>
              )}
            </div>
            
          </div>
        </div>
        
        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 text-center border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-400 font-medium flex items-center justify-center gap-1">
            Secured by <img src="https://www.payhere.lk/downloads/images/payhere_short_banner.png" alt="PayHere" className="h-6 ml-1" />
          </p>
        </div>
        
      </div>
    </div>
  );
}
