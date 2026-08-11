// src/admin/InventoryPage.jsx
import { useState, useEffect, useMemo, useCallback } from "react";

import { useOfflineSync } from "../hooks/useOfflineSync";

import Pagination from "./Pagination";
import toast from "react-hot-toast";
import { format } from "date-fns";
import {
  getReportRange,
  tsToDate,
  isOverdueActive,
  filterRentsByRentedAtRange,
  aggregateMostRented,
  filterOverdueInRange,
  isRentRecordActive,
  computeRentalCharge,
  computeOverdueFine,
  computeLateHours,
  roundMoney,
  getRentScheduledRentalCharge,
  getRentBillableRentalHours,
  getRentRentalCaption,
} from "./inventoryHelpers";
import { downloadEquipmentInventoryPdf } from "../lib/adminPdfReports";
import { normalizeInventoryItemType, displayInventoryItemType, isRentalInventoryItem, isSaleInventoryItem } from "../lib/inventoryItemTypes";
import EquipmentSaleReceipt from "../components/EquipmentSaleReceipt";

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
  const res = await fetch(`/api/${ref.collectionName === "borrowRecords" ? "borrow-records" : "equipment"}/${encodeURIComponent(ref.id)}`);
  if (!res.ok) return { exists: () => false, data: () => ({}) };
  const data = await res.json();
  return { exists: () => true, data: () => data };
};
const updateDoc = async (ref, data) => {
  const res = await fetch(`/api/${ref.collectionName === "borrowRecords" ? "borrow-records" : "equipment"}/${encodeURIComponent(ref.id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Update failed");
  window.dispatchEvent(new Event("refresh-inventory"));
};
const deleteDoc = async (ref) => {
  const res = await fetch(`/api/${ref.collectionName === "borrowRecords" ? "borrow-records" : "equipment"}/${encodeURIComponent(ref.id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Delete failed");
  window.dispatchEvent(new Event("refresh-inventory"));
};
const addDoc = async (collectionRef, data) => {
  const res = await fetch(`/api/${collectionRef.collectionName === "borrowRecords" ? "borrow-records" : "equipment"}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Create failed");
  const payload = await res.json().catch(() => ({}));
  window.dispatchEvent(new Event("refresh-inventory"));
  return { id: payload.id || "" };
};
const onSnapshot = (queryRef, _options, callback) => {
  const collectionName = queryRef?.collectionName;
  const load = async () => {
    if (collectionName === "borrowRecords") {
      const res = await fetch("/api/borrow-records");
      const rows = res.ok ? await res.json() : [];
      callback({ docs: rows.map((row) => ({ id: row.id, data: () => row, metadata: { hasPendingWrites: false } })) });
      return;
    }
    if (collectionName === "salesTransactions") {
      const res = await fetch("/api/sales-transactions");
      const rows = res.ok ? await res.json() : [];
      callback({ docs: rows.map((row) => ({ id: row.id, data: () => row, metadata: { hasPendingWrites: false } })) });
      return;
    }
    const res = await fetch("/api/equipment");
    const rows = res.ok ? await res.json() : [];
    callback({ docs: rows.map((row) => ({ id: row.id, data: () => row, metadata: { hasPendingWrites: false } })) });
  };
  load();
  window.addEventListener("refresh-inventory", load);
  return () => window.removeEventListener("refresh-inventory", load);
};
const writeBatch = () => {
  const ops = [];
  return {
    set(ref, data) { ops.push({ type: "set", ref, data }); },
    update(ref, data) { ops.push({ type: "update", ref, data }); },
    async commit() {
      for (const op of ops) {
        if (op.type === "set") await addDoc(collection(db, op.ref.collectionName), op.data);
        else await updateDoc(op.ref, op.data);
      }
    },
  };
};
const increment = (value) => value;

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "catalog", label: "Catalog" },
  { id: "selling", label: "Sell" },
  { id: "borrowing", label: "Renting" },
  { id: "reports", label: "Reports" },
];

const REPORT_PERIODS = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

const BLANK_ITEM = {
  name: "",
  category: "",
  notes: "",
  totalQty: "",
  pricePerHour: "",
  price: "",
  overdueFinePerHour: "",
  itemType: "rental",
};

function RentBillableHoursCell({ rent }) {
  const total = getRentBillableRentalHours(rent);
  const initial = Number(rent.hoursInitial) || 0;
  const ext = Math.max(0, total - initial);
  return (
    <td className="text-sm align-top whitespace-nowrap">
      <span className="font-mono text-[var(--ad-text)]">{total}h</span>
      {ext > 0 ? (
        <span className="block text-[10px] text-[var(--ad-muted)]">
          {initial}h + {ext}h ext
        </span>
      ) : (
        <span className="block text-[10px] text-[var(--ad-muted)]"></span>
      )}
    </td>
  );
}

function RentRentalCell({ rent }) {
  const amt = getRentScheduledRentalCharge(rent);
  const cap = getRentRentalCaption(rent);
  return (
    <td className="text-right align-top">
      <div className="text-xs font-mono text-emerald-400">₱{amt.toFixed(2)}</div>
      {cap && (
        <p className="text-[10px] text-[var(--ad-muted)] leading-snug mt-0.5 max-w-[240px] ml-auto">
          {cap}
        </p>
      )}
    </td>
  );
}

export default function InventoryPage() {
  const [tab, setTab] = useState("dashboard");
  const [items, setItems] = useState([]);
  const [rents, setRents] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination: one state per table
  const PAGE_SIZE = 10;
  const [dashRentPage, setDashRentPage] = useState(1);
  const [catalogPage, setCatalogPage] = useState(1);
  const [activeRentPage, setActiveRentPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [saleHistoryPage, setSaleHistoryPage] = useState(1);

  function handleTabChange(t) { setTab(t); setDashRentPage(1); setCatalogPage(1); setActiveRentPage(1); setHistoryPage(1); setSaleHistoryPage(1); }

  const [itemModal, setItemModal] = useState(null);
  const [itemForm, setItemForm] = useState(BLANK_ITEM);
  const { syncState, wrapSync } = useOfflineSync();

  const [renterName, setRenterName] = useState("");
  const [rentHours, setRentHours] = useState(2);
  const [rentLines, setRentLines] = useState([{ itemId: "", quantity: 1 }]);
  const [rentCourt, setRentCourt] = useState("");
  const [rentContact, setRentContact] = useState("");
  const [courts, setCourts] = useState([]);

  const [buyerName, setBuyerName] = useState("");
  const [saleLines, setSaleLines] = useState([{ itemId: "", quantity: 1 }]);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [saleReceipt, setSaleReceipt] = useState(null);

  const [extendModal, setExtendModal] = useState(null);
  const [returnModal, setReturnModal] = useState(null);
  const [extendHours, setExtendHours] = useState(1);

  const [reportPeriod, setReportPeriod] = useState("weekly");

  useEffect(() => {
    fetch("/api/courts").then(res => res.json()).then(data => setCourts(data || [])).catch(console.error);

    const qi = query(collection(db, "inventoryItems"), orderBy("name", "asc"));
    const unsubI = onSnapshot(
      qi,
      { includeMetadataChanges: true },
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, hasPendingWrites: d.metadata.hasPendingWrites, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );
    const qb = query(collection(db, "borrowRecords"), orderBy("borrowedAt", "desc"));
    const unsubB = onSnapshot(qb, { includeMetadataChanges: true }, (snap) => {
      setRents(snap.docs.map((d) => ({ id: d.id, hasPendingWrites: d.metadata.hasPendingWrites, ...d.data() })));
    });
    const qs = query(collection(db, "salesTransactions"), orderBy("createdAt", "desc"));
    const unsubS = onSnapshot(qs, { includeMetadataChanges: true }, (snap) => {
      setSales(snap.docs.map((d) => ({ id: d.id, hasPendingWrites: d.metadata.hasPendingWrites, ...d.data() })));
    });
    return () => {
      unsubI();
      unsubB();
      unsubS();
    };
  }, []);

  const itemsById = useMemo(() => {
    const m = {};
    for (const it of items) m[it.id] = it;
    return m;
  }, [items]);

  const rentPreviewLines = useMemo(() => {
    return rentLines
      .filter((l) => l.itemId)
      .map((l) => ({
        quantity: Math.max(1, Math.floor(Number(l.quantity) || 1)),
        pricePerHour: Number(itemsById[l.itemId]?.pricePerHour) || 0,
        overdueFinePerHour: Number(itemsById[l.itemId]?.overdueFinePerHour) || 0,
      }));
  }, [rentLines, itemsById]);

  const borrowPreviewRental = useMemo(
    () => computeRentalCharge(rentPreviewLines, rentHours),
    [rentPreviewLines, rentHours]
  );

  const activeBorrows = useMemo(
    () => rents.filter(isRentRecordActive),
    [rents]
  );

  const overdueList = useMemo(
    () => activeBorrows.filter((b) => isOverdueActive(b)),
    [activeBorrows]
  );

  const stats = useMemo(() => {
    const totalSkus = items.length;
    const availableUnits = items.reduce((s, i) => s + (Number(i.availableQty) || 0), 0);
    return {
      totalSkus,
      availableUnits,
      activeCount: activeBorrows.length,
      overdueCount: overdueList.length,
    };
  }, [items, activeBorrows.length, overdueList.length]);

  const salePreviewLines = useMemo(() => {
    return saleLines
      .filter((l) => l.itemId)
      .map((l) => ({
        quantity: Math.max(1, Math.floor(Number(l.quantity) || 1)),
        price: Number(itemsById[l.itemId]?.price) || 0,
      }));
  }, [saleLines, itemsById]);

  const salePreviewTotal = useMemo(
    () => salePreviewLines.reduce((sum, line) => sum + line.price * line.quantity, 0),
    [salePreviewLines]
  );

  const nameById = useMemo(() => {
    const m = {};
    for (const it of items) m[it.id] = it.name;
    return m;
  }, [items]);

  const reportRange = useMemo(
    () => getReportRange(reportPeriod, new Date()),
    [reportPeriod]
  );

  const reportFilteredSales = useMemo(() => {
    return sales.filter((s) => {
      const dt = tsToDate(s.createdAt);
      return dt && dt >= reportRange.start && dt <= reportRange.end;
    });
  }, [sales, reportRange]);

  const reportFilteredBorrows = useMemo(
    () => filterRentsByRentedAtRange(rents, reportRange.start, reportRange.end),
    [rents, reportRange]
  );

  const mostBorrowedReport = useMemo(
    () => aggregateMostRented(reportFilteredBorrows, nameById),
    [reportFilteredBorrows, nameById]
  );

  const overdueInReportPeriod = useMemo(
    () => filterOverdueInRange(rents, reportRange.start, reportRange.end),
    [rents, reportRange]
  );

  const hasActiveBorrowForItem = useCallback(
    (itemId) =>
      activeBorrows.some((b) => (b.items || []).some((l) => l.itemId === itemId)),
    [activeBorrows]
  );

  function openNewItem() {
    setItemForm(BLANK_ITEM);
    setItemModal("new");
  }

  function openEditItem(it) {
    setItemForm({
      name: it.name || "",
      category: it.category || "",
      notes: it.notes || "",
      totalQty: String(it.totalQty ?? 0),
      pricePerHour: it.pricePerHour != null ? String(it.pricePerHour) : "",
      price: it.price != null ? String(it.price) : "",
      overdueFinePerHour: it.overdueFinePerHour != null ? String(it.overdueFinePerHour) : "",
      itemType: normalizeInventoryItemType(it.type || it.itemType),
    });
    setItemModal(it.id);
  }

  async function saveItem(e) {
    e.preventDefault();
    const name = itemForm.name.trim();
    const total = Math.max(0, Math.floor(Number(itemForm.totalQty) || 0));
    const itemType = normalizeInventoryItemType(itemForm.itemType);
    const pricePerHour = itemType === "sale" ? 0 : Math.max(0, Number(itemForm.pricePerHour) || 0);
    const price = itemType === "rental" ? 0 : Math.max(0, Number(itemForm.price) || 0);
    const overdueFinePerHour = itemType === "rental" || itemType === "both" ? Math.max(0, Number(itemForm.overdueFinePerHour) || 0) : 0;

    if (!name) {
      toast.error("Name is required");
      return;
    }
    if (itemType !== "rental" && !price) {
      toast.error("Price is required for sale items");
      return;
    }
    if ((itemType === "rental" || itemType === "both") && !pricePerHour) {
      toast.error("Rental price is required for rental items");
      return;
    }

    try {
      let promise;
      if (itemModal === "new") {
        promise = addDoc(collection(db, "inventoryItems"), {
          name,
          category: itemForm.category.trim(),
          notes: itemForm.notes.trim(),
          totalQty: total,
          availableQty: total,
          pricePerHour,
          price,
          overdueFinePerHour,
          type: itemType,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const ref = doc(db, "inventoryItems", itemModal);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error("Missing item");
        const cur = snap.data();
        const oldT = Number(cur.totalQty) || 0;
        const oldA = Number(cur.availableQty) || 0;
        const onLoan = oldT - oldA;
        const newTotal = total;
        if (newTotal < onLoan) {
          toast.error(`Total must be at least ${onLoan} (currently on loan).`);
          return;
        }
        const newAvailable = newTotal - onLoan;
        promise = updateDoc(ref, {
          name,
          category: itemForm.category.trim(),
          notes: itemForm.notes.trim(),
          totalQty: newTotal,
          availableQty: newAvailable,
          pricePerHour,
          price,
          overdueFinePerHour,
          type: itemType,
          updatedAt: serverTimestamp(),
        });
      }

      await wrapSync(promise, {
        successMsg: itemModal === "new" ? "Item added" : "Item updated",
        offlineMsg: "Equipment Changes Saved Offline",
        errorMsg: "Could not save item"
      });

      setItemModal(null);
    } catch (err) {
      console.error(err);
    }
  }

  async function removeItem(it) {
    if (hasActiveBorrowForItem(it.id)) {
      toast.error("Return all active rents for this item before deleting.");
      return;
    }
    if (!window.confirm(`Delete “${it.name}”?`)) return;
    try {
      await wrapSync(deleteDoc(doc(db, "inventoryItems", it.id)), {
        successMsg: "Item removed",
        offlineMsg: "Action Queued for Sync",
        errorMsg: "Delete failed"
      });
    } catch (err) {
      console.error(err);
    }
  }

  function addBorrowLine() {
    setRentLines((lines) => [...lines, { itemId: "", quantity: 1 }]);
  }

  function setBorrowLine(i, k, v) {
    setRentLines((lines) => {
      const next = [...lines];
      next[i] = { ...next[i], [k]: v };
      return next;
    });
  }

  function removeBorrowLine(i) {
    setRentLines((lines) => lines.filter((_, j) => j !== i));
  }

  async function submitBorrow(e) {
    e.preventDefault();
    const name = renterName.trim();
    if (!name) {
      toast.error("Borrower name is required");
      return;
    }
    const hours = Math.max(0.5, Number(rentHours) || 0);
    const lines = rentLines
      .filter((l) => l.itemId)
      .map((l) => {
        const stock = itemsById[l.itemId];
        const qty = Math.max(1, Math.floor(Number(l.quantity) || 1));
        return {
          itemId: l.itemId,
          itemName: stock?.name || "Item",
          quantity: qty,
          pricePerHour: Number(stock?.pricePerHour) || 0,
          overdueFinePerHour: Number(stock?.overdueFinePerHour) || 0,
        };
      });
    if (!lines.length) {
      toast.error("Select at least one item");
      return;
    }

    for (const l of lines) {
      const stock = itemsById[l.itemId];
      if (!stock || (Number(stock.availableQty) || 0) < l.quantity) {
        toast.error(`Not enough stock for “${stock?.name || "item"}”.`);
        return;
      }
    }

    try {
      const now = Date.now();
      const expectedMs = now + hours * 3600 * 1000;
      const estimatedRentalCharge = computeRentalCharge(lines, hours);

      await wrapSync(
        fetch("/api/equipment/borrow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName: name,
            items: lines,
            hoursInitial: hours,
            estimatedRentalCharge,
            contactNumber: rentContact,
            court: rentCourt,
            status: "borrowed"
          })
        }).then(res => {
          if (!res.ok) throw new Error("Borrow failed");
          return res.json();
        }),
        {
          successMsg: "Rent recorded",
          offlineMsg: "Borrow Saved Offline — Pending Server Sync",
          errorMsg: "Borrow failed — check server rules and stock."
        }
      );

      setRenterName("");
      setRentHours(2);
      setRentLines([{ itemId: "", quantity: 1 }]);
      setRentContact("");
      setRentCourt("");
    } catch (err) {
      console.error(err);
    }
  }

  async function returnBorrow(b) {
    const ref = doc(db, "borrowRecords", b.id);
    let snap;
    try {
      snap = await getDoc(ref);
    } catch (e) {
      console.error(e);
      toast.error("Could not load rent record");
      return;
    }
    if (!snap.exists()) return;
    const data = snap.data();
    const actualTs = new Date();
    const lateH = computeLateHours(data.expectedReturnAt, actualTs.getTime());
    const lines = data.items || [];
    const rentalCharge = getRentScheduledRentalCharge(data);
    const overdueCharge = computeOverdueFine(lines, lateH);
    const totalCharge = roundMoney(rentalCharge + overdueCharge);

    setReturnModal({
      id: b.id,
      renterName: data.customerName || data.borrowerName,
      rentalCharge,
      lateH,
      overdueCharge,
      totalCharge,
      cashReceived: ""
    });
  }

  async function applyReturn() {
    if (!returnModal) return;
    try {
      await wrapSync(
        fetch("/api/equipment/return", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: returnModal.id, totalCharge: returnModal.totalCharge, overdueCharge: returnModal.overdueCharge, lateHours: roundMoney(returnModal.lateH) })
        }).then(res => {
          if (!res.ok) throw new Error("Return failed");
          return res.json();
        }),
        {
          successMsg: returnModal.overdueCharge > 0
            ? `Returned — total due $${returnModal.totalCharge.toFixed(2)} (incl. overdue)`
            : "Items returned — stock updated",
          offlineMsg: "Return Action Saved Offline — Pending Server Sync",
          errorMsg: "Return failed"
        }
      );
      setReturnModal(null);
    } catch (err) {
      console.error(err);
    }
  }

  function addSaleLine() {
    setSaleLines((lines) => [...lines, { itemId: "", quantity: 1 }]);
  }

  function setSaleLine(i, k, v) {
    setSaleLines((lines) => {
      const next = [...lines];
      next[i] = { ...next[i], [k]: v };
      return next;
    });
  }

  function removeSaleLine(i) {
    setSaleLines((lines) => lines.filter((_, j) => j !== i));
  }

  async function submitSale(e) {
    e.preventDefault();
    const name = buyerName.trim();
    if (!name) {
      toast.error("Buyer name is required");
      return;
    }
    const lines = saleLines
      .filter((l) => l.itemId)
      .map((l) => {
        const stock = itemsById[l.itemId];
        const qty = Math.max(1, Math.floor(Number(l.quantity) || 1));
        return {
          itemId: l.itemId,
          itemName: stock?.name || "Item",
          quantity: qty,
          price: Number(stock?.price) || 0,
        };
      });
    if (!lines.length) {
      toast.error("Select at least one item");
      return;
    }

    for (const l of lines) {
      const stock = itemsById[l.itemId];
      if (!stock || (Number(stock.availableQty) || 0) < l.quantity) {
        toast.error(`Not enough stock for "${stock?.name || "item"}".`);
        return;
      }
    }

    try {
      let responseData;
      await wrapSync(
        fetch("/api/equipment/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            buyerName: name,
            items: lines,
            paymentMethod,
          }),
        }).then((res) => {
          if (!res.ok) throw new Error("Sale failed");
          return res.json();
        }).then((data) => {
          responseData = data;
          return data;
        }),
        {
          successMsg: `Sale recorded — ₱${salePreviewTotal.toFixed(2)}`,
          offlineMsg: "Sale Saved Offline — Pending Server Sync",
          errorMsg: "Sale failed — check server and stock."
        }
      );

      // Set receipt data for printing
      if (responseData) {
        setSaleReceipt({
          transactionId: responseData.id,
          buyerName: name,
          items: lines,
          total: salePreviewTotal,
          paymentMethod,
          createdAt: new Date().toISOString(),
        });
      }

      // Clear form after a delay
      setTimeout(() => {
        setBuyerName("");
        setSaleLines([{ itemId: "", quantity: 1 }]);
        setPaymentMethod("Cash");
        setSaleReceipt(null);
      }, 2000);
    } catch (err) {
      console.error(err);
    }
  }

  async function applyExtension() {
    if (!extendModal) return;
    const hours = Math.max(0.5, Number(extendHours) || 0);
    try {
      const ref = doc(db, "borrowRecords", extendModal.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const data = snap.data();
      const prevExp = data.expectedReturnAt;
      const prevMs = tsToDate(prevExp)?.getTime() ?? Date.now();
      const newMs = prevMs + hours * 3600 * 1000;
      const lines = data.items || [];
      const extraRental = computeRentalCharge(lines, hours);
      const baseRental = getRentScheduledRentalCharge(data);
      const entry = {
        at: Timestamp.now(),
        previousExpectedReturn: prevExp,
        newExpectedReturn: Timestamp.fromMillis(newMs),
        addedHours: hours,
        extraRentalCharge: extraRental,
      };
      const hist = [...(data.extensionHistory || []), entry];

      const promise = fetch("/api/equipment/extend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: extendModal.id,
          expectedReturnAt: newMs,
          extensionHistory: hist,
          estimatedRentalCharge: roundMoney(baseRental + extraRental)
        })
      }).then(res => {
        if (!res.ok) throw new Error("Extend failed");
        return res.json();
      });

      await wrapSync(promise, {
        successMsg: "Renting time extended",
        offlineMsg: "Extension Saved Offline",
        errorMsg: "Extension failed"
      });

      setExtendModal(null);
      setExtendHours(1);
    } catch (err) {
      console.error(err);
    }
  }

  if (loading) {
    return (
      <div className="ad-loading">
        <div className="ad-spinner" />
      </div>
    );
  }

  return (
    <div className="ad-page">
      <div className="ad-page-header flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="ad-page-title">Equipment</h1>
          <p className="ad-page-sub">
            Rental catalog, rents, and overdue tracking for paddles, balls, and other gear.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            className="ad-btn ad-btn-outline ad-btn-sm"
            onClick={() => {
              downloadEquipmentInventoryPdf({ items, stats });
              toast.success("PDF report downloaded.");
            }}
          >
            Save PDF report
          </button>
        </div>
      </div>

      <div className="ad-filter-tabs flex-wrap mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`ad-filter-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => handleTabChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <section className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatMini label="SKU count" value={stats.totalSkus} tone="slate" icon="inventory_2" />
            <StatMini label="Available units" value={stats.availableUnits} tone="emerald" icon="check_circle" />
            <StatMini label="Active rents" value={stats.activeCount} tone="sky" icon="schedule" />
            <StatMini label="Overdue" value={stats.overdueCount} tone="amber" icon="warning" />
          </div>

          <div className="ad-card overflow-hidden">
            <div className="ad-card-header">
              <h3 className="ad-card-title">Currently borrowed</h3>
              <span className="text-xs text-[var(--ad-muted)]">{activeBorrows.length} active</span>
            </div>
            <div className="p-0">
              {activeBorrows.length === 0 ? (
                <p className="p-6 text-sm text-[var(--ad-muted)] text-center">No active rents.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="ad-table">
                    <thead>
                      <tr>
                        <th>Borrower</th>
                        <th>Items</th>
                        <th>Borrowed</th>
                        <th>Due back</th>
                        <th className="text-right whitespace-nowrap" title="Initial + extension hours used in rent">
                          Hours
                        </th>
                        <th className="text-right">Rental</th>
                        <th className="text-right">Overdue est.</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {activeBorrows.slice((dashRentPage - 1) * PAGE_SIZE, dashRentPage * PAGE_SIZE).map((b) => (
                        <tr key={b.id}>
                          <td className="ad-td-main font-semibold">
                            <div className="flex items-center gap-2">
                              {b.borrowerName}
                              {b.hasPendingWrites && <span className="ad-badge ad-badge-pending text-[10px] px-1 py-0 border border-amber-500/20">Pending Sync</span>}
                            </div>
                          </td>
                          <td className="text-sm">
                            {(b.items || [])
                              .map((l) => `${l.itemName} ×${l.quantity}`)
                              .join(", ")}
                          </td>
                          <td className="text-sm whitespace-nowrap">
                            {format(tsToDate(b.borrowedAt) || new Date(), "MMM d, h:mm a")}
                          </td>
                          <td className="text-sm whitespace-nowrap">
                            <span
                              className={
                                isOverdueActive(b) ? "text-amber-400 font-semibold" : "text-[var(--ad-text)]"
                              }
                            >
                              {format(tsToDate(b.expectedReturnAt) || new Date(), "MMM d, h:mm a")}
                            </span>
                            {isOverdueActive(b) && (
                              <span className="ml-1 text-[10px] uppercase text-amber-500">overdue</span>
                            )}
                          </td>
                          <RentBillableHoursCell rent={b} />
                          <RentRentalCell rent={b} />
                          <td className="text-right text-xs font-mono">
                            {isOverdueActive(b)
                              ? `₱${computeOverdueFine(b.items || [], computeLateHours(b.expectedReturnAt)).toFixed(2)}`
                              : "—"}
                          </td>
                          <td className="text-right whitespace-nowrap">
                            <button
                              type="button"
                              className="ad-btn ad-btn-sm ad-btn-outline mr-1"
                              onClick={() => {
                                setExtendModal(b);
                                setExtendHours(1);
                              }}
                            >
                              Extend
                            </button>
                            <button
                              type="button"
                              className="ad-btn ad-btn-sm ad-btn-success"
                              onClick={() => returnBorrow(b)}
                              disabled={syncState !== "idle" && syncState !== "error"}
                            >
                              Return
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Pagination
                page={dashRentPage}
                totalPages={Math.max(1, Math.ceil(activeBorrows.length / PAGE_SIZE))}
                onPage={setDashRentPage}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="ad-card p-4">
              <h4 className="text-sm font-bold text-[var(--ad-text)] mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400 text-lg">error</span>
                Overdue ({overdueList.length})
              </h4>
              {overdueList.length === 0 ? (
                <p className="text-xs text-[var(--ad-muted)]">Nothing overdue right now.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {overdueList.map((b) => (
                    <li
                      key={b.id}
                      className="flex flex-col sm:flex-row sm:justify-between gap-1 border border-[var(--ad-border)] rounded-lg p-2 bg-[var(--ad-surface)]"
                    >
                      <span>{b.borrowerName}</span>
                      <span className="text-amber-400 text-xs">
                        due {format(tsToDate(b.expectedReturnAt) || new Date(), "MMM d, h:mm a")} · fine est. ₱
                        {computeOverdueFine(b.items || [], computeLateHours(b.expectedReturnAt)).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="ad-card p-4">
              <h4 className="text-sm font-bold text-[var(--ad-text)] mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-lg">bar_chart</span>
                Stock snapshot
              </h4>
              <ul className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar text-sm">
                {items.length === 0 ? (
                  <li className="text-xs text-[var(--ad-muted)]">Add items under Catalog.</li>
                ) : (
                  items.map((it) => (
                    <li key={it.id} className="flex justify-between gap-2">
                      <span className="truncate">{it.name}</span>
                      <span className="text-emerald-400 font-mono shrink-0">
                        {it.availableQty ?? 0} / {it.totalQty ?? 0}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </section>
      )}

      {tab === "selling" && (
        <section className="grid lg:grid-cols-1 gap-6">
          <div className="ad-card p-4 sm:p-6">
            <h3 className="text-base font-bold text-[var(--ad-text)] mb-4">New sale</h3>
            <form onSubmit={submitSale} className="space-y-4 max-w-2xl">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="af-group">
                  <label className="af-label">Buyer / account name *</label>
                  <input
                    className="af-input"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="Customer name"
                    required
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="af-label mb-0">Items</label>
                  <button type="button" className="text-xs text-[var(--ad-pickle)] font-semibold" onClick={addSaleLine}>
                    + Add line
                  </button>
                </div>
                <div className="space-y-2">
                  {saleLines.map((line, i) => (
                    <div key={i} className="flex flex-wrap gap-2 items-end">
                      <select
                        className="af-input flex-1 min-w-[160px]"
                        value={line.itemId}
                        onChange={(e) => setSaleLine(i, "itemId", e.target.value)}
                      >
                        <option value="">Select item...</option>
                        {items.filter((it) => isSaleInventoryItem(it)).map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name} ({it.availableQty ?? 0} avail.) · ₱{Number(it.price || 0).toFixed(0)}
                          </option>
                        ))}
                      </select>
                      <input
                        className="af-input w-24"
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => setSaleLine(i, "quantity", e.target.value)}
                      />
                      {saleLines.length > 1 && (
                        <button
                          type="button"
                          className="ad-btn ad-btn-sm ad-btn-outline"
                          onClick={() => removeSaleLine(i)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="af-group">
                  <label className="af-label">Payment method</label>
                  <select
                    className="af-input"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="Cash">Cash</option>
                    <option value="GCash">GCash</option>
                    <option value="Card">Card</option>
                    <option value="Check">Check</option>
                  </select>
                </div>
              </div>
              <div className="rounded-xl border border-[var(--ad-border)] bg-[var(--ad-surface)] p-4 max-w-lg">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ad-muted)]">
                  Estimated total
                </div>
                <div className="text-2xl font-black text-[var(--ad-pickle)] mt-1">
                  ₱{salePreviewTotal.toFixed(2)}
                </div>
                <div className="mt-3 space-y-1.5 border-t border-[var(--ad-border)] pt-3">
                  {saleLines
                    .map((line, idx) => ({ line, idx }))
                    .filter(({ line }) => line.itemId)
                    .map(({ line, idx }) => {
                      const stock = itemsById[line.itemId];
                      const name = stock?.name ?? "Item";
                      const q = Math.max(1, Math.floor(Number(line.quantity) || 1));
                      const p = Number(stock?.price) || 0;
                      const sub = q * p;
                      return (
                        <div
                          key={`${line.itemId}-${idx}`}
                          className="flex flex-wrap justify-between gap-2 text-[11px]"
                        >
                          <span className="text-[var(--ad-muted)]">{name}</span>
                          <span className="font-mono text-[var(--ad-text)]">
                            {q}*₱{p.toFixed(2)} = ₱{sub.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  {salePreviewLines.length === 0 && (
                    <p className="text-[11px] text-[var(--ad-muted)]">Select items and quantities to see the breakdown.</p>
                  )}
                </div>
              </div>
              <button type="submit" className="ad-btn ad-btn-primary" disabled={syncState !== "idle" && syncState !== "error"}>
                {syncState === "syncing" ? "Saving..." : syncState === "offline-saved" ? "Saved Offline" : "Record sale"}
              </button>
            </form>
          </div>
        </section>
      )}

      {tab === "catalog" && (
        <section>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-[var(--ad-muted)]">Manage equipment SKUs and on-hand quantities.</p>
            <button type="button" className="ad-btn ad-btn-primary" onClick={openNewItem}>
              + Add item
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Rental Equipment */}
            <div className="ad-card overflow-hidden">
              <div className="ad-card-header">
                <h3 className="ad-card-title">Rental Equipment</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="ad-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Available</th>
                      <th>Total</th>
                      <th className="text-right">Rent ₱/hr</th>
                      <th className="text-right">Fine ₱/hr</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {items.filter((it) => isRentalInventoryItem(it)).length === 0 && (
                      <tr>
                        <td colSpan={6} className="ad-empty">
                          No rental items yet.
                        </td>
                      </tr>
                    )}
                    {items
                      .filter((it) => isRentalInventoryItem(it))
                      .map((it) => (
                        <tr key={it.id}>
                          <td className="ad-td-main">
                            <div className="flex items-center gap-2">
                              {it.name}
                              {it.hasPendingWrites && <span className="ad-badge ad-badge-pending text-[10px] px-1 py-0 border border-amber-500/20">Pending Sync</span>}
                            </div>
                          </td>
                          <td className="font-mono text-emerald-400">{it.availableQty ?? 0}</td>
                          <td className="font-mono">{it.totalQty ?? 0}</td>
                          <td className="text-right font-mono text-sm">₱{(Number(it.pricePerHour) || 0).toFixed(2)}</td>
                          <td className="text-right font-mono text-sm text-amber-400/90">₱{(Number(it.overdueFinePerHour) || 0).toFixed(2)}</td>
                          <td className="text-right whitespace-nowrap space-x-1">
                            <button type="button" className="ad-btn ad-btn-sm ad-btn-outline" onClick={() => openEditItem(it)}>
                              Edit
                            </button>
                            <button type="button" className="ad-btn ad-btn-sm ad-btn-danger" onClick={() => removeItem(it)} disabled={syncState !== "idle" && syncState !== "error"}>
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sale Equipment */}
            <div className="ad-card overflow-hidden">
              <div className="ad-card-header">
                <h3 className="ad-card-title">Sale Equipment</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="ad-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Available</th>
                      <th>Total</th>
                      <th className="text-right">Price ₱</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {items.filter((it) => isSaleInventoryItem(it)).length === 0 && (
                      <tr>
                        <td colSpan={5} className="ad-empty">
                          No sale items yet.
                        </td>
                      </tr>
                    )}
                    {items
                      .filter((it) => isSaleInventoryItem(it))
                      .map((it) => (
                        <tr key={it.id}>
                          <td className="ad-td-main">
                            <div className="flex items-center gap-2">
                              {it.name}
                              {it.hasPendingWrites && <span className="ad-badge ad-badge-pending text-[10px] px-1 py-0 border border-amber-500/20">Pending Sync</span>}
                            </div>
                          </td>
                          <td className="font-mono text-emerald-400">{it.availableQty ?? 0}</td>
                          <td className="font-mono">{it.totalQty ?? 0}</td>
                          <td className="text-right font-mono text-sm">₱{(Number(it.price) || 0).toFixed(2)}</td>
                          <td className="text-right whitespace-nowrap space-x-1">
                            <button type="button" className="ad-btn ad-btn-sm ad-btn-outline" onClick={() => openEditItem(it)}>
                              Edit
                            </button>
                            <button type="button" className="ad-btn ad-btn-sm ad-btn-danger" onClick={() => removeItem(it)} disabled={syncState !== "idle" && syncState !== "error"}>
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === "borrowing" && (
        <section className="grid lg:grid-cols-1 gap-6">
          <div className="ad-card p-4 sm:p-6">
            <h3 className="text-base font-bold text-[var(--ad-text)] mb-4">New rent</h3>
            <form onSubmit={submitBorrow} className="space-y-4 max-w-2xl">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="af-group">
                  <label className="af-label">Borrower / account name *</label>
                  <input
                    className="af-input"
                    value={renterName}
                    onChange={(e) => setRenterName(e.target.value)}
                    placeholder="Player or member name"
                    required
                  />
                </div>
                <div className="af-group">
                  <label className="af-label">How many Hours? *</label>
                  <input
                    className="af-input"
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={rentHours}
                    onChange={(e) => setRentHours(e.target.value === "" ? "" : Number(e.target.value))}
                  />
                </div>
                <div className="af-group">
                  <label className="af-label">Court</label>
                  <select
                    className="af-input"
                    value={rentCourt}
                    onChange={(e) => setRentCourt(e.target.value)}
                  >
                    <option value="">Select Court...</option>
                    {courts.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="af-group md:col-span-2">
                  <label className="af-label">Contact Number</label>
                  <input
                    className="af-input"
                    value={rentContact}
                    onChange={(e) => setRentContact(e.target.value)}
                    placeholder="09XX XXX XXXX"
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="af-label mb-0">Items</label>
                  <button type="button" className="text-xs text-[var(--ad-pickle)] font-semibold" onClick={addBorrowLine}>
                    + Add line
                  </button>
                </div>
                <div className="space-y-2">
                  {rentLines.map((line, i) => (
                    <div key={i} className="flex flex-wrap gap-2 items-end">
                      <select
                        className="af-input flex-1 min-w-[160px]"
                        value={line.itemId}
                        onChange={(e) => setBorrowLine(i, "itemId", e.target.value)}
                      >
                        <option value="">Select item…</option>
                        {items.filter((it) => isRentalInventoryItem(it)).map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name} ({it.availableQty ?? 0} avail.) · ₱{Number(it.pricePerHour || 0).toFixed(0)}/hr
                          </option>
                        ))}
                      </select>
                      <input
                        className="af-input w-24"
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => setBorrowLine(i, "quantity", e.target.value)}
                      />
                      {rentLines.length > 1 && (
                        <button
                          type="button"
                          className="ad-btn ad-btn-sm ad-btn-outline"
                          onClick={() => removeBorrowLine(i)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-[var(--ad-border)] bg-[var(--ad-surface)] p-4 max-w-lg">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ad-muted)]">
                  Estimated rental (this rent)
                </div>
                <div className="text-2xl font-black text-[var(--ad-pickle)] mt-1">
                  ₱{borrowPreviewRental.toFixed(2)}
                </div>
                <div className="mt-3 space-y-1.5 border-t border-[var(--ad-border)] pt-3">
                  {rentLines
                    .map((line, idx) => ({ line, idx }))
                    .filter(({ line }) => line.itemId)
                    .map(({ line, idx }) => {
                      const stock = itemsById[line.itemId];
                      const name = stock?.name ?? "Item";
                      const q = Math.max(1, Math.floor(Number(line.quantity) || 1));
                      const p = Number(stock?.pricePerHour) || 0;
                      const sub = roundMoney(q * p * rentHours);
                      return (
                        <div
                          key={`${line.itemId}-${idx}`}
                          className="flex flex-wrap justify-between gap-2 text-[11px]"
                        >
                          <span className="text-[var(--ad-muted)]">{name}</span>
                          <span className="font-mono text-[var(--ad-text)]">
                            {q}×₱{p.toFixed(2)}/hr×{rentHours}h = ₱{sub.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  {rentPreviewLines.length === 0 && (
                    <p className="text-[11px] text-[var(--ad-muted)]">Select items and quantities to see the breakdown.</p>
                  )}
                </div>
                <p className="text-[11px] text-[var(--ad-muted)] mt-3 leading-relaxed">
                  Catalog <strong className="text-[var(--ad-text)]">Rent ₱/hr</strong> is per unit. Overdue fines
                  (per unit, per hour late) apply only after the due time — shown when you process the return.
                </p>
              </div>
              <button type="submit" className="ad-btn ad-btn-primary" disabled={syncState !== "idle" && syncState !== "error"}>
                {syncState === "syncing" ? "Saving…" : syncState === "offline-saved" ? "Saved Offline" : "Record rent"}
              </button>
            </form>
          </div>

          <div className="ad-card overflow-hidden">
            <div className="ad-card-header">
              <h3 className="ad-card-title">Active rents</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Borrower</th>
                    <th>Items</th>
                    <th>Due</th>
                    <th className="text-right whitespace-nowrap" title="Billable hours (initial + extensions)">
                      Billable h
                    </th>
                    <th className="text-right">Rental</th>
                    <th>Ext.</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {activeBorrows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="ad-empty">
                        No active rents.
                      </td>
                    </tr>
                  ) : (
                    activeBorrows.slice((activeRentPage - 1) * PAGE_SIZE, activeRentPage * PAGE_SIZE).map((b) => (
                      <tr key={b.id}>
                        <td className="ad-td-main">
                          <div className="flex items-center gap-2">
                            {b.borrowerName}
                            {b.hasPendingWrites && <span className="ad-badge ad-badge-pending text-[10px] px-1 py-0 border border-amber-500/20">Pending Sync</span>}
                          </div>
                        </td>
                        <td className="text-sm">
                          {(b.items || []).map((l) => `${l.itemName} ×${l.quantity}`).join(", ")}
                        </td>
                        <td className="text-sm whitespace-nowrap">
                          {format(tsToDate(b.expectedReturnAt) || new Date(), "MMM d, yyyy h:mm a")}
                        </td>
                        <RentBillableHoursCell rent={b} />
                        <RentRentalCell rent={b} />
                        <td className="text-sm text-[var(--ad-muted)]">
                          {(b.extensionHistory || []).length}
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <button
                            type="button"
                            className="ad-btn ad-btn-sm ad-btn-outline mr-1"
                            onClick={() => {
                              setExtendModal(b);
                              setExtendHours(1);
                            }}
                          >
                            Extend
                          </button>
                          <button
                            type="button"
                            className="ad-btn ad-btn-sm ad-btn-success"
                            onClick={() => returnBorrow(b)}
                            disabled={syncState !== "idle" && syncState !== "error"}
                          >
                            Return
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              page={activeRentPage}
              totalPages={Math.max(1, Math.ceil(activeBorrows.length / PAGE_SIZE))}
              onPage={setActiveRentPage}
            />
          </div>
        </section>
      )}

      {tab === "reports" && (
        <section className="space-y-6">
          <div className="flex flex-wrap gap-3 items-center">
            <span className="text-sm text-[var(--ad-muted)]">Period:</span>
            {REPORT_PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`ad-filter-tab ${reportPeriod === p.id ? "active" : ""}`}
                onClick={() => setReportPeriod(p.id)}
              >
                {p.label}
              </button>
            ))}
            <span className="text-xs text-[var(--ad-muted)] ml-2">
              {format(reportRange.start, "MMM d, yyyy")} — {format(reportRange.end, "MMM d, yyyy")}
            </span>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="ad-card overflow-hidden">
              <div className="ad-card-header">
                <h3 className="ad-card-title">Renting history ({reportFilteredBorrows.length})</h3>
              </div>
              <div className="overflow-x-auto max-h-80">
                <table className="ad-table">
                  <thead>
                    <tr>
                      <th>Borrower</th>
                      <th>Items</th>
                      <th>Borrowed</th>
                      <th>Returned</th>
                      <th className="text-right">Rental</th>
                      <th className="text-right">Overdue</th>
                      <th className="text-right">Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportFilteredBorrows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="ad-empty">
                          No rents in this period.
                        </td>
                      </tr>
                    ) : (
                      reportFilteredBorrows.slice((historyPage - 1) * PAGE_SIZE, historyPage * PAGE_SIZE).map((b) => (
                        <tr key={b.id}>
                          <td className="ad-td-main">{b.borrowerName}</td>
                          <td className="text-sm">
                            {(b.items || []).map((l) => `${l.itemName} ×${l.quantity}`).join(", ")}
                          </td>
                          <td className="text-xs whitespace-nowrap">
                            {format(tsToDate(b.borrowedAt) || new Date(), "MMM d, yyyy HH:mm")}
                          </td>
                          <td className="text-xs whitespace-nowrap">
                            {b.actualReturnAt
                              ? format(tsToDate(b.actualReturnAt) || new Date(), "MMM d, yyyy HH:mm")
                              : "—"}
                          </td>
                          <td className="text-right text-xs font-mono">
                            {b.rentalCharge != null ? `₱${Number(b.rentalCharge).toFixed(2)}` : "—"}
                          </td>
                          <td className="text-right text-xs font-mono text-amber-400">
                            {b.overdueCharge != null && Number(b.overdueCharge) > 0
                              ? `₱${Number(b.overdueCharge).toFixed(2)}`
                              : "—"}
                          </td>
                          <td className="text-right text-xs font-mono font-semibold">
                            {b.totalCharge != null ? `₱${Number(b.totalCharge).toFixed(2)}` : "—"}
                          </td>
                          <td>
                            <span
                              className={`ad-badge ${b.status === "returned" ? "ad-badge-approved" : "ad-badge-pending"
                                }`}
                            >
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={historyPage}
                totalPages={Math.max(1, Math.ceil(reportFilteredBorrows.length / PAGE_SIZE))}
                onPage={setHistoryPage}
              />
            </div>

            <div className="ad-card overflow-hidden">
              <div className="ad-card-header">
                <h3 className="ad-card-title">Sale history ({reportFilteredSales.length})</h3>
              </div>
              <div className="overflow-x-auto max-h-80">
                <table className="ad-table">
                  <thead>
                    <tr>
                      <th>Buyer</th>
                      <th>Items</th>
                      <th>Date</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportFilteredSales.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="ad-empty">No sales in this period.</td>
                      </tr>
                    ) : (
                      reportFilteredSales.slice((saleHistoryPage - 1) * PAGE_SIZE, saleHistoryPage * PAGE_SIZE).map(s => (
                        <tr key={s.id}>
                          <td className="ad-td-main">{s.customerName}</td>
                          <td className="text-sm">
                            {(s.items || []).map(l => `${l.itemName} x${l.quantity}`).join(", ")}
                          </td>
                          <td className="text-xs whitespace-nowrap">
                            {format(tsToDate(s.createdAt) || new Date(), "MMM d, yyyy HH:mm")}
                          </td>
                          <td className="text-right font-mono font-medium text-[var(--ad-text)]">
                            ${Number(s.totalAmount).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={saleHistoryPage}
                totalPages={Math.max(1, Math.ceil(reportFilteredSales.length / PAGE_SIZE))}
                onPage={setSaleHistoryPage}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="ad-card p-4">
              <h4 className="text-sm font-bold mb-3">Most borrowed (units in period)</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                {mostBorrowedReport.length === 0 ? (
                  <li className="text-[var(--ad-muted)] list-none">No data</li>
                ) : (
                  mostBorrowedReport.slice(0, 15).map((row) => (
                    <li key={row.itemId} className="flex justify-between gap-2">
                      <span className="truncate">{row.name}</span>
                      <span className="font-mono text-emerald-400">{row.quantity}</span>
                    </li>
                  ))
                )}
              </ol>
            </div>
            <div className="ad-card p-4">
              <h4 className="text-sm font-bold mb-3">Overdue snapshots (due date in period)</h4>
              <p className="text-xs text-[var(--ad-muted)] mb-2">
                Active rents whose expected return fell in this window and are past due.
              </p>
              <ul className="space-y-2 text-sm max-h-56 overflow-y-auto custom-scrollbar">
                {overdueInReportPeriod.length === 0 ? (
                  <li className="text-[var(--ad-muted)]">None in this filter.</li>
                ) : (
                  overdueInReportPeriod.map((b) => (
                    <li key={b.id} className="border border-[var(--ad-border)] rounded p-2">
                      <div className="font-semibold">{b.borrowerName}</div>
                      <div className="text-xs text-amber-400">
                        Was due {format(tsToDate(b.expectedReturnAt) || new Date(), "MMM d, yyyy HH:mm")}
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </section>
      )}

      {itemModal && (
        <div className="ad-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setItemModal(null)}>
          <div className="ad-modal max-w-md">
            <div className="ad-modal-header">
              <h3>{itemModal === "new" ? "Add inventory item" : "Edit item"}</h3>
              <button type="button" className="ad-modal-close" onClick={() => setItemModal(null)}>
                ✕
              </button>
            </div>
            <form onSubmit={saveItem} className="ad-modal-form">
              <div className="af-group">
                <label className="af-label">Name *</label>
                <input
                  className="af-input"
                  value={itemForm.name}
                  onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="af-group">
                <label className="af-label">Category</label>
                <input
                  className="af-input"
                  value={itemForm.category}
                  onChange={(e) => setItemForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Paddle, Balls"
                />
              </div>
              <div className="af-group">
                <label className="af-label">Item type</label>
                <select
                  className="af-input"
                  value={itemForm.itemType}
                  onChange={(e) => setItemForm((f) => ({ ...f, itemType: e.target.value }))}
                >
                  <option value="rental">For Rent</option>
                  <option value="sale">For Sale</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div className="af-group">
                <label className="af-label">Total quantity *</label>
                <input
                  className="af-input"
                  type="number"
                  min={0}
                  value={itemForm.totalQty}
                  onChange={(e) => setItemForm((f) => ({ ...f, totalQty: e.target.value }))}
                  required
                />
              </div>
              {(itemForm.itemType === "sale" || itemForm.itemType === "both") && (
                <div className="af-group">
                  <label className="af-label">Price (₱) *</label>
                  <input
                    className="af-input"
                    type="number"
                    min={0}
                    step={0.01}
                    value={itemForm.price}
                    onChange={(e) => setItemForm((f) => ({ ...f, price: e.target.value }))}
                    placeholder="0"
                    required={itemForm.itemType === "sale" || itemForm.itemType === "both"}
                  />
                </div>
              )}
              {(itemForm.itemType === "rental" || itemForm.itemType === "both") && (
                <div className="af-row grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="af-group">
                    <label className="af-label">Rental (₱ / hour) *</label>
                    <input
                      className="af-input"
                      type="number"
                      min={0}
                      step={0.01}
                      value={itemForm.pricePerHour}
                      onChange={(e) => setItemForm((f) => ({ ...f, pricePerHour: e.target.value }))}
                      placeholder="0"
                      required={itemForm.itemType === "rental" || itemForm.itemType === "both"}
                    />
                  </div>
                  <div className="af-group">
                    <label className="af-label">Overdue fine (₱ / hour)</label>
                    <input
                      className="af-input"
                      type="number"
                      min={0}
                      step={0.01}
                      value={itemForm.overdueFinePerHour}
                      onChange={(e) => setItemForm((f) => ({ ...f, overdueFinePerHour: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                </div>
              )}
              {(itemForm.itemType === "rental" || itemForm.itemType === "both") && (
                <p className="text-[11px] text-[var(--ad-muted)] -mt-1">
                  Per borrowed unit, per hour. Fines accrue for late returns based on time past the due time.
                </p>
              )}
              <div className="af-group">
                <label className="af-label">Notes</label>
                <textarea
                  className="af-input af-textarea"
                  rows={2}
                  value={itemForm.notes}
                  onChange={(e) => setItemForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <div className="ad-modal-footer">
                <button type="button" className="ad-btn ad-btn-outline" onClick={() => setItemModal(null)} disabled={syncState !== "idle" && syncState !== "error"}>
                  Cancel
                </button>
                <button type="submit" className="ad-btn ad-btn-primary" disabled={syncState !== "idle" && syncState !== "error"}>
                  {syncState === "syncing" ? "Saving…" : syncState === "offline-saved" ? "Saved Offline" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {returnModal && (
        <div className="ad-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setReturnModal(null)}>
          <div className="ad-modal max-w-sm">
            <div className="ad-modal-header">
              <h3>Confirm Return</h3>
              <button type="button" className="ad-modal-close" onClick={() => setReturnModal(null)}>
                ×
              </button>
            </div>
            <div className="ad-modal-form">
              <p className="text-sm text-[var(--ad-muted)] mb-4">
                Process return for <strong className="text-[var(--ad-text)]">{returnModal.renterName}</strong>?
              </p>

              <div className="rounded-lg bg-[var(--ad-surface)] border border-[var(--ad-border)] p-3 space-y-2 text-sm mb-4">
                <div className="flex justify-between text-[var(--ad-muted)]">
                  <span>Scheduled rental:</span>
                  <span>₱{returnModal.rentalCharge.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[var(--ad-muted)]">
                  <span>Late hours:</span>
                  <span>{returnModal.lateH.toFixed(2)}h</span>
                </div>
                <div className="flex justify-between text-[var(--ad-muted)]">
                  <span>Overdue fine:</span>
                  <span className={returnModal.overdueCharge > 0 ? 'text-amber-400' : ''}>₱{returnModal.overdueCharge.toFixed(2)}</span>
                </div>
                <div className="border-t border-[var(--ad-border)] pt-2 mt-2 flex justify-between font-bold text-[var(--ad-text)]">
                  <span>Total due:</span>
                  <span className="text-emerald-400 font-mono text-lg">₱{returnModal.totalCharge.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="af-group">
                  <label className="af-label">Cash Received</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="af-input text-lg font-mono"
                    placeholder="0.00"
                    value={returnModal.cashReceived || ""}
                    onChange={(e) => setReturnModal({ ...returnModal, cashReceived: e.target.value })}
                  />
                </div>
                {Number(returnModal.cashReceived) >= returnModal.totalCharge && returnModal.totalCharge > 0 && (
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 flex justify-between text-emerald-400 font-bold">
                    <span>Change:</span>
                    <span className="font-mono text-lg">₱{(Number(returnModal.cashReceived) - returnModal.totalCharge).toFixed(2)}</span>
                  </div>
                )}
                {Number(returnModal.cashReceived) > 0 && Number(returnModal.cashReceived) < returnModal.totalCharge && (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 flex justify-between text-amber-400 font-bold">
                    <span>Insufficient:</span>
                    <span className="font-mono text-lg">₱{(returnModal.totalCharge - Number(returnModal.cashReceived)).toFixed(2)}</span>
                  </div>
                )}
                {returnModal.totalCharge === 0 && Number(returnModal.cashReceived) > 0 && (
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 flex justify-between text-emerald-400 font-bold">
                    <span>Change:</span>
                    <span className="font-mono text-lg">₱{Number(returnModal.cashReceived).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="ad-modal-footer">
              <button type="button" className="ad-btn ad-btn-outline" onClick={() => setReturnModal(null)} disabled={syncState !== "idle" && syncState !== "error"}>
                Cancel
              </button>
              <button type="button" className="ad-btn ad-btn-success" onClick={applyReturn} disabled={syncState !== "idle" && syncState !== "error"}>
                {syncState === "syncing" ? "Processing..." : syncState === "offline-saved" ? "Saved Offline" : "Confirm Return"}
              </button>
            </div>
          </div>
        </div>
      )}

      {extendModal && (
        <div className="ad-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setExtendModal(null)}>
          <div className="ad-modal max-w-sm">
            <div className="ad-modal-header">
              <h3>Extend borrowing</h3>
              <button type="button" className="ad-modal-close" onClick={() => setExtendModal(null)}>
                ✕
              </button>
            </div>
            <div className="ad-modal-form">
              <p className="text-sm text-[var(--ad-muted)] mb-2">
                Add hours after the current expected return time for{" "}
                <strong className="text-[var(--ad-text)]">{extendModal.borrowerName}</strong>.
              </p>
              <div className="af-group">
                <label className="af-label">Additional hours</label>
                <input
                  className="af-input"
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={extendHours}
                  onChange={(e) => setExtendHours(Number(e.target.value))}
                />
              </div>
              <p className="text-xs font-mono text-emerald-400">
                Extra rental added: ₱
                {computeRentalCharge(extendModal.items || [], extendHours).toFixed(2)} (added to scheduled rental
                total)
              </p>
              {(extendModal.extensionHistory || []).length > 0 && (
                <div className="rounded-lg border border-[var(--ad-border)] p-2 max-h-32 overflow-y-auto text-xs space-y-1">
                  <div className="font-semibold text-[var(--ad-muted)]">Extension log</div>
                  {[...(extendModal.extensionHistory || [])].reverse().map((ex, i) => (
                    <div key={i} className="text-[var(--ad-muted)]">
                      +{ex.addedHours}h → {format(tsToDate(ex.newExpectedReturn) || new Date(), "MMM d, h:mm a")}
                      {ex.extraRentalCharge != null && (
                        <span className="text-emerald-400"> · +₱{Number(ex.extraRentalCharge).toFixed(2)} rental</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="ad-modal-footer">
              <button type="button" className="ad-btn ad-btn-outline" onClick={() => setExtendModal(null)} disabled={syncState !== "idle" && syncState !== "error"}>
                Cancel
              </button>
              <button type="button" className="ad-btn ad-btn-primary" onClick={applyExtension} disabled={syncState !== "idle" && syncState !== "error"}>
                {syncState === "syncing" ? "Extending..." : syncState === "offline-saved" ? "Saved Offline" : "Apply extension"}
              </button>
            </div>
          </div>
        </div>
      )}

      {saleReceipt && (
        <EquipmentSaleReceipt
          sale={saleReceipt}
          onAfterPrint={() => {
            setSaleReceipt(null);
          }}
        />
      )}
    </div>
  );
}

function StatMini({ label, value, tone, icon }) {
  const ring =
    tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : tone === "sky"
        ? "border-sky-500/30 bg-sky-500/5"
        : tone === "amber"
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-slate-600/50 bg-slate-800/40";
  const ic =
    tone === "emerald"
      ? "text-emerald-400"
      : tone === "sky"
        ? "text-sky-400"
        : tone === "amber"
          ? "text-amber-400"
          : "text-slate-400";
  return (
    <div className={`rounded-xl border p-4 ${ring}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ad-muted)]">{label}</span>
        <span className={`material-symbols-outlined text-lg ${ic}`}>{icon}</span>
      </div>
      <div className="text-2xl font-black text-[var(--ad-text)] tabular-nums">{value}</div>
    </div>
  );
}
