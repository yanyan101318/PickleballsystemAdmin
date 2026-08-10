const fs = require('fs');

function migrateBook() {
  const file = 'src/components/Book.jsx';
  let code = fs.readFileSync(file, 'utf8');

  // Fix courts fetch
  code = code.replace(/useEffect\(\(\)\s*=>\s*\{\s*const\s*unsub\s*=\s*onSnapshot\([\s\S]*?return\s*\(\)\s*=>\s*unsub\(\);\s*\},\s*\[\]\);/g, `
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
  `);

  // Fix equipment fetch
  code = code.replace(/useEffect\(\(\)\s*=>\s*\{\s*const\s*unsub\s*=\s*onSnapshot\(\s*collection\(db,\s*"inventoryItems"\),[\s\S]*?\(\)\s*=>\s*setRentalAddOns\(\[\]\)\s*\);\s*return\s*\(\)\s*=>\s*unsub\(\);\s*\},\s*\[\]\);/g, `
  useEffect(() => {
    async function loadEquipment() {
      try {
        const res = await fetch("/api/equipment");
        const all = await res.json();
        setRentalAddOns(all.filter(it => {
          const typeRaw = String(it.type ?? "").trim().toLowerCase();
          const hasPrice = Number.isFinite(Number(it.price)) || Number.isFinite(Number(it.pricePerHour));
          return typeRaw === "rental" && hasPrice;
        }));
      } catch (err) { console.error(err); }
    }
    loadEquipment();
  }, []);
  `);

  // Fix loadDayBookings
  code = code.replace(/const\s*loadDayBookings\s*=\s*useCallback\(async\s*\(\)\s*=>\s*\{[\s\S]*?\},/g, `
  const loadDayBookings = useCallback(async () => {
    if (!form.courtId) return;
    try {
      const res = await fetch(\`/api/bookings?date=\${form.date}\`);
      const all = await res.json();
      const list = all.filter(b => b.courtId === form.courtId && ["pending", "approved"].includes(String(b.status).toLowerCase())).map(b => ({
        id: b.id,
        timeSlot: b.timeSlot,
        startTime: b.startTime || b.timeSlot,
        duration: Number(b.duration) || 1,
        status: b.status
      }));
      setDayBookings(list);
    } catch {
      setDayBookings([]);
    }
  },`);

  // Fix check existing bookings in handleBookingSubmit
  code = code.replace(/const\s*overlapQuery\s*=\s*query\([\s\S]*?const\s*overlapSnap\s*=\s*await\s*getDocs\(overlapQuery\);[\s\S]*?if\s*\(!overlapSnap.empty\)\s*\{[\s\S]*?\}/g, `
    const overlapRes = await fetch(\`/api/bookings?date=\${bookingData.date}\`);
    const all = await overlapRes.json();
    const overlapping = all.filter(b => b.courtId === bookingData.courtId && b.timeSlot === bookingData.timeSlot && ["pending", "approved"].includes(String(b.status).toLowerCase()));
    if (overlapping.length > 0) {
      toast.error("This slot was just booked! Please choose another.");
      setIsSubmitting(false);
      return;
    }
  `);

  // Fix duplicate bookings for player check
  code = code.replace(/const\s*playerQuery\s*=\s*query\([\s\S]*?const\s*playerSnap\s*=\s*await\s*getDocs\(playerQuery\);[\s\S]*?if\s*\(!playerSnap.empty\)\s*\{[\s\S]*?\}/g, `
    const playerBookings = all.filter(b => b.playerName === bookingData.playerName && b.date === bookingData.date && ["pending", "approved"].includes(String(b.status).toLowerCase()));
    if (playerBookings.length > 0) {
      if (!window.confirm("You already have an active booking on this date. Proceed anyway?")) {
        setIsSubmitting(false);
        return;
      }
    }
  `);

  // Fix useOfflineSync usage
  code = code.replace(/const\s*\{\s*syncState,\s*wrapSync,\s*setSyncState\s*\}\s*=\s*useOfflineSync\(\);/g, 'const wrapSync = async (p) => p;');

  // Remove missing imports completely
  code = code.replace(/import\s*\{\s*db\s*\}\s*from\s*"..\/firebase";?/g, '');
  code = code.replace(/import\s*\{\s*useOfflineSync\s*\}\s*from\s*"..\/hooks\/useOfflineSync";?/g, '');
  
  // Also remove Firebase firestore imports
  code = code.replace(/import\s*\{[^}]*\}\s*from\s*"firebase\/firestore";?/g, '');
  
  fs.writeFileSync(file, code);
}

function migrateBookingManager() {
  const file = 'src/admin/BookingManager.jsx';
  let code = fs.readFileSync(file, 'utf8');

  // Fix setStatus
  code = code.replace(/async\s*function\s*setStatus\(id,\s*status\)\s*\{[\s\S]*?setActing\(null\);\s*\}/g, `
  async function setStatus(id, status) {
    setActing(id);
    try {
      await fetch(\`/api/bookings/\${id}\`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      toast.success(\`Booking \${status}\`);
    } catch (err) { console.error(err); }
    setActing(null);
  }`);

  // Fix markPaid
  code = code.replace(/async\s*function\s*markPaid\(id,\s*total,\s*currentPaid\s*=\s*0\)\s*\{[\s\S]*?catch\s*\(e\)\s*\{[\s\S]*?\}\s*\}/g, `
  async function markPaid(id, total, currentPaid = 0) {
    try {
      await fetch(\`/api/bookings/\${id}\`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountPaid: total, remainingBalance: 0, customerPaymentStatus: "Paid" })
      });
      toast.success("Marked as full paid.");
    } catch (e) {
      console.error(e);
      toast.error("Failed");
    }
  }`);

  // Replace remaining batch logic with fetch
  code = code.replace(/const\s*batch\s*=\s*writeBatch\(db\);[\s\S]*?batch\.update\(doc\(db,\s*"bookings",\s*acting\.id\),\s*patch\);[\s\S]*?await\s*wrapSync\(batch\.commit\(\)[\s\S]*?\);/g, `
    await fetch(\`/api/bookings/\${acting.id}\`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
  `);

  code = code.replace(/const\s*batch\s*=\s*writeBatch\(db\);[\s\S]*?batch\.update\(doc\(db,\s*"bookings",\s*selected\.id\),\s*patch\);[\s\S]*?await\s*wrapSync\(batch\.commit\(\)[\s\S]*?\);/g, `
    await fetch(\`/api/bookings/\${selected.id}\`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
  `);

  code = code.replace(/async\s*function\s*editBookingField\(field,\s*val\)\s*\{[\s\S]*?finally\s*\{[\s\S]*?\}\s*\}/g, `
  async function editBookingField(field, val) {
    if (!selected) return;
    try {
      await fetch(\`/api/bookings/\${selected.id}\`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: val })
      });
      toast.success("Updated");
      setSelected(s => s ? { ...s, [field]: val } : null);
    } catch (e) {
      toast.error("Failed to update");
    }
  }`);

  // Replace any Firebase imports
  code = code.replace(/import\s*\{\s*db\s*\}\s*from\s*"..\/firebase";?/g, '');
  code = code.replace(/import\s*\{\s*useOfflineSync\s*\}\s*from\s*"..\/hooks\/useOfflineSync";?/g, '');
  code = code.replace(/import\s*\{[^}]*\}\s*from\s*"firebase\/firestore";?/g, '');
  
  // Mock wrapSync if missing
  if (!code.includes('const wrapSync')) {
    code = code.replace(/export\s*default\s*function\s*BookingManager\(\)\s*\{/g, 'export default function BookingManager() {\n  const wrapSync = async (p) => p;');
  }
  
  fs.writeFileSync(file, code);
}

try { migrateBook(); } catch (e) { console.log('Book.jsx err', e); }
try { migrateBookingManager(); } catch (e) { console.log('BookingManager.jsx err', e); }
console.log('Done migrating');
