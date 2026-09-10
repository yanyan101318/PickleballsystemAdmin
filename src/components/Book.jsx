import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiGet, apiPost } from "../lib/api";

import "./book.css";

import { Link } from "react-router-dom";
import {
  Calendar, Clock, Users, ChevronRight, Check, Upload,
  Smartphone, AlertCircle, Package, User, FileText, X, Banknote,
} from "lucide-react";
import toast from "react-hot-toast";
import { format, addDays } from "date-fns";
import { roundMoney, parseCashAmount, parseAmountPaid } from "../lib/bookingMoney";
import { TIME_SLOTS, isSlotStartAvailableForDuration, calculateEndTime, isSlotWithinCourtHours, getEffectiveCourtStatus } from "../lib/bookingSlots";
import {
  PLAN_FULL,
  PLAN_PARTIAL,
  PLAN_LATER,
  resolveAmountPaid,
  resolveRemaining,
  resolveCustomerPayStatus,
} from "../lib/bookingPayment";
import { upsertCustomerAfterBooking } from "../lib/crm";
import BookingReceipt from "./BookingReceipt";
import ReceiptPrint from "./ReceiptPrint";
import RanawLogo from "./RanawLogo";
import { sendBookingSMS } from "../lib/smsService";
import { isRentalInventoryItem } from "../lib/inventoryItemTypes";
function isSlotInPast(dateStr, timeStr) {
  if (!dateStr || !timeStr) return false;
  const parts = timeStr.split(' ');
  if (parts.length !== 2) return false;
  const time = parts[0];
  const modifier = parts[1];
  let [hours, minutes] = time.split(':');
  if (hours === '12') hours = '00';
  if (modifier === 'PM' || modifier === 'pm') hours = parseInt(hours, 10) + 12;
  const hh = parseInt(hours, 10);
  const mm = parseInt(minutes, 10);

  const [yy, M, d] = dateStr.split('-');
  const slotDate = new Date(parseInt(yy, 10), parseInt(M, 10) - 1, parseInt(d, 10), hh, mm, 0);

  return slotDate < new Date();
}

function format24to12(time24) {
  if (!time24) return "";
  let [hh, mm] = time24.split(":");
  hh = parseInt(hh, 10);
  const ap = hh >= 12 ? "PM" : "AM";
  hh = hh % 12 || 12;
  const hhStr = String(hh).padStart(2, "0");
  return `${hhStr}:${mm} ${ap}`;
}

function deriveCourtKind(c) {
  const ams = Array.isArray(c.amenities) ? c.amenities : [];
  const joined = ams
    .map((x) => String(x).toLowerCase())
    .join(" ");
  if (joined.includes("indoor")) return "Indoor";
  if (joined.includes("outdoor")) return "Outdoor";
  return "Court";
}

const DURATIONS = [0.5, 1, 1.5, 2, 2.5, 3, "Custom"];

const PROMOS = [
  { code: "PICKLE10", discount: 0.1, label: "10% off" },
  { code: "NEWUSER", discount: 0.15, label: "15% off for new users" },
  { code: "MEMBER20", discount: 0.2, label: "20% member discount" },
];

const PAYMENT_GCASH = "gcash";
const PAYMENT_CASH = "cash";

async function sendSMSToCustomer(phoneNumber, bookingDetails) {
  if (!phoneNumber) return { success: false, error: "No phone number provided" };
  const message = `PICKLE BROS COURT: Your booking is confirmed for ${bookingDetails?.courtName || "your selected court"} on ${bookingDetails?.date || "your selected date"} at ${bookingDetails?.timeSlot || "your selected time"}.`;
  return sendBookingSMS(bookingDetails?.bookingId || "", phoneNumber, message);
}

