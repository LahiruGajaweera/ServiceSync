import { useState, useEffect } from "react";
import api from "../../services/api";

export default function DirectSale() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [cart, setCart] = useState([]);
  const [buyerName, setBuyerName] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      const { data } = await api.get('/inventory/', { params: { search: searchQuery } });
      setSearchResults(data);
    } catch (err) {
      console.error(err);
    }
  };

  const addToCart = async (item) => {
    if (item.track_serial) {
      // Prompt for serial number or fetch available serials
      const sn = prompt("Please enter or scan the Serial Number for: " + item.name);
      if (!sn) return;
      try {
        const { data } = await api.get(`/inventory/${item.id}/batches`);
        const allUnits = data.flatMap(b => b.units || []);
        const unit = allUnits.find(u => u.serial_number === sn && u.status === "in_stock");
        if (!unit) {
          alert("Error: Serial number not found or not in stock!");
          return;
        }
        setCart([...cart, { ...item, qty: 1, serial_number: sn, unit_id: unit.id, unit_price: item.unit_price }]);
      } catch (err) {
        console.error(err);
        alert("Failed to verify serial number.");
      }
    } else {
      const existing = cart.find(c => c.id === item.id);
      if (existing) {
        if (existing.qty + 1 > item.quantity) {
           alert("Not enough stock!");
           return;
        }
        setCart(cart.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c));
      } else {
        if (item.quantity < 1) {
           alert("Out of stock!");
           return;
        }
        setCart([...cart, { ...item, qty: 1, unit_price: item.unit_price }]);
      }
    }
  };

  const removeFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const updateCartQty = (index, delta) => {
    setCart(cart.map((c, i) => {
      if (i === index) {
        if (c.track_serial) return c; // Cannot change qty of serial item
        const newQty = c.qty + delta;
        if (newQty < 1) return c;
        if (newQty > c.quantity) {
          alert("Not enough stock!");
          return c;
        }
        return { ...c, qty: newQty };
      }
      return c;
    }));
  };

  const subtotal = cart.reduce((sum, item) => sum + (parseFloat(item.unit_price) * item.qty), 0);
  const total = Math.max(0, subtotal - (parseFloat(discountAmount) || 0));

  const completeSale = async () => {
    if (!buyerName.trim()) {
      alert("Please enter a Shop/Buyer Name.");
      return;
    }
    if (cart.length === 0) {
      alert("Cart is empty!");
      return;
    }
    setProcessing(true);
    setSuccessMsg("");
    try {
      const payload = {
        buyer_name: buyerName,
        discount_amount: parseFloat(discountAmount) || 0,
        items: cart.map(c => ({
          inventory_item_id: c.id,
          inventory_unit_id: c.unit_id || null,
          quantity: c.qty,
          unit_price: parseFloat(c.unit_price)
        }))
      };
      await api.post("/direct-sales/", payload);
      setSuccessMsg(`Sale to ${buyerName} completed successfully!`);
      setCart([]);
      setBuyerName("");
      setDiscountAmount("");
      setSearchResults([]);
      setSearchQuery("");
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Error completing sale");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-6 text-gray-800 dark:text-gray-100 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">POS / Direct Sale</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Sell parts directly to other shops</p>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-100 border border-emerald-400 text-emerald-700 px-4 py-3 rounded relative mb-4">
          <span className="block sm:inline">{successMsg}</span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Side: Search & Inventory */}
        <div className="w-full lg:w-2/3 bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          <form onSubmit={handleSearch} className="flex gap-2 mb-6">
            <input 
              type="text" 
              placeholder="Search parts by name or SKU..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition">Search</button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto pr-2">
            {searchResults.map(item => (
              <div key={item.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col justify-between hover:border-blue-500 transition-colors">
                <div>
                  <h3 className="font-semibold text-sm truncate" title={item.name}>{item.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">SKU: {item.sku}</p>
                  <p className="text-xs text-gray-500 mb-2">Stock: {item.quantity}</p>
                </div>
                <div className="flex justify-between items-center mt-4">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">LKR {item.unit_price}</span>
                  <button onClick={() => addToCart(item)} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded text-sm font-semibold transition">Add</button>
                </div>
              </div>
            ))}
            {searchResults.length === 0 && searchQuery && (
              <p className="text-gray-500 col-span-3 text-center py-10">No items found.</p>
            )}
          </div>
        </div>

        {/* Right Side: Cart */}
        <div className="w-full lg:w-1/3 bg-white dark:bg-gray-800 rounded-xl shadow p-6 flex flex-col">
          <h2 className="text-lg font-bold mb-4">Current Order</h2>
          
          <div className="flex-1 overflow-y-auto mb-4 border-b border-gray-200 dark:border-gray-700 min-h-[300px]">
            {cart.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-10">Cart is empty</p>
            ) : (
              <ul className="space-y-4 pr-2">
                {cart.map((c, idx) => (
                  <li key={idx} className="flex justify-between items-start text-sm bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
                    <div className="flex-1 pr-2">
                      <p className="font-semibold">{c.name}</p>
                      {c.track_serial && <p className="text-xs text-blue-500">SN: {c.serial_number}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        {!c.track_serial && (
                          <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded">
                            <button onClick={() => updateCartQty(idx, -1)} className="px-2 py-0.5 hover:bg-gray-200 dark:hover:bg-gray-700">-</button>
                            <span className="px-2 font-mono">{c.qty}</span>
                            <button onClick={() => updateCartQty(idx, 1)} className="px-2 py-0.5 hover:bg-gray-200 dark:hover:bg-gray-700">+</button>
                          </div>
                        )}
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold ml-auto">LKR {c.unit_price * c.qty}</span>
                      </div>
                    </div>
                    <button onClick={() => removeFromCart(idx)} className="text-red-500 hover:text-red-700 ml-2 mt-1">✕</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Shop / Buyer Name *</label>
              <input type="text" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="e.g. ABC Mobiles" className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Discount (LKR)</label>
              <input type="number" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            </div>
            
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                <span>LKR {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Discount</span>
                <span className="text-red-500">- LKR {(parseFloat(discountAmount) || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-emerald-600 dark:text-emerald-400">LKR {total.toFixed(2)}</span>
              </div>
            </div>

            <button onClick={completeSale} disabled={processing || cart.length === 0 || !buyerName} className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white py-3 rounded-lg font-bold text-lg shadow transition-colors">
              {processing ? "Processing..." : "Complete Sale"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
