// src/admin/BookingManager.jsx
import { useState, useEffect } from "react";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
} from "date-fns";


import { canExtendBooking } from "../lib/bookingSlots";
import { roundMoney, parseCashAmount } from "../lib/bookingMoney";
import {
  resolveCustomerPayStatus,
  resolveBookingTotals,
  PLAN_FULL,
} from "../lib/bookingPayment";
import toast from "react-hot-toast";

import ReceiptPrint from "../components/ReceiptPrint";
import { sendBookingSMS } from "../lib/smsService";
import { resolveBookingContactNumber } from "../lib/resolveContactNumber";

const STATUS_COLORS = { Pending: "pending", Approved: "approved", Cancelled: "rejected" };

const db = {};
const doc = (_db, collectionName, id) => ({ collectionName, id });
const collection = (_db, collectionName) => ({ collectionName });
const query = (collectionRef, ..._filters) => collectionRef;
const where = (field, _op, value) => ({ field, value });
const orderBy = (field, _direction) => ({ field });
const serverTimestamp = () => new Date();
const Timestamp = {
  now: () => new Date(),
  fromDate: (value) => new Date(value),
  fromMillis: (value) => new Date(value),
};
const getDoc = async (ref) => {
  if (!ref?.id) return { exists: () => false, data: () => ({}) };
  const path = ref.collectionName === "payments" ? "/api/payments" : "/api/bookings";
  const res = await fetch(`${path}/${encodeURIComponent(ref.id)}`);
  if (!res.ok) return { exists: () => false, data: () => ({}) };
  const data = await res.json();
  return { exists: () => true, data: () => data };
};
const getDocs = async (queryRef) => {
  const collectionName = queryRef?.collectionName;
  if (collectionName === "payments") {
    const filter = queryRef?.filters?.find((f) => f.field === "bookingId");
    const url = filter?.value ? `/api/payments?bookingId=${encodeURIComponent(filter.value)}` : "/api/payments";
    const res = await fetch(url);
    const rows = res.ok ? await res.json() : [];
    return {
      docs: rows.map((row) => ({
        id: row.id,
        data: () => row,
        ref: doc(db, "payments", row.id),
      })),
      size: rows.length,
      empty: rows.length === 0,
    };
  }
  const res = await fetch("/api/bookings");
  const rows = res.ok ? await res.json() : [];
  return { docs: rows.map((row) => ({ id: row.id, data: () => row, ref: doc(db, "bookings", row.id) })), size: rows.length, empty: rows.length === 0 };
};
const updateDoc = async (ref, data) => {
  const payload = Object.entries(data).reduce((acc, [k, v]) => {
    acc[k] = v;
    return acc;
  }, {});
  const res = await fetch(`/api/${ref.collectionName === "payments" ? "payments" : "bookings"}/${encodeURIComponent(ref.id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Update failed");
  return { id: ref.id };
};
const deleteDoc = async (ref) => {
  const path = ref.collectionName === "payments" ? "/api/payments" : "/api/bookings";
  const res = await fetch(`${path}/${encodeURIComponent(ref.id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Delete failed");
};
const writeBatch = () => {
  const ops = [];
  return {
    update(ref, data) { ops.push({ type: "update", ref, data }); },
    delete(ref) { ops.push({ type: "delete", ref }); },
    async commit() {
      for (const op of ops) {
        if (op.type === "delete") await deleteDoc(op.ref);
        else await updateDoc(op.ref, op.data);
      }
    },
  };
};
const addDoc = async (collectionRef, data) => {
  const res = await fetch(collectionRef.collectionName === "payments" ? "/api/payments" : "/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Create failed");
  const payload = await res.json().catch(() => ({}));
  return { id: payload.id || payload.bookingId || payload.paymentId || "" };
};
const PAY_STATUS_BADGE = { paid: "approved", partial: "pending", unpaid: "rejected" };

function deriveRemainingBalance(row) {
  const explicit = Number(row?.remainingBalance);
  if (Number.isFinite(explicit) && explicit >= 0) return roundMoney(explicit);
  const total = Number(row?.totalAmount) || 0;
  const paid = Number(row?.amountPaid) || 0;
  return roundMoney(Math.max(0, total - paid));
}

function deriveHourlyRate(row) {
  const explicit = Number(row?.hourlyRate);
  if (Number.isFinite(explicit) && explicit > 0) return roundMoney(explicit);
  const total = Number(row?.totalAmount) || 0;
  const duration = Number(row?.duration) || 1;
  if (total > 0 && duration > 0) return roundMoney(total / duration);
  return 0;
}

const EXTEND_OPTIONS = [1, 2, 3, 4, 5, 6];

/** Booking `date` is stored as yyyy-MM-dd; fall back to parsing slot time if needed. */
function bookingDayString(b, toMs) {
  const raw = String(b?.date || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const ms = toMs(b);
  if (!ms) return null;
  return format(new Date(ms), "yyyy-MM-dd");
}

function formatDateForDisplay(dateStr) {
  if (!dateStr) return "—";
  if (typeof dateStr === "string") {
    if (dateStr.includes("T")) {
      try { return format(new Date(dateStr), "MMM dd, yyyy"); } catch { return dateStr; }
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
       try { return format(new Date(dateStr + "T12:00:00"), "MMM dd, yyyy"); } catch { return dateStr; }
    }
  }
  return dateStr;
}

function formatDateForInput(dateStr) {
  if (!dateStr) return "";
  if (typeof dateStr === "string") {
    if (dateStr.includes("T")) {
      try { return format(new Date(dateStr), "yyyy-MM-dd"); } catch { return dateStr.split("T")[0]; }
    }
  }
  return dateStr;
}

function calculateEndTime(timeSlot, duration) {
  if (!timeSlot || !duration) return null;
  const match = String(timeSlot).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let [, hh, mm, ap] = match;
  hh = parseInt(hh, 10);
  mm = parseInt(mm, 10);
  if (ap.toUpperCase() === 'PM' && hh !== 12) hh += 12;
  if (ap.toUpperCase() === 'AM' && hh === 12) hh = 0;
  
  const totalMinutes = hh * 60 + mm + Math.round(Number(duration) * 60);
  const endH = Math.floor(totalMinutes / 60) % 24;
  const endM = totalMinutes % 60;
  const endAp = endH >= 12 ? 'PM' : 'AM';
  let dispH = endH % 12;
  if (dispH === 0) dispH = 12;
  return `${String(dispH).padStart(2, '0')}:${String(endM).padStart(2, '0')} ${endAp}`;
}

export default function BookingManager() {
  const wrapSync = async (p) => p;
  const EMPTY_BALANCE_MODAL = { open: false, booking: null, amount: "", method: "cash" };

  function openBalanceModal(booking) {
    const remaining = deriveRemainingBalance(booking);
    setBalanceModal({
      open: true,
      booking,
      amount: remaining > 0 ? String(remaining) : "",
      method: "cash",
    });
  }

  function closeBalanceModal() {
    setBalanceModal(EMPTY_BALANCE_MODAL);
  }

  async function settleBalance(booking, amount, method) {
    const nextAmount = roundMoney(Number(amount) || 0);
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    setActing(booking.id);
    try {
      const currentPaid = roundMoney(Number(booking.amountPaid) || 0);
      const currentTotal = roundMoney(Number(booking.totalAmount) || 0);
      const newPaid = roundMoney(currentPaid + nextAmount);
      const newRemaining = roundMoney(Math.max(0, currentTotal - newPaid));
      const nextStatus = newRemaining <= 0 ? "paid" : newPaid > 0 ? "partial" : "unpaid";

      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_paid: newPaid,
          remaining_balance: newRemaining,
          payment_method: method,
          customer_payment_status: nextStatus,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Balance recorded.");
      await loadBookings();
      window.dispatchEvent(new CustomEvent("bookings:updated"));
      setBalanceModal(EMPTY_BALANCE_MODAL);
      if (setSelected) {
        setSelected((s) => (s && s.id === booking.id ? {
          ...s,
          amountPaid: newPaid,
          remainingBalance: newRemaining,
          customerPaymentStatus: nextStatus,
        } : s));
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not record balance.");
    } finally {
      setActing(null);
    }
  }

  async function applyExtension(booking) {
    if (!booking) return;
    const hoursToAdd = Number(extendHours || 1);
    if (!Number.isFinite(hoursToAdd) || hoursToAdd <= 0) {
      toast.error("Select a valid extension length.");
      return;
    }

    setExtending(true);
    try {
      const currentTotal = roundMoney(Number(booking.totalAmount) || 0);
      const currentPaid = roundMoney(Number(booking.amountPaid) || 0);
      const hourlyRate = deriveHourlyRate(booking);
      const extensionAmount = roundMoney(hourlyRate * hoursToAdd);
      const nextDuration = roundMoney((Number(booking.duration) || 1) + hoursToAdd);
      const nextTotal = roundMoney(currentTotal + extensionAmount);
      const nextRemaining = roundMoney(Math.max(0, nextTotal - currentPaid));

      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duration: nextDuration,
          total_amount: nextTotal,
          remaining_balance: nextRemaining,
          hourly_rate: hourlyRate,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(`Booking extended by ${hoursToAdd} hour${hoursToAdd > 1 ? "s" : ""}. Added ₱${extensionAmount.toFixed(2)}.`);
      await loadBookings();
      window.dispatchEvent(new CustomEvent("bookings:updated"));
      if (setSelected) {
        setSelected((s) => (s && s.id === booking.id ? {
          ...s,
          duration: nextDuration,
          totalAmount: nextTotal,
          remainingBalance: nextRemaining,
          hourlyRate,
        } : s));
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not extend booking.");
    } finally {
      setExtending(false);
    }
  }

  async function saveBookingChanges() {
    if (!selected) return;
    setActing(selected.id);
    try {
      const updateData = {};
      if (editDraft.date !== selected.date) updateData.date = editDraft.date;
      if (editDraft.timeSlot !== selected.timeSlot) updateData.time_slot = editDraft.timeSlot;
      if (editDraft.endTime !== selected.endTime) updateData.end_time = editDraft.endTime;
      if (editDraft.duration !== selected.duration) updateData.duration = Number(editDraft.duration);
      if (editDraft.playerName !== selected.playerName) updateData.player_name = editDraft.playerName;
      if (editDraft.contactNumber !== selected.contactNumber) updateData.contact_number = editDraft.contactNumber;

      const isTotalChanged = (Number(editDraft.totalAmount) !== Number(selected.totalAmount));
      if (Object.keys(updateData).length === 0 && !isTotalChanged) {
        toast.error("No changes made.");
        setActing(null);
        return;
      }

      const items = selected._isGroup ? selected.groupBookings : [selected];
      await Promise.all(items.map(b => {
        const payload = { ...updateData };
        if (isTotalChanged) {
           payload.total_amount = Number(editDraft.totalAmount) / items.length;
        }
        return fetch(`/api/bookings/${b.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }));

      toast.success("Booking updated successfully.");
      await loadBookings();
      window.dispatchEvent(new CustomEvent("bookings:updated"));
      setSelected({ ...selected, ...editDraft });
      setEditMode(false);
    } catch (err) {
      console.error(err);
      toast.error("Could not update booking. Please try again.");
    } finally {
      setActing(null);
    }
  }
  const PAGE_SIZE = 10;
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sortByDate, setSortByDate] = useState("created_desc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [extendHours, setExtendHours] = useState(1);
  const [extending, setExtending] = useState(false);
  const [balanceModal, setBalanceModal] = useState(EMPTY_BALANCE_MODAL);
  const [payStatusDraft, setPayStatusDraft] = useState("");
  const [printData, setPrintData] = useState(null);
  const [linkedPayment, setLinkedPayment] = useState(null);
  const [zoomImage, setZoomImage] = useState(null);
  const [rejectReasonModal, setRejectReasonModal] = useState({ open: false, reason: "" });
  const [resolvedContact, setResolvedContact] = useState(null);
  const [paidEditDraft, setPaidEditDraft] = useState("");
  const [savingPaid, setSavingPaid] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState({});
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ open: false, targetBooking: null, label: "", linkedPayments: 0 });


  useEffect(() => {
    document.title = "PICKLE BROS COURT | Booking Management";
  }, []);

  async function loadBookings() {
    try {
      const res = await fetch("/api/bookings");
      if (res.ok) {
        const rows = await res.json();
        setBookings(rows);
        return rows;
      }
      return [];
    } catch (err) {
      console.error("Bookings load error:", err);
      return [];
    } finally {
      setLoading(false);
    }
  }

  async function loadLinkedPaymentForBooking(bookingId) {
    if (!bookingId) return null;
    try {
      const res = await fetch(`/api/payments?bookingId=${encodeURIComponent(bookingId)}`);
      if (!res.ok) return null;
      const rows = await res.json();
      return Array.isArray(rows) && rows.length ? rows[0] : null;
    } catch (err) {
      console.error("Load linked payment error:", err);
      return null;
    }
  }

  useEffect(() => {
    loadBookings();
  }, []);

  useEffect(() => {
    if (!selected) {
      setLinkedPayment(null);
      setZoomImage(null);
      setRejectReasonModal({ open: false, reason: "" });
      setEditMode(false);
      setEditDraft({});
      return;
    }

    setLinkedPayment(null);
    setZoomImage(null);
    setRejectReasonModal({ open: false, reason: "" });

    async function loadPayment() {
      const payment = await loadLinkedPaymentForBooking(selected.id);
      setLinkedPayment(payment);
    }

    loadPayment();

    // Initialize edit draft with current selected booking data
    setEditDraft({
      date: formatDateForInput(selected.date) || "",
      timeSlot: selected.timeSlot || "",
      endTime: selected.endTime || "",
      duration: selected.duration || "",
      playerName: selected.playerName || "",
      contactNumber: selected.contactNumber || "",
      totalAmount: selected.totalAmount || "",
    });
  }, [selected]);

  const selectedMoney = selected
    ? resolveBookingTotals(selected, linkedPayment)
    : { total: 0, paid: 0, remaining: 0 };

  useEffect(() => {
    if (!selected) {
      setPaidEditDraft("");
      return;
    }
    const { paid, total } = resolveBookingTotals(selected, linkedPayment);
    const gcashHint =
      String(selected.paymentMethod || linkedPayment?.method || "").toLowerCase() === "gcash";
    const payRecordAmt = roundMoney(Number(linkedPayment?.amount) || 0);
    const suggested =
      paid > 0 ? paid : gcashHint && payRecordAmt > 0 ? payRecordAmt : paid;
    setPaidEditDraft(suggested > 0 ? suggested.toFixed(2) : "");
  }, [
    selected,
    linkedPayment,
    selected?.id,
    selected?.amountPaid,
    selected?.totalAmount,
    linkedPayment?.id,
    linkedPayment?.amount,
    linkedPayment?.amountPaid,
  ]);

  async function savePaidAmount() {
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
      const res = await fetch(`/api/bookings/${selected.id}`, {
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
  }

  function applyDatePreset(preset) {
    const today = new Date();
    if (preset === "today") {
      const y = format(today, "yyyy-MM-dd");
      setDateFrom(y);
      setDateTo(y);
      return;
    }
    if (preset === "week") {
      const s = startOfWeek(today, { weekStartsOn: 1 });
      const e = endOfWeek(today, { weekStartsOn: 1 });
      setDateFrom(format(s, "yyyy-MM-dd"));
      setDateTo(format(e, "yyyy-MM-dd"));
      return;
    }
    if (preset === "month") {
      const s = startOfMonth(today);
      const e = endOfMonth(today);
      setDateFrom(format(s, "yyyy-MM-dd"));
      setDateTo(format(e, "yyyy-MM-dd"));
      return;
    }
    if (preset === "last7") {
      setDateFrom(format(subDays(today, 6), "yyyy-MM-dd"));
      setDateTo(format(today, "yyyy-MM-dd"));
      return;
    }
    if (preset === "clear") {
      setDateFrom("");
      setDateTo("");
    }
  }

  function toDateMs(booking) {
    const d = String(booking?.date || "").trim();
    const t = String(booking?.timeSlot || "").trim();
    if (!d) return 0;
    if (!t) {
      const dt = new Date(`${d}T00:00:00`);
      return Number.isFinite(dt.getTime()) ? dt.getTime() : 0;
    }
    const m = t.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
    if (!m) {
      const dt = new Date(`${d} ${t}`);
      return Number.isFinite(dt.getTime()) ? dt.getTime() : 0;
    }
    let hh = Number(m[1]) % 12;
    const mm = Number(m[2]);
    const ap = m[3].toUpperCase();
    if (ap === "PM") hh += 12;
    const hhText = String(hh).padStart(2, "0");
    const mmText = String(mm).padStart(2, "0");
    const dt = new Date(`${d}T${hhText}:${mmText}:00`);
    return Number.isFinite(dt.getTime()) ? dt.getTime() : 0;
  }


  async function setStatus(targetBooking, status) {
    const isGroup = targetBooking._isGroup;
    const items = isGroup ? targetBooking.groupBookings : [targetBooking];
    setActing(targetBooking.id);
    try {
      await Promise.all(items.map(b => 
        fetch(`/api/bookings/${b.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status })
        })
      ));
      
      if (status === "Approved") {
        const phone = await resolveBookingContactNumber(db, targetBooking);
        const courtsText = isGroup ? targetBooking.displayCourts.join(", ") : (targetBooking.courtName || "the court");
        const smsMsg = `Good day!! This is PICKLE BROS COURT: Your booking at ${courtsText} on ${formatDateForDisplay(targetBooking.date)} for ${targetBooking.timeSlot} has been APPROVED. Please arrive on your scheduled time. thank you and God bless`;
        const smsRes = await sendBookingSMS(targetBooking.id, phone, smsMsg);
        if (smsRes.success) {
          toast.success("Booking approved and SMS sent");
        } else {
          toast.error(smsRes.error || "Booking approved but SMS failed");
        }
      } else {
        toast.success(`Booking ${status}`);
      }
      await loadBookings();
      window.dispatchEvent(new CustomEvent("bookings:updated"));
    } catch (err) { 
      console.error(err); 
      toast.error("Update failed."); 
    }
    setActing(null);
  }

  async function updatePayStatus(booking, nextStatus) {
    const status = String(nextStatus || "").toLowerCase();
    if (!["paid", "partial", "unpaid"].includes(status)) {
      toast.error("Invalid pay status.");
      return;
    }
    setActing(booking.id);
    try {
      const batch = writeBatch(db);
      const bookingRef = doc(db, "bookings", booking.id);
      batch.update(bookingRef, {
        customerPaymentStatus: status,
        updatedAt: Timestamp.now(),
      });
      const linked = await getDocs(
        query(collection(db, "payments"), where("bookingId", "==", booking.id))
      );
      linked.forEach((d) => {
        batch.update(d.ref, {
          customerPaymentStatus: status,
          updatedAt: serverTimestamp(),
        });
      });

      await wrapSync(batch.commit(), {
        successMsg: "Pay status updated.",
        offlineMsg: "Status Update Saved Offline — Pending Server Sync",
        errorMsg: "Could not update pay status."
      });

      setSelected((s) => (s && s.id === booking.id ? { ...s, customerPaymentStatus: status } : s));
    } catch (e) {
      console.error(e);
    } finally {
      setActing(null);
    }
  }

  async function promptRemoveBooking(targetBooking) {
    const row = targetBooking;
    const label = row?.playerName || (row._isGroup ? row.displayCourts.join(", ") : row?.courtName) || "this booking";
    const items = row._isGroup ? row.groupBookings : [row];
    let linkedPayments = 0;
    try {
      for (const b of items) {
        const linkedSnap = await getDocs(
          query(collection(db, "payments"), where("bookingId", "==", b.id))
        );
        linkedPayments += (linkedSnap.docs ? linkedSnap.docs.length : (linkedSnap.size || 0));
      }
    } catch (e) {
      console.error(e);
      toast.error("Could not load linked payment data. Try again.");
      return;
    }
    setDeleteConfirmModal({ open: true, targetBooking, label, linkedPayments });
  }

  async function executeRemoveBooking() {
    const { targetBooking } = deleteConfirmModal;
    if (!targetBooking) return;
    setActing(targetBooking.id);
    try {
      const items = targetBooking._isGroup ? targetBooking.groupBookings : [targetBooking];
      const batch = writeBatch(db);
      for (const b of items) {
        batch.delete(doc(db, "bookings", b.id));
      }

      await wrapSync(batch.commit(), {
        successMsg: "Booking deleted permanently.",
        offlineMsg: "Action Queued for Sync",
        errorMsg: "Could not delete this booking."
      });
      
      toast.success("Booking deleted permanently.");
      setDeleteConfirmModal({ open: false, targetBooking: null, label: "", linkedPayments: 0 });
      await loadBookings();
      window.dispatchEvent(new CustomEvent("bookings:updated"));
    } catch (err) {
      console.error(err);
      toast.error("Could not delete this booking. Check your connection and permissions.");
    }
    setActing(null);
    if (selected && selected.id === targetBooking.id) {
      setSelected(null);
    }
  }

  async function handlePrintReceipt(b) {
    const receiptId = "RCPT-" + b.id.substring(0, 5).toUpperCase() + "-" + Math.floor(100 + Math.random() * 900);
    const printedBy = "Admin";

    setActing(b.id);
    try {
      await updateDoc(doc(db, "bookings", b.id), {
        latestReceiptId: receiptId,
        lastPrintedAt: Timestamp.now(),
        lastPrintedBy: printedBy
      });
    } catch (err) {
      console.error("Failed to log receipt print", err);
    }
    setActing(null);
    setPrintData({ booking: b, receiptId, printedBy });
  }

  async function approvePayment() {
    if (!linkedPayment) return;
    setActing("payment_approve");
    try {
      const items = selected._isGroup ? selected.groupBookings : [selected];
      const batch = writeBatch(db);
      batch.update(doc(db, "payments", linkedPayment.id), {
        paymentStatus: "Approved",
        reviewedAt: serverTimestamp()
      });
      for (const b of items) {
        batch.update(doc(db, "bookings", b.id), {
          status: "Confirmed"
        });
      }
      await wrapSync(batch.commit(), {
        successMsg: "Payment approved successfully",
        offlineMsg: "Approval queued for sync",
        silent: true // handle toast manually
      });

      setActing("payment_approve_sms");
      const courtsText = selected._isGroup ? selected.displayCourts.join(", ") : (selected.courtName || "the court");
      const smsMsg = `Good day!! This is PICKLE BROS COURT: Your booking at ${courtsText} on ${formatDateForDisplay(selected.date)} for ${selected.timeSlot} has been APPROVED. Please arrive on your scheduled time. thank you and God bless`;
      const phone = await resolveBookingContactNumber(db, selected);
      const smsRes = await sendBookingSMS(selected.id, phone, smsMsg);

      if (smsRes.success) {
        toast.success("Booking approved and SMS sent successfully");
      } else {
        if (smsRes.code === "no_number") {
          toast.success("Booking updated but SMS could not be sent (missing contact number)");
        } else if (smsRes.code === "invalid_format") {
          toast.success("Booking updated but SMS failed due to invalid phone number");
        } else if (smsRes.code === "config_error") {
          toast.error(smsRes.error || "SMS sender ID not configured (M360_SHORTCODE_MASK in .env)");
        } else {
          toast.error(smsRes.error || "Booking updated but SMS service failed");
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Update failed. Please try again.");
    } finally {
      setActing(null);
    }
  }

  async function rejectPayment() {
    if (!rejectReasonModal.reason.trim()) {
      toast.error("Please enter a rejection reason");
      return;
    }
    setActing("payment_reject");
    try {
      const items = selected._isGroup ? selected.groupBookings : [selected];
      const batch = writeBatch(db);
      if (linkedPayment) {
        batch.update(doc(db, "payments", linkedPayment.id), {
          paymentStatus: "Rejected",
          rejectionReason: rejectReasonModal.reason.trim(),
          reviewedAt: serverTimestamp()
        });
      }
      for (const b of items) {
        batch.update(doc(db, "bookings", b.id), {
          status: "Rejected"
        });
      }
      await wrapSync(batch.commit(), {
        successMsg: linkedPayment ? "Payment rejected" : "Booking rejected",
        offlineMsg: "Rejection queued for sync",
        silent: true // handle toast manually
      });
      setRejectReasonModal({ open: false, reason: "" });

      setActing("payment_reject_sms");
      const reasonText = rejectReasonModal.reason.trim();
      const smsMsg = `GOOD DAY!! PICKLE BROS COURT: Your booking has been REJECTED. Reason: ${reasonText}. Please review your booking details or contact support for assistance. Thank you.`;
      const phone = await resolveBookingContactNumber(db, selected);
      const smsRes = await sendBookingSMS(selected.id, phone, smsMsg);

      if (smsRes.success) {
        toast.success("Booking rejected and SMS notification sent");
      } else {
        if (smsRes.code === "no_number") {
          toast.success("Booking updated but SMS could not be sent (missing contact number)");
        } else if (smsRes.code === "invalid_format") {
          toast.success("Booking updated but SMS failed due to invalid phone number");
        } else if (smsRes.code === "config_error") {
          toast.error(smsRes.error || "SMS sender ID not configured (M360_SHORTCODE_MASK in .env)");
        } else {
          toast.error(smsRes.error || "Booking updated but SMS service failed");
        }
      }
      await loadBookings();
      window.dispatchEvent(new CustomEvent("bookings:updated"));
    } catch (e) {
      console.error(e);
      toast.error("Update failed. Please try again.");
    } finally {
      setActing(null);
    }
  }

  async function setPaymentPending() {
    if (!linkedPayment) return;
    setActing("payment_pending");
    try {
      const items = selected._isGroup ? selected.groupBookings : [selected];
      const batch = writeBatch(db);
      batch.update(doc(db, "payments", linkedPayment.id), {
        paymentStatus: "Pending"
      });
      for (const b of items) {
        batch.update(doc(db, "bookings", b.id), {
          status: "Pending Review"
        });
      }
      await wrapSync(batch.commit(), {
        successMsg: "Marked as pending review",
        offlineMsg: "Update queued for sync"
      });
    } catch (e) {
      console.error(e);
      toast.error("Update failed. Please try again.");
    } finally {
      setActing(null);
    }
  }

  let rangeFrom = dateFrom.trim();
  let rangeTo = dateTo.trim();
  if (rangeFrom && rangeTo && rangeFrom > rangeTo) {
    [rangeFrom, rangeTo] = [rangeTo, rangeFrom];
  }

  const filtered = bookings.filter((b) => {
    const matchFilter = filter === "All" || b.status === filter;
    const matchSearch =
      !search ||
      b.playerName?.toLowerCase().includes(search.toLowerCase()) ||
      b.courtName?.toLowerCase().includes(search.toLowerCase());
    if (!matchFilter || !matchSearch) return false;
    const day = bookingDayString(b, toDateMs);
    if (rangeFrom && (!day || day < rangeFrom)) return false;
    if (rangeTo && (!day || day > rangeTo)) return false;
    return true;
  });

  const groupedMap = new Map();
  for (const b of filtered) {
    // Also include a fallback to b.id if date/time are entirely missing so it doesn't group randomly
    const key = (b.playerName && b.timeSlot) 
      ? `${b.playerName}|${bookingDayString(b, toDateMs) || ''}|${b.timeSlot}`
      : b.id;
    if (!groupedMap.has(key)) groupedMap.set(key, []);
    groupedMap.get(key).push(b);
  }

  const grouped = Array.from(groupedMap.values()).map(group => {
    const primary = group[0];
    const allCourts = group.flatMap(b => String(b.courtName ?? b.courtId ?? "—").split(",").map(s => s.trim()));
    const totalAmount = group.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);
    const amountPaid = group.reduce((sum, b) => sum + (Number(b.amountPaid) || 0), 0);
    const remainingBalance = group.reduce((sum, b) => sum + (Number(b.remainingBalance) || 0), 0);
    const computedEndTime = primary.endTime || calculateEndTime(primary.timeSlot, primary.duration);
    
    return {
      ...primary,
      _isGroup: true,
      groupBookings: group,
      displayCourts: allCourts,
      totalAmount,
      amountPaid,
      remainingBalance,
      endTime: computedEndTime
    };
  });

  const sorted = [...grouped].sort((a, b) => {
    if (sortByDate.startsWith("created")) {
      const aTime = new Date(a.createdAt).getTime() || a.createdAt?.toMillis?.() || 0;
      const bTime = new Date(b.createdAt).getTime() || b.createdAt?.toMillis?.() || 0;
      const diff = aTime - bTime;
      return sortByDate === "created_asc" ? diff : -diff;
    } else {
      const diff = toDateMs(a) - toDateMs(b);
      return sortByDate === "date_asc" ? diff : -diff;
    }
  });
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  const counts = {
    All: bookings.length,
    Pending: bookings.filter(b => b.status === "Pending").length,
    Approved: bookings.filter(b => b.status === "Approved").length,
    Cancelled: bookings.filter(b => b.status === "Cancelled").length,
  };

  if (loading) return <div className="ad-loading"><div className="ad-spinner" /></div>;

  return (
    <div className="ad-page">
      <div className="ad-page-header">
        <div>
          <h1 className="ad-page-title">Booking Management</h1>
          <p className="ad-page-sub">Review and manage all court bookings.</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="ad-filter-tabs">
        {Object.entries(counts).map(([k, v]) => (
          <button key={k} className={`ad-filter-tab ${filter === k ? "active" : ""}`} onClick={() => setFilter(k)}>
            {k} <span className="ad-filter-count">{v}</span>
          </button>
        ))}
      </div>

      <div className="ad-booking-toolbar">
        <div className="ad-booking-toolbar-row">
          <input
            className="ad-search"
            style={{ flex: "1 1 240px", minWidth: 200, maxWidth: "100%" }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by player or court..."
          />
          <span className="ad-count ad-booking-count">
            {sorted.length} booking{sorted.length !== 1 ? "s" : ""} • page {currentPage}/{totalPages}
          </span>
        </div>
        <div className="ad-booking-toolbar-row ad-booking-toolbar-dates">
          <div className="ad-date-field">
            <label htmlFor="bm-date-from">From</label>
            <input
              id="bm-date-from"
              type="date"
              className="ad-search ad-date-input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="ad-date-field">
            <label htmlFor="bm-date-to">To</label>
            <input
              id="bm-date-to"
              type="date"
              className="ad-search ad-date-input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div className="ad-date-field">
            <label htmlFor="bm-sort-order">Order</label>
            <select
              id="bm-sort-order"
              className="ad-search ad-date-input"
              value={sortByDate}
              onChange={(e) => setSortByDate(e.target.value)}
              aria-label="Sort order by booking date"
            >
              <option value="created_desc">Received (Newest first)</option>
              <option value="created_asc">Received (Oldest first)</option>
              <option value="date_asc">Play Date (Soonest first)</option>
              <option value="date_desc">Play Date (Furthest first)</option>
            </select>
          </div>
          <div className="ad-date-presets">
            <span className="ad-date-presets-label">Quick range</span>
            <div className="ad-action-btns">
              <button type="button" className="ad-btn ad-btn-sm ad-btn-outline" onClick={() => applyDatePreset("today")}>
                Today
              </button>
              <button type="button" className="ad-btn ad-btn-sm ad-btn-outline" onClick={() => applyDatePreset("week")}>
                This week
              </button>
              <button type="button" className="ad-btn ad-btn-sm ad-btn-outline" onClick={() => applyDatePreset("month")}>
                This month
              </button>
              <button type="button" className="ad-btn ad-btn-sm ad-btn-outline" onClick={() => applyDatePreset("last7")}>
                Last 7 days
              </button>
              <button type="button" className="ad-btn ad-btn-sm ad-btn-outline" onClick={() => applyDatePreset("clear")}>
                Clear range
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="ad-card">
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Player</th><th>Court</th><th>Date</th>
                <th>Time</th><th>Time Due</th><th>Pay</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && (
                <tr><td colSpan={8} className="ad-empty">No bookings found.</td></tr>
              )}
              {paged.map(b => (
                <tr key={b.id} className="ad-table-row" onClick={() => setSelected(b)}>
                  <td className="ad-td-main">{b.playerName ?? "—"}</td>
                  <td>
                    {(b.displayCourts || String(b.courtName ?? b.courtId ?? "—").split(",")).map((name, i) => (
                      <div key={i}>{name.trim()}</div>
                    ))}
                  </td>
                  <td>{formatDateForDisplay(b.date)}</td>
                  <td>{b.timeSlot ?? "—"}</td>
                  <td>{b.endTime ?? "—"}</td>
                  <td>
                    <span className={`ad-badge ad-badge-${PAY_STATUS_BADGE[(b.customerPaymentStatus || "").toLowerCase()] ?? "pending"}`}>
                      {(b.customerPaymentStatus ?? "—").toString()}
                    </span>
                  </td>
                  <td><span className={`ad-badge ad-badge-${b.hasPendingWrites ? "pending" : (STATUS_COLORS[b.status] ?? "pending")}`}>{b.hasPendingWrites ? "Pending Sync" : (b.status ?? "Pending")}</span></td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="ad-action-btns">
                      <button
                        type="button"
                        className="ad-btn ad-btn-sm ad-btn-primary"
                        disabled={acting === b.id}
                        onClick={() => setSelected(b)}
                        title="View and edit booking details"
                      >
                        ✎ Edit
                      </button>
                      {b.status !== "Approved" && (
                        <button className="ad-btn ad-btn-sm ad-btn-success"
                          disabled={acting === b.id}
                          onClick={() => setStatus(b, "Approved")}>
                          ✓ Approve
                        </button>
                      )}
                      {b.status !== "Rejected" && b.status !== "Cancelled" && (
                        <button className="ad-btn ad-btn-sm"
                          style={{ backgroundColor: '#ef4444', color: 'white', borderColor: '#ef4444', marginLeft: '4px' }}
                          disabled={acting === b.id}
                          onClick={(e) => {
                             e.stopPropagation();
                             setSelected(b);
                             setRejectReasonModal({ open: true, reason: "" });
                          }}>
                          ✕ Reject
                        </button>
                      )}

                      <button
                        type="button"
                        className="ad-btn ad-btn-sm ad-btn-outline"
                        disabled={acting === b.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          promptRemoveBooking(b);
                        }}
                        title="Remove this booking record"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sorted.length > PAGE_SIZE && (
          <div className="ad-modal-footer" style={{ borderTop: "1px solid var(--ad-border)" }}>
            <button
              type="button"
              className="ad-btn ad-btn-outline ad-btn-sm"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Prev
            </button>
            <span className="ad-count">Page {currentPage} of {totalPages}</span>
            <button
              type="button"
              className="ad-btn ad-btn-outline ad-btn-sm"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="ad-modal-backdrop" onClick={() => setSelected(null)}>
          <div className="ad-modal ad-modal-booking flex flex-col md:flex-row bg-[#0f172a]/95 backdrop-blur-xl border border-slate-700 shadow-2xl rounded-2xl overflow-hidden" style={{ maxWidth: '1200px', width: '96vw' }} onClick={e => e.stopPropagation()}>
            {/* LEFT COLUMN: INFO */}
            <div className="flex-1 flex flex-col max-h-[85vh] overflow-y-auto custom-scrollbar border-r border-slate-800">
              <div className="ad-modal-header sticky top-0 bg-[#0f172a]/95 backdrop-blur-md z-10 border-b border-slate-800">
                <h3>Booking & Payment Details</h3>
                <button className="ad-modal-close lg:hidden" onClick={() => setSelected(null)}>✕</button>
              </div>
              <div className="p-4 space-y-6">
                {/* Booking Info */}
                <div>
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-3">Booking Information</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="ad-detail-row">
                      <span>Player</span>
                      {editMode ? (
                        <input type="text" className="ad-search text-sm py-1" value={editDraft.playerName} onChange={e => setEditDraft({...editDraft, playerName: e.target.value})} />
                      ) : (
                        <strong>{selected.playerName ?? selected.userId ?? '—'}</strong>
                      )}
                    </div>
                    <div className="ad-detail-row">
                      <span>Contact</span>
                      {editMode ? (
                        <input type="text" className="ad-search text-sm py-1" value={editDraft.contactNumber} onChange={e => setEditDraft({...editDraft, contactNumber: e.target.value})} />
                      ) : (
                        <strong>{resolvedContact ?? selected.contactNumber ?? "—"}</strong>
                      )}
                    </div>
                    <div className="ad-detail-row">
                      <span>Court</span>
                      <strong>
                        {(selected.displayCourts || String(selected.courtName ?? selected.courtId ?? "—").split(",")).map((name, i) => (
                          <div key={i}>{name.trim()}</div>
                        ))}
                      </strong>
                    </div>
                    <div className="ad-detail-row">
                      <span>Date</span>
                      {editMode ? (
                        <input type="date" className="ad-search text-sm py-1" value={editDraft.date} onChange={e => setEditDraft({...editDraft, date: e.target.value})} />
                      ) : (
                        <strong>{formatDateForDisplay(selected.date)}</strong>
                      )}
                    </div>
                    <div className="ad-detail-row">
                      <span>Time Slot</span>
                      {editMode ? (
                        <input type="text" className="ad-search text-sm py-1" placeholder="HH:MM AM/PM" value={editDraft.timeSlot} onChange={e => setEditDraft({...editDraft, timeSlot: e.target.value})} />
                      ) : (
                        <strong>{selected.timeSlot ?? '—'}</strong>
                      )}
                    </div>
                    <div className="ad-detail-row">
                      <span>Time Due (End)</span>
                      {editMode ? (
                        <input type="text" className="ad-search text-sm py-1" placeholder="HH:MM AM/PM" value={editDraft.endTime} onChange={e => setEditDraft({...editDraft, endTime: e.target.value})} />
                      ) : (
                        <strong>{selected.endTime ?? '—'}</strong>
                      )}
                    </div>
                    <div className="ad-detail-row">
                      <span>Duration</span>
                      {editMode ? (
                        <input type="number" step="0.5" className="ad-search text-sm py-1" value={editDraft.duration} onChange={e => setEditDraft({...editDraft, duration: e.target.value})} />
                      ) : (
                        <strong>{selected.duration ?? "—"} hr</strong>
                      )}
                    </div>
                    <div className="ad-detail-row">
                      <span>Total</span>
                      {editMode ? (
                        <input type="number" step="0.01" className="ad-search text-sm py-1" value={editDraft.totalAmount} onChange={e => setEditDraft({...editDraft, totalAmount: e.target.value})} />
                      ) : (
                        <strong>₱{selectedMoney.total.toFixed(2)}</strong>
                      )}
                    </div>
                    <div className="ad-detail-row ad-detail-row-edit">
                      <span>Paid (GCash / cash received)</span>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="ad-search text-sm py-2 w-32"
                          value={paidEditDraft}
                          onChange={(e) => setPaidEditDraft(e.target.value)}
                          placeholder="0.00"
                          aria-label="Amount paid"
                          disabled={editMode}
                        />
                        <button
                          type="button"
                          className="ad-btn ad-btn-sm ad-btn-success"
                          disabled={savingPaid || acting === selected.id || editMode}
                          onClick={savePaidAmount}
                        >
                          {savingPaid ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                    <div className="ad-detail-row"><span>Balance</span><strong>₱{selectedMoney.remaining.toFixed(2)}</strong></div>
                    {Number(selected.totalAmount) === 0 && selectedMoney.total > 0 && (
                      <p className="col-span-2 text-xs text-amber-400/90">
                        Total was missing on the booking — showing ₱{selectedMoney.total.toFixed(2)} from the payment record. Save paid amount to sync both records.
                      </p>
                    )}
                    <div className="ad-detail-row"><span>Booking Status</span>
                      <span className={`ad-badge ad-badge-${STATUS_COLORS[selected.status] ?? "pending"} mt-1 w-fit`}>{selected.status ?? "Pending"}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Info */}
                {linkedPayment && (
                  <div>
                    <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-3">Payment Record</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="ad-detail-row"><span>Amount</span><strong>₱{roundMoney(Number(linkedPayment.amount) || 0).toFixed(2)}</strong></div>
                      <div className="ad-detail-row"><span>Discount</span><strong>₱{roundMoney(Number(linkedPayment.discount) || 0).toFixed(2)}</strong></div>
                      <div className="ad-detail-row"><span>Promo Code</span><strong>{linkedPayment.promoCode ?? "None"}</strong></div>
                      <div className="ad-detail-row"><span>Method</span><strong className="capitalize">{linkedPayment.method ?? "—"}</strong></div>
                      <div className="ad-detail-row"><span>Status</span>
                        <span className={`ad-badge ad-badge-${PAY_STATUS_BADGE[(linkedPayment.paymentStatus || "").toLowerCase()] ?? "pending"} mt-1 w-fit`}>
                          {linkedPayment.paymentStatus ?? "Pending"}
                        </span>
                      </div>
                      <div className="ad-detail-row"><span>Created At</span><strong>{linkedPayment.createdAt?.toDate ? format(linkedPayment.createdAt.toDate(), "MMM dd, yyyy — h:mm a") : "—"}</strong></div>
                      <div className="ad-detail-row"><span>Reviewed At</span><strong>{linkedPayment.reviewedAt?.toDate ? format(linkedPayment.reviewedAt.toDate(), "MMM dd, yyyy — h:mm a") : "Not reviewed"}</strong></div>
                    </div>
                  </div>
                )}

                {!linkedPayment && (
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 flex items-center justify-center text-sm text-slate-500 font-medium">
                    No linked payment record found for this booking.
                  </div>
                )}

                {/* Extend Time */}
                {selected.status !== "Cancelled" && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-inner shadow-black/20">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Extend time</p>
                        <p className="text-[11px] text-slate-500 mt-1">This adds the hourly rate to the booking total and balance due.</p>
                      </div>
                      <div className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-400">
                        ₱{(deriveHourlyRate(selected) || 0).toFixed(2)}/hr
                      </div>
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-1">Add hours</label>
                        <select
                          className="ad-search text-sm py-2 min-w-[100px]"
                          value={extendHours}
                          onChange={(e) => setExtendHours(Number(e.target.value))}
                        >
                          {EXTEND_OPTIONS.map((h) => (
                            <option key={h} value={h}>{h} hour{h > 1 ? "s" : ""}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        className="ad-btn ad-btn-sm ad-btn-success"
                        disabled={extending}
                        onClick={() => applyExtension(selected)}
                      >
                        {extending ? "…" : "Add extension"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-auto p-4 border-t border-slate-800 bg-[#0f172a]/95 sticky bottom-0 z-10 flex flex-wrap gap-2 items-center justify-between">
                <button
                  type="button"
                  className="ad-btn ad-btn-outline ad-btn-sm"
                  disabled={acting === selected.id}
                  onClick={() => promptRemoveBooking(selected)}
                >
                  Delete Booking
                </button>
                <div className="flex gap-2">
                  {editMode ? (
                    <>
                      <button
                        type="button"
                        className="ad-btn ad-btn-outline ad-btn-sm"
                        disabled={acting === selected.id}
                        onClick={() => {
                          setEditMode(false);
                          setEditDraft({});
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="ad-btn ad-btn-sm ad-btn-success"
                        disabled={acting === selected.id}
                        onClick={saveBookingChanges}
                      >
                        Save Changes
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="ad-btn ad-btn-primary ad-btn-sm"
                        disabled={acting === selected.id}
                        onClick={() => setEditMode(true)}
                        title="Edit booking details"
                      >
                        ✎ Edit Booking
                      </button>
                      <button
                        type="button"
                        className="ad-btn ad-btn-primary ad-btn-sm"
                        disabled={acting === selected.id}
                        onClick={() => handlePrintReceipt(selected)}
                      >
                        Print Receipt
                      </button>
                      {selectedMoney.remaining > 0 && selected.status !== "Cancelled" && (
                        <button
                          className="ad-btn ad-btn-sm ad-btn-success"
                          disabled={acting === selected.id}
                          onClick={() => openBalanceModal(selected)}
                        >
                          + Pay balance
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: PAYMENT PREVIEW & ACTIONS */}
            <div className="md:w-[420px] lg:w-[500px] flex-shrink-0 flex flex-col bg-slate-900/50 relative max-h-[85vh]">
              <div className="absolute top-4 right-4 z-20 hidden lg:block">
                <button className="w-8 h-8 rounded-full bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-colors shadow-lg" onClick={() => setSelected(null)}>✕</button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Payment Proof Preview</h4>

                {linkedPayment?.paymentImageUrl ? (
                  <div
                    className="relative rounded-xl overflow-hidden border border-slate-700 bg-black/50 shadow-2xl cursor-pointer group flex-1 min-h-[300px]"
                    onClick={() => setZoomImage(linkedPayment.paymentImageUrl)}
                  >
                    <img
                      src={linkedPayment.paymentImageUrl}
                      alt="Payment Proof"
                      className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                      <div className="flex flex-col items-center gap-2 text-white">
                        <span className="material-symbols-outlined text-4xl">zoom_in</span>
                        <span className="text-sm font-semibold tracking-wide">Click to Zoom</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 min-h-[300px] rounded-xl border border-dashed border-slate-700 bg-slate-800/30 flex flex-col items-center justify-center text-slate-500 gap-3">
                    <span className="material-symbols-outlined text-4xl opacity-50">receipt_long</span>
                    <p className="text-sm font-medium">No payment proof uploaded</p>
                  </div>
                )}

                {/* Reject Reason Input (conditionally visible) */}
                {rejectReasonModal.open && (
                  <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 shadow-inner">
                    <label className="text-[11px] font-bold text-red-400 uppercase tracking-wide block mb-2">Rejection Reason</label>
                    <textarea
                      className="w-full bg-slate-900/80 border border-red-500/30 rounded-lg p-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 resize-none"
                      rows="2"
                      placeholder="Why is this payment being rejected?"
                      value={rejectReasonModal.reason}
                      onChange={(e) => setRejectReasonModal(prev => ({ ...prev, reason: e.target.value }))}
                    ></textarea>
                    <div className="flex gap-2 mt-3 justify-end">
                      <button className="text-xs font-semibold text-slate-400 hover:text-white px-3 py-1.5" onClick={() => setRejectReasonModal({ open: false, reason: "" })}>Cancel</button>
                      <button className="text-xs font-bold bg-red-500 text-white px-4 py-1.5 rounded-md hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20" onClick={rejectPayment} disabled={acting === "payment_reject" || acting === "payment_reject_sms"}>
                        {acting === "payment_reject" ? "Rejecting..." : acting === "payment_reject_sms" ? "Sending SMS..." : "Confirm Reject"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons Footer */}
              <div className="p-4 border-t border-slate-800 bg-slate-900/80 backdrop-blur-md sticky bottom-0 z-10 flex flex-col gap-2">
                {!rejectReasonModal.open && (
                  <div className="flex gap-2 w-full">
                    <button
                      className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 px-4 rounded-lg transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                      onClick={() => {
                        if (linkedPayment) approvePayment();
                        else setStatus(selected, "Approved");
                      }}
                      disabled={acting || selected.status === "Approved" || selected.status === "Confirmed"}
                    >
                      {acting === "payment_approve" || acting === selected.id ? "Approving..." : acting === "payment_approve_sms" ? "Sending SMS..." : (linkedPayment ? "Approve Payment" : "Approve Booking")}
                    </button>
                    <button
                      className="flex-1 bg-red-500/10 border border-red-500/30 hover:bg-red-500 hover:text-white text-red-400 font-bold py-2.5 px-4 rounded-lg transition-all disabled:opacity-50"
                      onClick={() => setRejectReasonModal({ open: true, reason: "" })}
                      disabled={acting || selected.status === "Rejected"}
                    >
                      Reject
                    </button>
                  </div>
                )}
                <button
                  className="w-full bg-transparent border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 font-semibold py-2 px-4 rounded-lg transition-colors text-sm disabled:opacity-50"
                  onClick={setPaymentPending}
                  disabled={!linkedPayment || acting || linkedPayment.paymentStatus === "Pending"}
                >
                  {acting === "payment_pending" ? "Setting..." : "Set as Pending Review"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Zoom Image Modal */}
      {zoomImage && (
        <div className="fixed inset-0 z-[300] bg-black/90 flex items-center justify-center backdrop-blur-sm p-4 lg:p-8" onClick={() => setZoomImage(null)}>
          <button className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-colors backdrop-blur-md" onClick={() => setZoomImage(null)}>
            <span className="material-symbols-outlined">close</span>
          </button>
          <img
            src={zoomImage}
            alt="Fullscreen Payment Proof"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <a
            href={zoomImage}
            download="payment-proof.jpg"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-6 right-6 flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-2.5 px-5 rounded-full transition-all shadow-lg shadow-cyan-500/20"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="material-symbols-outlined text-[20px]">download</span>
            Download
          </a>
        </div>
      )}

      {balanceModal.open && balanceModal.booking && (
        <div className="ad-modal-backdrop" onClick={closeBalanceModal}>
          <div className="ad-modal ad-modal-balance rounded-2xl border border-slate-700 bg-slate-900/95 p-0 shadow-2xl shadow-black/40" onClick={(e) => e.stopPropagation()}>
            <div className="ad-modal-header border-b border-slate-800 px-5 py-4">
              <div>
                <h3 className="text-lg font-black text-white">Record payment</h3>
                <p className="text-[11px] text-slate-500 mt-1">Add the customer’s balance or partial payment here.</p>
              </div>
              <button className="ad-modal-close" onClick={closeBalanceModal}>✕</button>
            </div>
            <div className="ad-modal-form space-y-4 px-5 py-5">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Player</span>
                  <strong className="text-white">{balanceModal.booking.playerName ?? "—"}</strong>
                </div>
                <div className="flex items-center justify-between mt-2 text-sm">
                  <span className="text-slate-400">Balance due</span>
                  <strong className="text-cyan-400">₱{deriveRemainingBalance(balanceModal.booking).toFixed(2)}</strong>
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold block mb-2">
                  Amount to record
                </label>
                <input
                  className="ad-search w-full"
                  type="number"
                  min="0"
                  step="0.01"
                  value={balanceModal.amount}
                  onChange={(e) =>
                    setBalanceModal((prev) => ({ ...prev, amount: e.target.value }))
                  }
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold block mb-2">
                  Payment method
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`ad-btn ad-btn-sm flex-1 ${balanceModal.method === "cash" ? "ad-btn-success" : "ad-btn-outline"}`}
                    onClick={() => setBalanceModal((prev) => ({ ...prev, method: "cash" }))}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    className={`ad-btn ad-btn-sm flex-1 ${balanceModal.method === "gcash" ? "ad-btn-success" : "ad-btn-outline"}`}
                    onClick={() => setBalanceModal((prev) => ({ ...prev, method: "gcash" }))}
                  >
                    GCash
                  </button>
                </div>
              </div>
            </div>
            <div className="ad-modal-footer border-t border-slate-800 px-5 py-4">
              <button type="button" className="ad-btn ad-btn-outline" onClick={closeBalanceModal}>
                Cancel
              </button>
              <button
                type="button"
                className="ad-btn ad-btn-success"
                disabled={acting === balanceModal.booking.id}
                onClick={() =>
                  settleBalance(balanceModal.booking, balanceModal.amount, balanceModal.method)
                }
              >
                {acting === balanceModal.booking.id ? "Saving..." : "Record payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {printData && (
        <ReceiptPrint
          booking={printData.booking}
          receiptId={printData.receiptId}
          printedBy={printData.printedBy}
          onAfterPrint={() => setPrintData(null)}
        />
      )}

      {deleteConfirmModal.open && (
        <div className="ad-modal-backdrop" onClick={() => setDeleteConfirmModal({ open: false, id: null, label: "", linkedPayments: 0 })}>
          <div className="ad-modal rounded-2xl border border-slate-700 bg-slate-900/95 p-0 shadow-2xl shadow-black/40" onClick={(e) => e.stopPropagation()}>
            <div className="ad-modal-header border-b border-slate-800 px-5 py-4">
              <div>
                <h3 className="text-lg font-black text-white">Delete Booking</h3>
              </div>
              <button className="ad-modal-close" onClick={() => setDeleteConfirmModal({ open: false, id: null, label: "", linkedPayments: 0 })}>✕</button>
            </div>
            <div className="ad-modal-form space-y-4 px-5 py-5">
              <p className="text-sm text-slate-300">
                Are you sure you want to permanently delete this booking for <strong className="text-white">{deleteConfirmModal.label}</strong>?
              </p>
              {deleteConfirmModal.linkedPayments > 0 && (
                <div className="p-3 mt-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                  <span className="font-bold uppercase block mb-1">Warning</span>
                  This will also remove {deleteConfirmModal.linkedPayments} linked payment record(s) associated with this booking.
                </div>
              )}
              <p className="text-xs text-red-400 font-semibold mt-2">This action cannot be undone.</p>
            </div>
            <div className="ad-modal-footer border-t border-slate-800 px-5 py-4 flex gap-2 justify-end">
              <button 
                type="button" 
                className="ad-btn ad-btn-outline" 
                onClick={() => setDeleteConfirmModal({ open: false, id: null, label: "", linkedPayments: 0 })}
                disabled={acting === deleteConfirmModal.id}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ad-btn bg-red-500 hover:bg-red-600 text-white border-red-500"
                disabled={acting === deleteConfirmModal.id}
                onClick={executeRemoveBooking}
              >
                {acting === deleteConfirmModal.id ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}