export default function Book() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const adminMode = location.pathname.startsWith("/admin/");
  const [searchParams] = useSearchParams();
  const courtParam =
    searchParams.get("court") ||
    searchParams.get("courtId") ||
    searchParams.get("courtID") ||
    searchParams.get("courtid") ||
    searchParams.get("court_id") ||
    searchParams.get("id");
  const fileInputRef = useRef();

  /** Rental add-ons: prefer `price`, fall back to legacy inventory `pricePerHour`. */
  function getRentalItemPrice(item) {
    if (item?.type === 'rental') {
      return Number(item?.pricePerHour) || Number(item?.price_per_hour) || 0;
    }
    const p = Number(item?.price);
    if (p > 0) return p;
    return Number(item?.pricePerHour) || Number(item?.price_per_hour) || 0;
  }

  const [courts, setCourts] = useState([]);
  const [courtsReady, setCourtsReady] = useState(false);
  const [step, setStep] = useState(1);
  /** Same court + day: { id, timeSlot, duration, status } for overlap checks */
  const [dayBookings, setDayBookings] = useState([]);
  const [rentalAddOns, setRentalAddOns] = useState([]);
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [nameSuggestOpen, setNameSuggestOpen] = useState(false);
  const [debouncedPlayerName, setDebouncedPlayerName] = useState("");
  const nameSuggestRef = useRef(null);
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [paymentImg, setPaymentImg] = useState(null);
  const [paymentImgUrl, setPaymentImgUrl] = useState("");
  const [cashReceivedInput, setCashReceivedInput] = useState("");
  const [amountPaidInput, setAmountPaidInput] = useState("");
  const [receiptSnapshot, setReceiptSnapshot] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const wrapSync = async (p) => p;
    
  const [form, setForm] = useState({
    courtId: courtParam || "",
    courtIds: courtParam ? [courtParam] : [],
    date: format(addDays(new Date(), 1), "yyyy-MM-dd"),
    timeSlot: "",
    customStartTime: "",
    isCustomTime: false,
    duration: 1,
    customDuration: "",
    players: 2,
    equipment: [],
    notes: "",
    playerName: "",
    contactNumber: "",
    email: "",
    paymentMethod: PAYMENT_GCASH,
    paymentPlan: PLAN_FULL,
  });

  const actualDuration = form.duration === "Custom" ? Number(form.customDuration) || 1 : form.duration;
  const actualTimeSlot = form.isCustomTime ? format24to12(form.customStartTime) : form.timeSlot;
  const calculatedEndTime = (actualTimeSlot && actualDuration > 0) ? calculateEndTime(actualTimeSlot, actualDuration) : "";

  const activeCourts = useMemo(
    () => courts.filter((c) => getEffectiveCourtStatus(c)),
    [courts]
  );

  const court = useMemo(() => {
    if (!adminMode) {
      const raw = activeCourts.find((c) => c.id === form.courtId);
      if (!raw) return null;
      return {
        id: raw.id,
        name: raw.name || "Court",
        price: Number(raw.pricePerHour) || 0,
        type: deriveCourtKind(raw),
        activeStartTime: raw.activeStartTime,
        activeEndTime: raw.activeEndTime,
        rawCourt: raw,
      };
    } else {
      const selectedCourts = activeCourts.filter(c => (form.courtIds || []).includes(c.id));
      if (selectedCourts.length === 0) return null;
      return {
        id: selectedCourts.map(c => c.id).join(","),
        name: selectedCourts.map(c => c.name || "Court").join(", "),
        price: selectedCourts.reduce((sum, c) => sum + (Number(c.pricePerHour) || 0), 0),
        type: selectedCourts.map(c => deriveCourtKind(c)).join(", "),
        activeStartTime: selectedCourts[0].activeStartTime,
        activeEndTime: selectedCourts[0].activeEndTime,
        rawCourt: selectedCourts[0], // fallback for single-court logic
        allRawCourts: selectedCourts,
      };
    }
  }, [activeCourts, form.courtId, form.courtIds, adminMode]);

  
  useEffect(() => {
    async function loadCourts() {
      try {
        const res = await fetch("/api/courts");
        const list = await res.json();
        setCourts(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error(err);
      } finally {
        setCourtsReady(true);
      }
    }
    loadCourts();
  }, []);
  

  useEffect(() => {
    if (activeCourts.length === 0) return;
    setForm((f) => {
      if (adminMode) {
        if (f.courtIds && f.courtIds.length > 0) {
           const validIds = f.courtIds.filter(id => activeCourts.some(c => c.id === id));
           if (validIds.length === f.courtIds.length) return f;
           return { ...f, courtIds: validIds.length ? validIds : [activeCourts[0].id], timeSlot: "" };
        }
        return { ...f, courtIds: courtParam && activeCourts.some(c => c.id === courtParam) ? [courtParam] : [activeCourts[0].id], timeSlot: "" };
      } else {
        if (courtParam && activeCourts.some((c) => c.id === courtParam)) {
          if (f.courtId === courtParam) return f;
          return { ...f, courtId: courtParam, timeSlot: "" };
        }
        if (activeCourts.some((c) => c.id === f.courtId)) return f;
        return { ...f, courtId: activeCourts[0].id, timeSlot: "" };
      }
    });
  }, [activeCourts, courtParam, adminMode]);

  const loadDayBookings = useCallback(async (currentCourtId, currentDate, signal) => {
    if (!currentCourtId) return;
    console.log('Checking availability for Court(s):', currentCourtId);
    try {
      const res = await fetch(`/api/bookings?date=${currentDate}&courtId=${encodeURIComponent(currentCourtId)}`, { signal });
      const all = await res.json();
      const currentCourtIds = String(currentCourtId).split(",");
      const list = all.filter(b => {
        const bCourtId = String(b.courtId || b.court_id || b.courtID || "");
        const bCourtIds = bCourtId.split(",");
        const intersects = currentCourtIds.some(id => bCourtIds.includes(id));
        return intersects && ["pending", "approved", "reserved"].includes(String(b.status).toLowerCase());
      }).map(b => ({
        id: b.id,
        courtId: b.courtId || b.court_id || b.courtID || "",
        timeSlot: b.timeSlot,
        startTime: b.startTime || b.timeSlot,
        duration: Number(b.duration) || 1,
        status: b.status
      }));
      setDayBookings(list);
    } catch (err) {
      if (err.name !== "AbortError") {
        setDayBookings([]);
      }
    }
  }, []);

  useEffect(() => {
    if (!user) {
      if (!adminMode) navigate("/login");
      return;
    }
    const courtIdToLoad = adminMode ? (form.courtIds || []).join(",") : form.courtId;
    if (!courtIdToLoad) return;
    
    const abortController = new AbortController();
    loadDayBookings(courtIdToLoad, form.date, abortController.signal);
    
    return () => {
      abortController.abort();
    };
  }, [form.courtId, form.courtIds, form.date, user, adminMode, navigate, loadDayBookings]);

  /**
   * Real-time add-ons from `inventoryItems`.
   * Only rental-type inventory is exposed as booking add-ons.
   */
  useEffect(() => {
    async function loadCourts() {
      try {
        const res = await fetch("/api/courts");
        const list = await res.json();
        setCourts(list);
      } catch (err) {
        console.error(err);
      } finally {
        setCourtsReady(true);
      }
    }
    loadCourts();
  }, []);
  

  /** Debounce player name for API-backed prefix search (admin autocomplete). */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedPlayerName(String(form.playerName || "")), 300);
    return () => clearTimeout(t);
  }, [form.playerName]);

  /** API: customers by fullName + bookings by playerName, merged and deduped. */
  useEffect(() => {
    if (!adminMode) {
      setNameSuggestions([]);
      return;
    }
    const q = debouncedPlayerName.trim();
    if (q.length < 1) {
      setNameSuggestions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const names = await apiGet(`/api/customers/search?q=${encodeURIComponent(q)}`);
        if (!cancelled) setNameSuggestions(Array.isArray(names) ? names : []);
      } catch (e) {
        console.error(e);
        if (!cancelled) setNameSuggestions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminMode, debouncedPlayerName]);

  useEffect(() => {
    if (adminMode) return;
    if (profile?.name) setForm((f) => ({ ...f, playerName: profile.name }));
  }, [profile, adminMode]);

  useEffect(() => {
    async function loadRentalAddOns() {
      try {
        const res = await fetch("/api/equipment");
        const list = await res.json();
        setRentalAddOns((Array.isArray(list) ? list : []).filter(isRentalInventoryItem));
      } catch (err) {
        console.error(err);
        setRentalAddOns([]);
      }
    }

    loadRentalAddOns();
  }, []);

  /**
   * When duration changes or we load overlapping bookings from the API, clear an
   * impossible start time.
   */
  useEffect(() => {
    setForm((f) => {
      const actualD = f.duration === "Custom" ? Number(f.customDuration) || 1 : f.duration;
      if (f.isCustomTime) {
        if (!f.customStartTime) return f;
        const time12 = format24to12(f.customStartTime);
        if (isSlotStartAvailableForDuration(time12, actualD, dayBookings) && isSlotWithinCourtHours(time12, actualD, court)) return f;
        return { ...f, customStartTime: "" };
      } else {
        if (!f.timeSlot) return f;
        if (isSlotStartAvailableForDuration(f.timeSlot, actualD, dayBookings) && isSlotWithinCourtHours(f.timeSlot, actualD, court)) return f;
        return { ...f, timeSlot: "" };
      }
    });
  }, [form.duration, form.customDuration, form.isCustomTime, dayBookings]);

  /** Drop invalid add-on ids once we know the rental list (avoids clearing selection before snapshot). */
  useEffect(() => {
    if (rentalAddOns.length === 0) return;
    const ids = new Set(rentalAddOns.map((r) => r.id));
    setForm((f) => {
      const next = f.equipment.filter((id) => ids.has(id));
      if (next.length === f.equipment.length) return f;
      return { ...f, equipment: next };
    });
  }, [rentalAddOns]);

  const equipmentItems = useMemo(
    () => rentalAddOns.filter((e) => form.equipment.includes(e.id)),
    [rentalAddOns, form.equipment]
  );
  const equipmentTotal = useMemo(
    () => equipmentItems.reduce((s, e) => s + (getRentalItemPrice(e) * actualDuration), 0),
    [equipmentItems, actualDuration]
  );
  const courtTotal = (court?.price ?? 0) * actualDuration;
  const subtotal = courtTotal + equipmentTotal;
  const discount = appliedPromo ? subtotal * appliedPromo.discount : 0;
  const total = subtotal - discount;

  const partialPaidNum = useMemo(
    () => parseAmountPaid(amountPaidInput),
    [amountPaidInput]
  );
  const amountPaidNow = useMemo(
    () => resolveAmountPaid(form.paymentPlan, total, partialPaidNum),
    [form.paymentPlan, total, partialPaidNum]
  );
  const remainingBalance = useMemo(
    () => resolveRemaining(total, amountPaidNow),
    [total, amountPaidNow]
  );
  const customerPaymentStatus = useMemo(
    () => resolveCustomerPayStatus(form.paymentPlan, total, amountPaidNow),
    [form.paymentPlan, total, amountPaidNow]
  );
  const cashDueNow = useMemo(() => {
    if (form.paymentPlan === PLAN_LATER) return 0;
    return roundMoney(amountPaidNow);
  }, [form.paymentPlan, amountPaidNow]);
  const cashReceivedNum = useMemo(
    () => parseCashAmount(cashReceivedInput),
    [cashReceivedInput]
  );
  const cashChangeUi = useMemo(() => {
    if (form.paymentMethod !== PAYMENT_CASH || form.paymentPlan === PLAN_LATER) {
      return { text: "—", variant: "muted" };
    }
    const raw = String(cashReceivedInput ?? "").trim();
    if (raw === "") return { text: "—", variant: "muted" };
    if (!Number.isFinite(cashReceivedNum)) return { text: "—", variant: "muted" };
    if (cashReceivedNum < cashDueNow) return { text: "Insufficient", variant: "danger" };
    return { text: `₱${roundMoney(cashReceivedNum - cashDueNow).toFixed(2)}`, variant: "ok" };
  }, [form.paymentMethod, form.paymentPlan, cashReceivedInput, cashReceivedNum, cashDueNow]);

  const paymentReady = useMemo(() => {
    const amountDue = roundMoney(total);
    if (form.paymentPlan === PLAN_PARTIAL) {
      return Number.isFinite(partialPaidNum) && roundMoney(partialPaidNum) > 0 && roundMoney(partialPaidNum) < amountDue;
    }
    if (form.paymentMethod === PAYMENT_CASH && form.paymentPlan !== PLAN_LATER) {
      return Number.isFinite(cashReceivedNum) && roundMoney(cashReceivedNum) >= amountDue;
    }
    if (form.paymentMethod === PAYMENT_GCASH && form.paymentPlan !== PLAN_LATER) {
      return Boolean(paymentImgUrl || paymentImg);
    }
    return true;
  }, [cashReceivedNum, form.paymentMethod, form.paymentPlan, partialPaidNum, paymentImg, paymentImgUrl, total]);

  const toggleEquipment = (id) => {
    setForm((f) => ({
      ...f,
      equipment: f.equipment.includes(id) ? f.equipment.filter((e) => e !== id) : [...f.equipment, id],
    }));
  };

  const applyPromo = () => {
    const promo = PROMOS.find((p) => p.code === promoInput.toUpperCase());
    if (promo) { setAppliedPromo(promo); toast.success(`Promo applied: ${promo.label}`); }
    else toast.error("Invalid promo code");
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("File too large (max 5MB)"); return; }
    setPaymentImg(file);
    setPaymentImgUrl(URL.createObjectURL(file));
  };

  const selectPaymentMethod = (method) => {
    setForm((f) => ({ ...f, paymentMethod: method }));
    if (method === PAYMENT_CASH) {
      setPaymentImg(null);
      setPaymentImgUrl("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else {
      setCashReceivedInput("");
    }
  };

  const selectPaymentPlan = (plan) => {
    setForm((f) => ({ ...f, paymentPlan: plan }));
    if (plan !== PLAN_PARTIAL) setAmountPaidInput("");
    if (plan === PLAN_LATER) {
      setPaymentImg(null);
      setPaymentImgUrl("");
      setCashReceivedInput("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!court) return toast.error("Please select a court");
    if (!court.price || court.price <= 0) {
      return toast.error("This court has no hourly rate set. Ask admin to update court pricing.");
    }
    if (!actualTimeSlot) return toast.error("Please select a time slot");
    if (!form.playerName) return toast.error("Player name is required");
    if (!String(form.contactNumber ?? "").trim()) {
      toast.error("Contact number is required");
      return;
    }

    const paidNow = resolveAmountPaid(form.paymentPlan, total, partialPaidNum);
    if (form.paymentPlan === PLAN_PARTIAL) {
      if (!Number.isFinite(partialPaidNum) || roundMoney(partialPaidNum) <= 0) {
        toast.error("Enter a valid down payment amount");
        return;
      }
      if (roundMoney(partialPaidNum) >= roundMoney(total)) {
        toast.error("Down payment must be less than the total");
        return;
      }
    }

    const needGcashProof = form.paymentMethod === PAYMENT_GCASH && paidNow > 0;
    if (needGcashProof && !paymentImg) {
      toast.error("Please upload your GCash receipt");
      return;
    }

    if (form.paymentMethod === PAYMENT_CASH && form.paymentPlan !== PLAN_LATER) {
      const raw = String(cashReceivedInput ?? "").trim();
      if (raw === "") return toast.error("Please enter cash received");
      if (!Number.isFinite(cashReceivedNum)) return toast.error("Enter a valid cash amount");
      if (roundMoney(cashReceivedNum) < roundMoney(cashDueNow)) {
        return toast.error("Cash received is less than the amount due now");
      }
    }

    setIsSubmitting(true);

    try {
      // Re-check overlaps against latest data so two admins cannot double-book the same range.
      const bookingRes = await apiGet(`/api/bookings?courtId=${encodeURIComponent(form.courtId)}&date=${encodeURIComponent(form.date)}`);
      const latestDay = (Array.isArray(bookingRes) ? bookingRes : []).filter((b) =>
        ["pending", "approved", "Pending", "Approved"].includes(String(b.status || "").toLowerCase())
      ).map((b) => ({
        id: b.id,
        timeSlot: b.timeSlot,
        startTime: b.startTime || b.timeSlot,
        duration: Number(b.duration) || 1,
        status: b.status,
      }));
      if (!isSlotStartAvailableForDuration(actualTimeSlot, actualDuration, latestDay)) {
        setDayBookings(latestDay);
        toast.error("That time is no longer available. Please choose another slot.");
        return;
      }
      if (!isSlotWithinCourtHours(actualTimeSlot, actualDuration, court)) {
        toast.error(`The selected time is outside the court's operating hours (${court.activeStartTime || "06:00"} - ${court.activeEndTime || "22:00"}).`);
        return;
      }
      if (court && court.rawCourt && !getEffectiveCourtStatus(court.rawCourt)) {
        toast.error("This court is currently unavailable for rent.");
        return;
      }

      let receiptUrl = null;
      if (needGcashProof && paymentImg) {
        receiptUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = () => reject(new Error("Could not read receipt file"));
          reader.readAsDataURL(paymentImg);
        });
      }

      const amountPaidRounded = roundMoney(paidNow);
      const remainingRounded = resolveRemaining(total, amountPaidRounded);
      const payStatus = resolveCustomerPayStatus(form.paymentPlan, total, amountPaidRounded);

      const cashReceivedRounded =
        form.paymentMethod === PAYMENT_CASH && form.paymentPlan !== PLAN_LATER
          ? roundMoney(cashReceivedNum)
          : null;
      const changeRounded =
        form.paymentMethod === PAYMENT_CASH && form.paymentPlan !== PLAN_LATER
          ? roundMoney(cashReceivedNum - cashDueNow)
          : null;

      const bookingBase = {
        courtId: adminMode ? (form.courtIds || []).join(",") : form.courtId,
        courtName: court.name,
        date: form.date,
        timeSlot: actualTimeSlot,
        startTime: actualTimeSlot,
        endTime: calculatedEndTime,
        duration: actualDuration,
        players: form.players,
        equipment: form.equipment,
        notes: form.notes,
        playerName: form.playerName,
        contactNumber: String(form.contactNumber).trim(),
        email: String(form.email ?? "").trim() || null,
        userId: user.uid,
        status: form.paymentMethod === PAYMENT_CASH ? "Approved" : (adminMode ? "Reserved" : "Pending"),
        createdAt: new Date().toISOString(),
        promoCode: appliedPromo?.code || null,
        paymentMethod: form.paymentMethod,
        paymentPlan: form.paymentPlan,
        hourlyRate: roundMoney(court.price),
        totalAmount: roundMoney(total),
        amountPaid: amountPaidRounded,
        remainingBalance: remainingRounded,
        customerPaymentStatus: payStatus,
      };

      const bookingData =
        form.paymentMethod === PAYMENT_GCASH
          ? { ...bookingBase, receiptUrl: receiptUrl || null }
          : {
            ...bookingBase,
            receiptUrl: null,
            cashReceived: cashReceivedRounded,
            change: changeRounded,
          };

      const paymentBase = {
        bookingId: null,
        userId: user.uid,
        name: form.playerName,
        courtId: adminMode ? (form.courtIds || []).join(",") : form.courtId,
        courtName: court.name,
        date: form.date,
        timeSlot: actualTimeSlot,
        startTime: actualTimeSlot,
        endTime: calculatedEndTime,
        amount: roundMoney(total),
        totalAmount: roundMoney(total),
        amountPaid: amountPaidRounded,
        remainingBalance: remainingRounded,
        paymentPlan: form.paymentPlan,
        customerPaymentStatus: payStatus,
        method: form.paymentMethod,
        paymentStatus: form.paymentMethod === PAYMENT_CASH ? "Approved" : "Pending",
        promoCode: appliedPromo?.code || null,
        discount,
        createdAt: new Date().toISOString(),
      };

      const paymentData =
        form.paymentMethod === PAYMENT_GCASH
          ? { ...paymentBase, paymentImageUrl: receiptUrl || null }
          : {
            ...paymentBase,
            paymentImageUrl: null,
            cashReceived: cashReceivedRounded,
            change: changeRounded,
          };

      const payloadToSend = {
        booking: bookingData,
        payment: paymentData,
        customer: {
          userId: user.uid,
          fullName: form.playerName,
          contactNumber: String(form.contactNumber).trim(),
          email: String(form.email ?? "").trim() || null,
          amountApplied: amountPaidRounded,
        },
      };
      console.log("=== FRONTEND BOOKING PAYLOAD ===");
      console.log("Booking keys:", Object.keys(bookingData).sort());
      console.log("Payment keys:", Object.keys(paymentData).sort());
      console.log("Full payload:", JSON.stringify(payloadToSend, null, 2));

      // --- FRONTEND SANITIZATION FOR POSTGRES ---
      // Create a deep copy of the payload to avoid mutating original state
      const cleanPayload = {
        booking: { ...payloadToSend.booking },
        payment: { ...payloadToSend.payment },
        customer: { ...payloadToSend.customer }
      };

      // EXPLICITLY DELETE fields that do not exist as columns in the Postgres bookings/payments tables
      // This prevents Postgres "undefined column" or "datatype mismatch" errors
      delete cleanPayload.booking.equipment;       // Postgres crashes if it receives [] for a text/varchar column
      delete cleanPayload.booking.cashReceived;    // Not a column in bookings table (only in payments)
      delete cleanPayload.booking.change;          // Not a column in bookings table (only in payments)
      
      delete cleanPayload.payment.cashReceived;    // Not a standard payment column
      delete cleanPayload.payment.change;          // Not a standard payment column
      delete cleanPayload.payment.bookingId;       // Let the backend generate and assign this

      // Also convert any nulls to undefined so Postgres uses its DEFAULT values instead of throwing null constraint errors
      Object.keys(cleanPayload.booking).forEach(key => {
        if (cleanPayload.booking[key] === null) delete cleanPayload.booking[key];
      });
      Object.keys(cleanPayload.payment).forEach(key => {
        if (cleanPayload.payment[key] === null) delete cleanPayload.payment[key];
      });
      Object.keys(cleanPayload.customer).forEach(key => {
        if (cleanPayload.customer[key] === null) delete cleanPayload.customer[key];
      });
      // ------------------------------------------

      console.log("=== CLEAN PAYLOAD FOR POSTGRES ===");
      console.log("Booking keys after sanitization:", Object.keys(cleanPayload.booking).sort());
      console.log("Payment keys after sanitization:", Object.keys(cleanPayload.payment).sort());
      console.log("Clean payload:", JSON.stringify(cleanPayload, null, 2));

      const result = await wrapSync(apiPost("/api/bookings/with-payment", cleanPayload), {
        successMsg: "PICKLE BROS COURT booking confirmed successfully",
        offlineMsg: "Saved Offline — Will Sync Automatically",
        errorMsg: "Booking Failed — Retry",
      });

      const bookingId = result?.bookingId || result?.id || null;
      window.dispatchEvent(new CustomEvent("bookings:updated"));

      if (String(form.contactNumber).trim()) {
        try {
          await sendSMSToCustomer(String(form.contactNumber).trim(), {
            bookingId,
            courtName: court.name,
            date: form.date,
            timeSlot: actualTimeSlot,
          });
        } catch (e) {
          console.error("Failed to send customer booking SMS:", e);
        }
      }

      const paymentMethodLabel = form.paymentMethod === PAYMENT_CASH ? "Cash" : "GCash";
      const paymentPlanLabel =
        form.paymentPlan === PLAN_FULL ? "Full payment" :
          form.paymentPlan === PLAN_PARTIAL ? "Down payment" : "Pay later";

      setReceiptSnapshot({
        booking: { ...bookingData, id: bookingId },
        transactionId: bookingId,
        date: form.date,
        timeSlot: form.timeSlot,
        courtName: court.name,
        duration: form.duration,
        playerName: form.playerName,
        paymentMethodLabel,
        paymentPlanLabel,
        totalAmount: roundMoney(total),
        amountPaid: amountPaidRounded,
        remainingBalance: remainingRounded,
        change:
          form.paymentMethod === PAYMENT_CASH && form.paymentPlan !== PLAN_LATER ? changeRounded : null,
        customerPayStatus: payStatus,
      });
      setIsPrinting(true);
      setStep(4);

    } catch (err) {
      console.error(err);
      toast.error("Booking Failed — Retry");
    } finally {
      setIsSubmitting(false);
    }
  };

  const minDate = format(new Date(), "yyyy-MM-dd");
  const maxDate = format(addDays(new Date(), 90), "yyyy-MM-dd");

  if (step === 4 && receiptSnapshot) {
    return (
      <div
        className={
          adminMode
            ? "hero-bg flex items-center justify-center px-4 py-10 rounded-2xl border border-slate-800"
            : "min-h-screen hero-bg flex items-center justify-center px-4 pt-20 pb-12"
        }
      >
        <div className="max-w-lg w-full space-y-6">
          <div className="card p-6 sm:p-8 text-center">
            <div className="w-16 h-16 bg-green-500/20 border-2 border-green-500 rounded-full flex items-center justify-center mx-auto mb-4 glow-green">
              <Check size={30} className="text-green-400" />
            </div>
            <h2 className="font-display text-2xl sm:text-3xl tracking-wider text-white mb-2">BOOKING SUBMITTED</h2>
            <p className="text-slate-400 text-sm">Pending staff approval. Save your receipt below.</p>
          </div>
          <div className="card p-6 sm:p-8">
            <BookingReceipt receipt={receiptSnapshot} />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => setIsPrinting(true)}
              className="btn-primary flex-1 text-sm py-3"
              style={{ background: "var(--pickle)", color: "#000", border: "none" }}
            >
              Print Receipt
            </button>
            <button
              type="button"
              onClick={() => navigate(adminMode ? "/admin/bookings" : "/bookings")}
              className="btn-secondary flex-1 text-sm py-3"
            >
              {adminMode ? "View all bookings" : "View My Bookings"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setReceiptSnapshot(null);
                setPaymentImg(null);
                setPaymentImgUrl("");
                setCashReceivedInput("");
                setAmountPaidInput("");
                if (fileInputRef.current) fileInputRef.current.value = "";
                setForm((f) => ({
                  ...f,
                  paymentMethod: PAYMENT_GCASH,
                  paymentPlan: PLAN_FULL,
                  contactNumber: "",
                  email: "",
                  ...(adminMode ? { playerName: "" } : {}),
                }));
              }}
              className="btn-secondary flex-1 text-sm py-3"
            >
              Book another
            </button>
          </div>
        </div>

        {isPrinting && (
          <ReceiptPrint
            booking={receiptSnapshot.booking}
            receiptId={"RCPT-" + receiptSnapshot.transactionId.substring(0, 5).toUpperCase() + "-" + Math.floor(100 + Math.random() * 900)}
            printedBy={adminMode ? "Admin" : "Customer"}
            onAfterPrint={() => setIsPrinting(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className={adminMode ? "book-page--embedded" : "min-h-screen"}>
      <div
        className={
          adminMode ? "court-pattern pt-4 pb-10 px-2 sm:px-4" : "min-h-screen court-pattern pt-12 sm:pt-20 pb-8 sm:pb-12 px-3 sm:px-4"
        }
      >
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8 pt-2 sm:pt-4 px-2">
            <RanawLogo variant="auth" className="mb-3 sm:mb-4 mx-auto !max-w-[160px] sm:!max-w-[200px]" />
            <h1 className="font-display text-2xl sm:text-4xl tracking-wider text-white">BOOK A <span className="gradient-text">COURT</span></h1>
            <p className="text-slate-500 mt-1 text-xs sm:text-sm">Complete all steps to confirm your reservation</p>
          </div>

          {/* Steps */}
          <div className="flex items-center justify-center gap-2 mb-10">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${step > s ? "bg-green-500 text-slate-950" :
                    step === s ? "bg-green-500/20 border-2 border-green-500 text-green-400" :
                      "bg-slate-800 text-slate-600"
                  }`}>
                  {step > s ? <Check size={16} /> : s}
                </div>
                <span className={`text-sm font-medium hidden sm:block ${step >= s ? "text-white" : "text-slate-600"}`}>
                  {s === 1 ? "Court & Schedule" : s === 2 ? "Add-ons" : "Payment"}
                </span>
                {s < 3 && <ChevronRight size={16} className="text-slate-700 mx-1" />}
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-5">

              {/* Step 1 */}
              {step === 1 && (
                <>
                  {/* Court Selection */}
                  <div className="card p-6">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <Calendar size={18} className="text-green-400" /> Select Court
                    </h3>
                    {!courtsReady ? (
                      <div className="flex items-center justify-center gap-2 py-12 text-slate-400 text-sm">
                        <svg className="animate-spin w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                        </svg>
                        Loading courts…
                      </div>
                    ) : activeCourts.length === 0 ? (
                      <div className="text-center py-10 border border-dashed border-slate-700 rounded-xl">
                        <p className="text-slate-400 text-sm mb-3">No active courts available yet.</p>
                        {adminMode ? (
                          <Link
                            to="/admin/courts"
                            className="inline-flex items-center gap-1 text-cyan-400 text-sm font-semibold hover:underline"
                          >
                            Add courts in Court Management →
                          </Link>
                        ) : (
                          <p className="text-slate-500 text-xs">Ask your facility admin to add courts.</p>
                        )}
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-3">
                        {activeCourts.map((c) => {
                          const kind = deriveCourtKind(c);
                          const price = Number(c.pricePerHour) || 0;
                          const kindClass =
                            kind === "Indoor"
                              ? "bg-blue-500/20 text-blue-400"
                              : kind === "Outdoor"
                                ? "bg-orange-500/20 text-orange-400"
                                : "bg-slate-500/20 text-slate-400";
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                if (adminMode) {
                                  setForm((f) => {
                                    const ids = f.courtIds || [];
                                    if (ids.includes(c.id)) {
                                      if (ids.length === 1) return f;
                                      return { ...f, courtIds: ids.filter(id => id !== c.id), timeSlot: "" };
                                    }
                                    return { ...f, courtIds: [...ids, c.id], timeSlot: "" };
                                  });
                                } else {
                                  setForm({ ...form, courtId: c.id, timeSlot: "" });
                                }
                              }}
                              className={`p-4 rounded-xl border text-left transition-all ${
                                adminMode 
                                  ? (form.courtIds || []).includes(c.id) ? "border-green-500 bg-green-500/10" : "border-slate-700 bg-slate-800 hover:border-slate-600"
                                  : form.courtId === c.id ? "border-green-500 bg-green-500/10" : "border-slate-700 bg-slate-800 hover:border-slate-600"
                                }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-white font-medium text-sm">{c.name}</span>
                                {(adminMode ? (form.courtIds || []).includes(c.id) : form.courtId === c.id) && <Check size={14} className="text-green-400" />}
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${kindClass}`}>
                                {kind}
                              </span>
                              <div className="text-green-400 font-semibold mt-2">
                                ₱{price.toLocaleString()}
                                <span className="text-slate-500 text-xs font-normal">/hr</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Player Info */}
                  <div className="card p-6">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <User size={18} className="text-green-400" /> Player Information
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className={adminMode ? "sm:col-span-2" : ""}>
                        <label className="label">Player Name</label>
                        <div className={adminMode ? "relative" : undefined}>
                          <input
                            type="text"
                            required
                            className="input-field"
                            placeholder="Full name"
                            autoComplete={adminMode ? "off" : "name"}
                            value={form.playerName}
                            onChange={(e) => {
                              setForm({ ...form, playerName: e.target.value });
                              if (adminMode) setNameSuggestOpen(true);
                            }}
                            onFocus={() => adminMode && setNameSuggestOpen(true)}
                            onBlur={() => {
                              if (!adminMode) return;
                              setTimeout(() => {
                                if (!nameSuggestRef.current?.contains(document.activeElement)) {
                                  setNameSuggestOpen(false);
                                }
                              }, 150);
                            }}
                          />
                          {adminMode && nameSuggestOpen && nameSuggestions.length > 0 && (
                            <ul
                              ref={nameSuggestRef}
                              className="book-name-suggestions absolute left-0 right-0 top-full z-[300] mt-1.5 max-h-48 overflow-y-auto rounded-lg py-1"
                              role="listbox"
                            >
                              {nameSuggestions.map((name) => (
                                <li
                                  key={name}
                                  role="option"
                                  aria-selected={form.playerName.trim() === name.trim()}
                                >
                                  <button
                                    type="button"
                                    className="book-name-suggestions__item w-full text-left px-3 py-2.5 text-sm font-medium"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                      setForm((f) => ({ ...f, playerName: name }));
                                      setNameSuggestOpen(false);
                                    }}
                                  >
                                    {name}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="label">Number of Players</label>
                        <select
                          className="input-field"
                          value={form.players}
                          onChange={(e) => setForm({ ...form, players: Number(e.target.value) })}
                        >
                          {[1, 2, 3, 4].map((n) => (
                            <option key={n} value={n}>{n} {n === 1 ? "player" : "players"}</option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="label">Contact number *</label>
                        <input
                          type="tel"
                          className="input-field"
                          placeholder="09XX XXX XXXX"
                          value={form.contactNumber}
                          onChange={(e) => setForm({ ...form, contactNumber: e.target.value })}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="label">Email (optional)</label>
                        <input
                          type="email"
                          className="input-field"
                          placeholder="you@example.com"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Date & Time */}
                  <div className="card p-6">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <Clock size={18} className="text-green-400" /> Date & Time
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-4 mb-5">
                      <div>
                        <label className="label">Date</label>
                        <input
                          type="date"
                          className="input-field"
                          min={minDate}
                          max={maxDate}
                          value={form.date}
                          onChange={(e) => setForm({ ...form, date: e.target.value, timeSlot: "", customStartTime: "" })}
                        />
                      </div>
                      <div>
                        <label className="label">Duration</label>
                        <div className="flex gap-2">
                          <select
                            className="input-field"
                            value={form.duration}
                            onChange={(e) => setForm({ ...form, duration: e.target.value === "Custom" ? "Custom" : Number(e.target.value) })}
                          >
                            {DURATIONS.map((d) => (
                              <option key={d} value={d}>{d} {d === 1 ? "hour" : (d === "Custom" ? "" : "hours")}</option>
                            ))}
                          </select>
                          {form.duration === "Custom" && (
                            <input
                              type="number"
                              step="0.25"
                              min="0.25"
                              className="input-field w-24"
                              placeholder="Hours"
                              value={form.customDuration}
                              onChange={(e) => setForm({ ...form, customDuration: e.target.value })}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mb-2">
                      <label className="label mb-0">Start Time</label>
                      {adminMode && (
                        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.isCustomTime}
                            onChange={(e) => setForm({ ...form, isCustomTime: e.target.checked, timeSlot: "", customStartTime: "" })}
                            className="rounded border-slate-700 bg-slate-800 text-green-500 focus:ring-green-500"
                          />
                          Custom Time
                        </label>
                      )}
                    </div>
                    
                    {form.isCustomTime ? (
                      <div className="mb-4">
                        <input
                          type="time"
                          className="input-field max-w-[200px]"
                          value={form.customStartTime}
                          onChange={(e) => setForm({ ...form, customStartTime: e.target.value })}
                        />
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {TIME_SLOTS.map((slot) => {
                            const inPast = isSlotInPast(form.date, slot);
                            const exactBooked = dayBookings.some((b) => (b.startTime || b.timeSlot) === slot);
                            const isTaken = !inPast && !isSlotStartAvailableForDuration(
                              slot,
                              actualDuration,
                              dayBookings
                            );
                            const outOfHours = !isSlotWithinCourtHours(slot, actualDuration, court);
                            const isOverlap = isTaken && !exactBooked;
                            const isUnavailable = inPast || isTaken || outOfHours;

                            return (
                              <button
                                key={slot}
                                type="button"
                                disabled={isUnavailable}
                                onClick={() => setForm({ ...form, timeSlot: slot })}
                                className={`py-2.5 px-3 rounded-xl text-xs font-medium transition-all ${isUnavailable ? "bg-red-500/10 border border-red-500/20 text-red-400/50 cursor-not-allowed" :
                                    form.timeSlot === slot ? "bg-green-500 text-slate-950 glow-green" :
                                      "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700"
                                  }`}
                              >
                                {slot}
                                {exactBooked && <div className="text-[10px] leading-tight mt-0.5">Booked</div>}
                                {isOverlap && !exactBooked && <div className="text-[10px] leading-tight mt-0.5">Conflicts</div>}
                                {inPast && <div className="text-[10px] leading-tight mt-0.5">Not Available</div>}
                              </button>
                            );
                          })}
                        </div>
                        <div className="text-xs text-slate-500 mt-3">
                          <p>Booked = exact slot start is reserved. Conflicts = this start time would overlap an existing booking for the selected duration.</p>
                        </div>
                      </>
                    )}

                    {calculatedEndTime && (
                      <div className="mt-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700 flex items-center gap-2">
                        <Clock size={16} className="text-cyan-400" />
                        <span className="text-slate-300 text-sm">Calculated End Time:</span>
                        <strong className="text-white">{calculatedEndTime}</strong>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="card p-6">
                    <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <FileText size={18} className="text-green-400" /> Special Notes (Optional)
                    </h3>
                    <textarea
                      rows={3}
                      className="input-field resize-none"
                      placeholder="Any special requests, skill level, purpose of booking..."
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    />
                  </div>
                </>
              )}

              {/* Step 2 - Equipment */}
              {step === 2 && (
                <div className="card p-6">
                  <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                    <Package size={18} className="text-green-400" /> Equipment Rental Add-ons
                  </h3>
                  <p className="text-slate-500 text-sm mb-5">Optional extras to enhance your session</p>
                  <div className="space-y-3">
                    {rentalAddOns.length === 0 ? (
                      <p className="text-slate-500 text-sm py-4 text-center border border-dashed border-slate-700 rounded-xl">
                        No add-ons available yet. Add priced inventory items (or set type to "rental").
                      </p>
                    ) : (
                      rentalAddOns.map((item) => {
                        const price = getRentalItemPrice(item);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggleEquipment(item.id)}
                            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${form.equipment.includes(item.id)
                                ? "border-green-500 bg-green-500/10"
                                : "border-slate-700 bg-slate-800 hover:border-slate-600"
                              }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <Package className="text-slate-400 shrink-0" size={28} strokeWidth={1.5} />
                              <div className="text-left min-w-0">
                                <div className="text-white font-medium truncate">{item.name || "Rental"}</div>
                                <div className="text-slate-500 text-sm">₱{price.toLocaleString()}/hr</div>
                              </div>
                            </div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${form.equipment.includes(item.id) ? "border-green-500 bg-green-500" : "border-slate-600"
                              }`}>
                              {form.equipment.includes(item.id) && <Check size={12} className="text-slate-950" />}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Promo Code */}
                  <div className="mt-6 border-t border-slate-800 pt-5">
                    <label className="label">Promo Code</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="input-field flex-1"
                        placeholder="Enter code (e.g. PICKLE10)"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      />
                      <button onClick={applyPromo} className="btn-secondary px-4 py-2 text-sm whitespace-nowrap">
                        Apply
                      </button>
                    </div>
                    {appliedPromo && (
                      <div className="flex items-center gap-2 mt-2 text-green-400 text-sm">
                        <Check size={14} /> {appliedPromo.label} applied!
                      </div>
                    )}
                    <p className="text-slate-600 text-xs mt-2">Try: PICKLE10, NEWUSER, MEMBER20</p>
                  </div>
                </div>
              )}

              {/* Step 3 - Payment */}
              {step === 3 && (
                <div className="card p-6">
                  <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                    <Smartphone size={18} className="text-green-400" /> Payment
                  </h3>
                  <p className="text-slate-500 text-sm mb-5">Plan, method, and proof</p>

                  <label className="label">Payment plan</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-6">
                    {[
                      { id: PLAN_FULL, label: "Full payment" },
                      { id: PLAN_PARTIAL, label: "Down payment" },
                      { id: PLAN_LATER, label: "Pay later" },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectPaymentPlan(p.id)}
                        className={`rounded-xl border py-3 px-2 text-xs font-semibold transition-all ${form.paymentPlan === p.id
                            ? "border-cyan-500 bg-cyan-500/15 text-cyan-300"
                            : "border-slate-700 bg-slate-800/80 text-slate-400 hover:border-slate-600"
                          }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {form.paymentPlan === PLAN_PARTIAL && (
                    <div className="mb-6">
                      <label className="label">Amount paying now *</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="input-field"
                        placeholder="0.00"
                        value={amountPaidInput}
                        onChange={(e) => setAmountPaidInput(e.target.value)}
                      />
                      <p className="text-slate-500 text-xs mt-1">
                        Balance after: <strong className="text-amber-400">₱{remainingBalance.toFixed(2)}</strong>
                      </p>
                    </div>
                  )}

                  <label className="label">Payment method</label>
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <button
                      type="button"
                      onClick={() => selectPaymentMethod(PAYMENT_GCASH)}
                      className={`flex items-center justify-center gap-2 rounded-xl border py-3.5 px-3 text-sm font-semibold min-h-[48px] transition-all ${form.paymentMethod === PAYMENT_GCASH
                          ? "border-green-500 bg-green-500/15 text-green-400"
                          : "border-slate-700 bg-slate-800/80 text-slate-400"
                        }`}
                    >
                      <Smartphone size={18} /> GCash
                    </button>
                    <button
                      type="button"
                      onClick={() => selectPaymentMethod(PAYMENT_CASH)}
                      className={`flex items-center justify-center gap-2 rounded-xl border py-3.5 px-3 text-sm font-semibold min-h-[48px] transition-all ${form.paymentMethod === PAYMENT_CASH
                          ? "border-amber-500 bg-amber-500/15 text-amber-400"
                          : "border-slate-700 bg-slate-800/80 text-slate-400"
                        }`}
                    >
                      <Banknote size={18} /> Cash
                    </button>
                  </div>

                  <div
                    className={`transition-[max-height,opacity] duration-300 overflow-hidden ${form.paymentMethod === PAYMENT_GCASH ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
                      }`}
                    aria-hidden={form.paymentMethod !== PAYMENT_GCASH}
                  >
                    {form.paymentMethod === PAYMENT_GCASH && (
                      <>
                        <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-5 mb-5">
                          <div className="flex items-start gap-3">
                            <AlertCircle size={18} className="text-green-400 mt-0.5 shrink-0" />
                            <div className="text-sm">
                              <p className="text-white font-medium mb-1">GCash instructions</p>
                              {amountPaidNow <= 0 ? (
                                <p className="text-slate-400">No GCash transfer needed for pay later.</p>
                              ) : (
                                <ol className="text-slate-400 space-y-1 list-decimal list-inside">
                                  <li>Open GCash on your phone</li>
                                  <li>
                                    Send <strong className="text-green-400">₱{amountPaidNow.toFixed(2)}</strong> to:{" "}
                                    <strong className="text-white">09XX-XXX-XXXX</strong>
                                  </li>
                                  <li>Account Name: <strong className="text-white">PickleZone Inc.</strong></li>
                                  <li>Screenshot the receipt and upload below</li>
                                </ol>
                              )}
                            </div>
                          </div>
                        </div>
                        {amountPaidNow > 0 && (
                          <>
                            <label className="label">Upload GCash receipt *</label>
                            <div
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  fileInputRef.current?.click();
                                }
                              }}
                              onClick={() => fileInputRef.current?.click()}
                              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer ${paymentImgUrl ? "border-green-500 bg-green-500/5" : "border-slate-700 hover:border-slate-500"
                                }`}
                            >
                              {paymentImgUrl ? (
                                <div>
                                  <img src={paymentImgUrl} alt="Receipt" className="max-h-40 mx-auto rounded-lg mb-3 object-contain" />
                                  <p className="text-green-400 text-sm font-medium flex items-center justify-center gap-1">
                                    <Check size={14} /> Receipt uploaded
                                  </p>
                                </div>
                              ) : (
                                <div>
                                  <Upload size={32} className="text-slate-600 mx-auto mb-2" />
                                  <p className="text-slate-400 text-sm">Upload GCash screenshot</p>
                                </div>
                              )}
                              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                            </div>
                            {paymentImgUrl && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPaymentImg(null);
                                  setPaymentImgUrl("");
                                  if (fileInputRef.current) fileInputRef.current.value = "";
                                }}
                                className="mt-2 text-red-400 hover:text-red-300 text-xs flex items-center gap-1"
                              >
                                <X size={12} /> Remove image
                              </button>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>

                  <div
                    className={`transition-[max-height,opacity] duration-300 overflow-hidden ${form.paymentMethod === PAYMENT_CASH ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
                      }`}
                    aria-hidden={form.paymentMethod !== PAYMENT_CASH}
                  >
                    {form.paymentMethod === PAYMENT_CASH && (
                      <div className="space-y-5">
                        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5">
                          <p className="text-white font-medium text-sm mb-1">Cash</p>
                          <p className="text-slate-300 text-sm">
                            {form.paymentPlan === PLAN_LATER
                              ? "You will pay in cash at the facility before play."
                              : `Bring cash — amount due now: ₱${cashDueNow.toFixed(2)} (total booking ₱${total.toFixed(2)})`}
                          </p>
                        </div>
                        {form.paymentPlan !== PLAN_LATER && (
                          <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                              <label className="label">Cash received *</label>
                              <div className="relative">
                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"></span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  className="input-field pl-8"
                                  placeholder="0.00"
                                  value={cashReceivedInput}
                                  onChange={(e) => setCashReceivedInput(e.target.value)}
                                />
                              </div>
                            </div>
                            <div>
                              <label className="label">Change</label>
                              <div
                                className={`input-field flex items-center min-h-[42px] cursor-default ${cashChangeUi.variant === "danger"
                                    ? "text-red-400 border-red-500/30 bg-red-500/5"
                                    : cashChangeUi.variant === "ok"
                                      ? "text-emerald-400"
                                      : "text-slate-500"
                                  }`}
                              >
                                {cashChangeUi.text}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Nav Buttons */}
              <div className="flex gap-3">
                {step > 1 && (
                  <button onClick={() => setStep(step - 1)} className="btn-secondary flex-1 py-3">
                    ← Back
                  </button>
                )}
                {step < 3 ? (
                  <button
                    onClick={() => {
                      if (step === 1 && !form.timeSlot) return toast.error("Please select a time slot");
                      if (step === 1 && !form.playerName) return toast.error("Player name is required");
                      if (step === 1 && !String(form.contactNumber ?? "").trim()) {
                        return toast.error("Contact number is required");
                      }
                      setStep(step + 1);
                    }}
                    className="btn-primary flex-1 py-3 flex items-center justify-center gap-2"
                  >
                    Continue <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={!paymentReady || isSubmitting}
                    className="btn-primary flex-1 py-3 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                        </svg>
                        Processing Booking...
                      </span>
                    ) : (
                      <><Check size={16} /> Confirm Booking</>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Summary Sidebar */}
            <div className="space-y-4">
              <div className="card p-5 sticky top-24">
                <h3 className="text-white font-semibold mb-4 text-sm">Booking Summary</h3>

                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-slate-500 text-xs mb-1">Court</div>
                    <div className="text-white font-medium">{court?.name ?? "—"}</div>
                    {court && (
                      <div className="flex gap-2 mt-1">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${court.type === "Indoor"
                              ? "bg-blue-500/20 text-blue-400"
                              : court.type === "Outdoor"
                                ? "bg-orange-500/20 text-orange-400"
                                : "bg-slate-500/20 text-slate-400"
                            }`}
                        >
                          {court.type}
                        </span>
                      </div>
                    )}
                  </div>

                  {form.date && (
                    <div>
                      <div className="text-slate-500 text-xs mb-1">Date & Time</div>
                      <div className="text-white">{form.date}</div>
                      <div className="text-green-400">{form.timeSlot || "Not selected"}</div>
                      <div className="text-slate-400 text-xs">{form.duration} {form.duration === 1 ? "hour" : "hours"}</div>
                    </div>
                  )}

                  <div>
                    <div className="text-slate-500 text-xs mb-1">Players</div>
                    <div className="text-white flex items-center gap-1">
                      <Users size={13} /> {form.players}
                    </div>
                  </div>

                  {form.playerName && (
                    <div>
                      <div className="text-slate-500 text-xs mb-1">Player Name</div>
                      <div className="text-white">{form.playerName}</div>
                    </div>
                  )}

                  {equipmentItems.length > 0 && (
                    <div>
                      <div className="text-slate-500 text-xs mb-1">Equipment</div>
                      {equipmentItems.map((e) => (
                        <div key={e.id} className="flex justify-between text-slate-300 text-xs gap-2">
                          <span className="truncate">{e.name}</span>
                          <span className="shrink-0">₱{getRentalItemPrice(e).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-800 mt-4 pt-4 space-y-2 text-sm">
                  <div className="flex justify-between text-slate-400">
                    <span>Court ({form.duration}hr)</span>
                    <span>₱{courtTotal}</span>
                  </div>
                  {equipmentTotal > 0 && (
                    <div className="flex justify-between text-slate-400">
                      <span>Equipment</span>
                      <span>₱{equipmentTotal}</span>
                    </div>
                  )}
                  {discount > 0 && (
                    <div className="flex justify-between text-green-400">
                      <span>Promo ({appliedPromo?.code})</span>
                      <span>-₱{discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-white font-semibold text-base pt-2 border-t border-slate-800">
                    <span>Total</span>
                    <span className="text-green-400">₱{total.toFixed(2)}</span>
                  </div>
                </div>

                {step === 3 && (
                  <div className="mt-4 space-y-2 text-xs border-t border-slate-800 pt-4">
                    <div className="flex justify-between text-slate-400">
                      <span>Paying now</span>
                      <span className="text-white">₱{amountPaidNow.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Balance</span>
                      <span className="text-amber-400">₱{remainingBalance.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Status</span>
                      <span className="text-slate-200 capitalize">{customerPaymentStatus}</span>
                    </div>
                  </div>
                )}
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <p className="text-blue-400 text-xs">
                    {form.paymentPlan === PLAN_LATER
                      ? "💡 Pay later: settle at the desk before your slot."
                      : form.paymentMethod === PAYMENT_CASH
                        ? "💡 Cash: pay at facility; booking stays pending until approved."
                        : "💡 GCash: pending until staff confirms your transfer."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}