const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'admin', 'BookingManager.jsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Remove firebase imports
code = code.replace(/import\s*\{[^}]*\}\s*from\s*"firebase\/firestore";?/g, '');
code = code.replace(/import\s*\{\s*db\s*\}\s*from\s*"..\/firebase";?/g, '');
code = code.replace(/import\s*\{\s*useOfflineSync\s*\}\s*from\s*"..\/hooks\/useOfflineSync";?/g, '');

// 2. Fix the component hook
code = code.replace(/const\s*\{\s*wrapSync\s*\}\s*=\s*useOfflineSync\(\);/g, '');

// 3. Replace the bookings fetch useEffect
code = code.replace(/useEffect\(\(\)\s*=>\s*\{\s*const\s*q\s*=\s*query\(collection\(db,\s*"bookings"\),\s*orderBy\("createdAt",\s*"desc"\)\);[\s\S]*?return\s*\(\)\s*=>\s*unsub\(\);\s*\},\s*\[\]\);/g, `useEffect(() => {
    async function loadBookings() {
      try {
        const res = await fetch("/api/bookings");
        if (res.ok) setBookings(await res.json());
      } catch (err) {
        console.error("Bookings load error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadBookings();
  }, []);`);

// 4. Replace the payments fetch useEffect
code = code.replace(/useEffect\(\(\)\s*=>\s*\{\s*if\s*\(!selected\)\s*\{[\s\S]*?setLinkedPayment\(null\);\s*setZoomImage\(null\);[\s\S]*?return\s*\(\)\s*=>\s*unsub\(\);\s*\},\s*\[selected\]\);/g, `useEffect(() => {
    if (!selected) {
      setLinkedPayment(null);
      setZoomImage(null);
      setRejectReasonModal({ open: false, reason: "" });
      return;
    }
    setLinkedPayment(null); // Disabled payments
  }, [selected]);`);

// 5. Replace savePaidAmount
code = code.replace(/async\s*function\s*savePaidAmount\(\)\s*\{[\s\S]*?finally\s*\{\s*setSavingPaid\(false\);\s*\}\s*\}/g, `async function savePaidAmount() {
    if (!selected) return;
    const paid = roundMoney(parseCashAmount(paidEditDraft));
    if (!Number.isFinite(paid) || paid < 0) {
      toast.error("Enter a valid amount received.");
      return;
    }

    let { total } = resolveBookingTotals(selected, linkedPayment);
    if (total <= 0 && paid > 0) total = paid;
    if (total <= 0) {
      toast.error("Set court pricing or payment total before recording amount paid.");
      return;
    }
    if (paid > total) {
      toast.error("Amount paid cannot exceed the booking total.");
      return;
    }

    const remaining = roundMoney(Math.max(0, total - paid));
    const payStatus = resolveCustomerPayStatus(
      selected.paymentPlan || PLAN_FULL,
      total,
      paid
    );

    setSavingPaid(true);
    try {
      const res = await fetch(\`/api/bookings/\${selected.id}\`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          total_amount: total,
          amount_paid: paid,
          remaining_balance: remaining,
          customer_payment_status: payStatus,
        })
      });
      if (!res.ok) throw new Error("Failed to save");

      toast.success("Payment amount saved.");
      setSelected((s) => s && s.id === selected.id ? { ...s, totalAmount: total, amountPaid: paid, remainingBalance: remaining, customerPaymentStatus: payStatus } : s);
      setPaidEditDraft(paid.toFixed(2));
    } catch (e) {
      console.error(e);
      toast.error("Could not save payment amount.");
    } finally {
      setSavingPaid(false);
    }
  }`);

// 6. Replace saveAction (accept/reject)
code = code.replace(/async\s*function\s*saveAction\(st,\s*notes,\s*sendSMS\s*=\s*false,\s*rejectReason\s*=\s*""\)\s*\{[\s\S]*?catch\s*\(err\)\s*\{[\s\S]*?\}\s*finally\s*\{[\s\S]*?\}\s*\}/g, `async function saveAction(st, notes, sendSMS = false, rejectReason = "") {
    if (!acting) return;
    setExtending(true);
    try {
      const payload = { status: st };
      if (notes) payload.notes = notes;
      
      const res = await fetch(\`/api/bookings/\${acting.id}\`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error("Failed to save");
      
      toast.success(\`Booking \${st.toLowerCase()}\`);
      setActing(null);
      setRejectReasonModal({ open: false, reason: "" });
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status");
    } finally {
      setExtending(false);
    }
  }`);

// 7. Replace deleteBooking
code = code.replace(/async\s*function\s*deleteBooking\(\)\s*\{[\s\S]*?catch\s*\(e\)\s*\{[\s\S]*?\}\s*finally\s*\{[\s\S]*?\}\s*\}/g, `async function deleteBooking() {
    if (!selected) return;
    if (!window.confirm("Are you sure you want to permanently delete this booking?")) return;
    setExtending(true);
    try {
      const res = await fetch(\`/api/bookings/\${selected.id}\`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Booking deleted.");
      setSelected(null);
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete booking.");
    } finally {
      setExtending(false);
    }
  }`);

fs.writeFileSync(filePath, code);
console.log('BookingManager migrated to PG API calls.');
