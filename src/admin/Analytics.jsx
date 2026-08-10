import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend
} from "recharts";
import * as XLSX from "xlsx";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import "./admin.css";

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f43f5e', '#f59e0b', '#06b6d4'];

export default function Analytics() {
  const { profile } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("all");

  useEffect(() => {
    document.title = "PICKLE BROS COURT | Dashboard";
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const [bookRes, custRes, courtRes, invRes, borrowRes, salesRes, actRes] = await Promise.all([
          fetch("/api/bookings"),
          fetch("/api/customers"),
          fetch("/api/courts"),
          fetch("/api/equipment"),
          fetch("/api/borrow-records"),
          fetch("/api/sales-transactions"),
          fetch("/api/activity-logs")
        ]);

        const bookings = bookRes.ok ? await bookRes.json() : [];
        const customers = custRes.ok ? await custRes.json() : [];
        const courts = courtRes.ok ? await courtRes.json() : [];
        const inventory = invRes.ok ? await invRes.json() : [];
        const borrowRecords = borrowRes.ok ? await borrowRes.json() : [];
        const salesTransactions = salesRes.ok ? await salesRes.json() : [];
        const activityLogs = actRes.ok ? await actRes.json() : [];

        setData({
          bookings,
          customers,
          courts,
          inventory,
          borrowRecords,
          salesTransactions,
          activityLogs
        });
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredData = useMemo(() => {
    if (!data) return null;
    const now = new Date();
    let startDate = null;
    let endDate = null;

    if (dateRange === "today") {
      startDate = startOfDay(now);
      endDate = endOfDay(now);
    } else if (dateRange === "week") {
      startDate = startOfWeek(now);
      endDate = endOfWeek(now);
    } else if (dateRange === "month") {
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
    }

    const filterByDate = (dateString) => {
      if (dateRange === "all" || !dateString) return true;
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return true;
      return d >= startDate && d <= endDate;
    };

    const bookings = data.bookings.filter(b => filterByDate(b.createdAt || b.date));
    const borrowRecords = data.borrowRecords.filter(br => filterByDate(br.rentedAt));
    const salesTransactions = (data.salesTransactions || []).filter(s => filterByDate(s.created_at));
    const activityLogs = (data.activityLogs || []).filter(a => filterByDate(a.created_at));

    return {
      bookings,
      customers: data.customers || [],
      courts: data.courts || [],
      inventory: data.inventory || [],
      borrowRecords,
      salesTransactions,
      activityLogs
    };
  }, [data, dateRange]);

  const stats = useMemo(() => {
    if (!filteredData) return null;
    const { bookings, customers, borrowRecords, salesTransactions } = filteredData;
    
    const totalBookings = bookings.length;
    const totalRevenue = bookings.reduce((sum, b) => sum + (Number(b.amountPaid) || 0), 0) +
                         borrowRecords.reduce((sum, br) => sum + (Number(br.totalAmount) || 0), 0);
    const registeredPlayers = customers.length;
    const paymentRecords = bookings.filter(b => Number(b.amountPaid) > 0).length + borrowRecords.filter(br => Number(br.totalAmount) > 0).length;
    
    // Real Equipment Sales from sales_transactions table
    const equipmentSalesTotal = (salesTransactions || []).reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    
    const activeRentals = borrowRecords.filter(br => {
      const s = (br.status || "").toLowerCase();
      return s === "active" || s === "borrowed" || s === "rented" || (!s && !br.returnedAt);
    }).length;

    return {
      totalBookings,
      totalRevenue,
      registeredPlayers,
      paymentRecords,
      equipmentSalesTotal,
      activeRentals
    };
  }, [filteredData]);

  // CHARTS DATA PREP
  const bookingStatusData = useMemo(() => {
    if (!filteredData) return [];
    const counts = { Approved: 0, Pending: 0, Cancelled: 0, Rejected: 0 };
    filteredData.bookings.forEach(b => {
      const status = b.status || "Pending";
      if (counts[status] !== undefined) counts[status]++;
    });
    return Object.keys(counts).map(name => ({ name, value: counts[name] })).filter(d => d.value > 0);
  }, [filteredData]);

  const bookingsPerCourtData = useMemo(() => {
    if (!filteredData) return [];
    const counts = {};
    filteredData.bookings.forEach(b => {
      const court = b.courtName || "Unknown Court";
      counts[court] = (counts[court] || 0) + 1;
    });
    return Object.keys(counts).map(name => ({ name, bookings: counts[name] })).sort((a,b) => b.bookings - a.bookings);
  }, [filteredData]);

  const paymentMethodsData = useMemo(() => {
    if (!filteredData) return [];
    const counts = { Cash: 0, GCash: 0, Other: 0 };
    filteredData.bookings.forEach(b => {
      const m = String(b.paymentMethod || "").toLowerCase();
      if (m === "gcash") counts.GCash++;
      else if (m === "cash") counts.Cash++;
      else if (m) counts.Other++;
    });
    return Object.keys(counts).map(name => ({ name, value: counts[name] })).filter(d => d.value > 0);
  }, [filteredData]);

  const revenueTrendData = useMemo(() => {
    if (!filteredData) return [];
    const monthly = {};
    filteredData.bookings.forEach(b => {
      if (b.createdAt) {
        const month = format(new Date(b.createdAt), "MMM yyyy");
        monthly[month] = (monthly[month] || 0) + (Number(b.amountPaid) || 0);
      }
    });
    return Object.keys(monthly).map(name => ({ name, revenue: monthly[name] })).sort((a,b) => new Date(a.name) - new Date(b.name));
  }, [filteredData]);

  const equipmentSalesData = useMemo(() => {
    if (!filteredData?.salesTransactions?.length) return [];
    // Group sales by item category from real sales_transactions data
    const categoryTotals = {};
    filteredData.salesTransactions.forEach(s => {
      const items = Array.isArray(s.items) ? s.items
        : (typeof s.items === 'string' ? (() => { try { return JSON.parse(s.items); } catch { return []; } })() : []);
      items.forEach(item => {
        const cat = item.category || item.itemCategory || item.itemName || "Other";
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(item.price || item.unitPrice || 0) * Number(item.quantity || 1));
      });
      // If no items detail, group by transaction type
      if (!items.length) {
        const cat = s.source || s.type || "POS Sale";
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(s.total) || 0);
      }
    });
    return Object.entries(categoryTotals)
      .map(([category, sales]) => ({ category, sales }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 6);
  }, [filteredData]);

  const activeReturnedData = useMemo(() => {
    if (!filteredData) return [];
    let active = 0, returned = 0;
    filteredData.borrowRecords.forEach(br => {
      const s = (br.status || "").toLowerCase();
      if (s === "returned" || br.returnedAt) returned++;
      else active++;
    });
    return [
      { name: "Active", value: active },
      { name: "Returned", value: returned }
    ].filter(d => d.value > 0);
  }, [filteredData]);

  const mostRentedData = useMemo(() => {
    if (!filteredData) return [];
    const counts = {};
    filteredData.borrowRecords.forEach(br => {
      if (br.items) {
         br.items.forEach(item => {
            const name = item.itemName || "Unknown";
            counts[name] = (counts[name] || 0) + (item.quantity || 1);
         });
      }
    });
    return Object.keys(counts).map(name => ({ name, count: counts[name] })).sort((a,b) => b.count - a.count).slice(0, 5);
  }, [filteredData]);

  const bookingsByDayData = useMemo(() => {
    if (!filteredData) return [];
    const days = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    filteredData.bookings.forEach(b => {
      if (b.date) {
        const d = new Date(b.date);
        if (!isNaN(d)) {
          const day = format(d, "EEE");
          if (days[day] !== undefined) days[day]++;
        }
      }
    });
    const order = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return order.map(name => ({ name, bookings: days[name] }));
  }, [filteredData]);

  const exportToExcel = () => {
    if (!filteredData) return;
    const wb = XLSX.utils.book_new();

    const createSheetWithTitle = (data, title) => {
      const ws = XLSX.utils.aoa_to_sheet([
        [title],
        []
      ]);
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
      XLSX.utils.sheet_add_json(ws, data, { origin: "A3" });
      return ws;
    };
    
    // Bookings Sheet
    const bookingsData = filteredData.bookings.map(b => ({
      ID: b.id,
      Customer: b.playerName,
      Court: b.courtName,
      Date: b.date,
      Time: b.timeSlot,
      Status: b.status,
      AmountPaid: b.amountPaid,
      Method: b.paymentMethod,
      Notes: b.notes
    }));
    XLSX.utils.book_append_sheet(wb, createSheetWithTitle(bookingsData, "PickleBros Court - Bookings Data"), "Bookings");

    // Borrow Records Sheet
    const rentalsData = filteredData.borrowRecords.map(br => ({
      ID: br.id,
      Customer: br.customerName || br.borrowerName,
      Items: Array.isArray(br.items) ? br.items.map(i => `${i.quantity}x ${i.itemName || i.name}`).join(", ") : "",
      TotalAmount: br.totalAmount || br.total_amount,
      RentedAt: br.borrowedAt || br.rentedAt ? format(new Date(br.borrowedAt || br.rentedAt), "yyyy-MM-dd HH:mm") : "",
      ReturnedAt: br.returnedAt ? format(new Date(br.returnedAt), "yyyy-MM-dd HH:mm") : "",
      Status: br.status || (br.returnedAt ? "returned" : "active")
    }));
    XLSX.utils.book_append_sheet(wb, createSheetWithTitle(rentalsData, "PickleBros Court - Rentals Data"), "Rentals");

    // Customers Sheet
    const customersData = filteredData.customers.map(c => ({
      ID: c.id,
      Name: c.name,
      Email: c.email,
      Phone: c.phone,
      Points: c.points,
      MemberSince: c.created_at ? format(new Date(c.created_at), "yyyy-MM-dd") : ""
    }));
    XLSX.utils.book_append_sheet(wb, createSheetWithTitle(customersData, "PickleBros Court - Customers Data"), "Customers");

    // Courts Sheet
    const courtsData = filteredData.courts.map(c => ({
      ID: c.id,
      Name: c.name,
      Description: c.description,
      PricePerHour: c.pricePerHour,
      IsActive: c.isActive ? "Yes" : "No"
    }));
    XLSX.utils.book_append_sheet(wb, createSheetWithTitle(courtsData, "PickleBros Court - Courts Data"), "Courts");

    // Inventory Sheet
    const inventoryData = filteredData.inventory.map(i => ({
      ID: i.id,
      Name: i.name,
      Category: i.category,
      Type: i.type,
      TotalQty: i.total_qty,
      AvailableQty: i.available_qty,
      Price: i.price,
      PricePerHour: i.price_per_hour
    }));
    XLSX.utils.book_append_sheet(wb, createSheetWithTitle(inventoryData, "PickleBros Court - Inventory Data"), "Inventory");

    // Sales Transactions Sheet
    const salesData = filteredData.salesTransactions.map(s => {
      let itemsStr = "";
      if (s.items) {
        const itemsArr = typeof s.items === 'string' ? JSON.parse(s.items) : s.items;
        itemsStr = Array.isArray(itemsArr) ? itemsArr.map(i => `${i.quantity}x ${i.itemName || i.name || 'Item'}`).join(", ") : "";
      }
      return {
        ID: s.id,
        Type: s.type,
        Total: s.total,
        Method: s.payment_method,
        Items: itemsStr,
        Date: s.created_at ? format(new Date(s.created_at), "yyyy-MM-dd HH:mm") : ""
      };
    });
    XLSX.utils.book_append_sheet(wb, createSheetWithTitle(salesData, "PickleBros Court - Sales Data"), "Sales");

    // Activity Logs Sheet
    const logsData = filteredData.activityLogs.map(a => ({
      ID: a.id,
      Title: a.title,
      Description: a.description,
      Date: a.created_at ? format(new Date(a.created_at), "yyyy-MM-dd HH:mm") : ""
    }));
    XLSX.utils.book_append_sheet(wb, createSheetWithTitle(logsData, "PickleBros Court - Activity Logs"), "Activity Logs");

    XLSX.writeFile(wb, `System_Full_Report_${format(new Date(), "yyyyMMdd")}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-500 mx-auto mb-3"></div>
          <span className="text-slate-400 text-sm">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 rounded-xl font-sans">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-cyan-400">
            Analytics Dashboard
          </h1>
          <p className="text-sm text-slate-400">Sports facility & equipment tracking overview.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <select 
            className="bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-violet-500 focus:border-violet-500 block p-2.5 backdrop-blur-md bg-opacity-70"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
          
          <button
            onClick={exportToExcel}
            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center gap-1.5 text-sm transition-all"
          >
            <span className="material-symbols-outlined text-base">download</span>
            Export to Excel
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <KpiCard title="Total Bookings" value={stats?.totalBookings} icon="calendar_month" color="violet" />
        <KpiCard title="Total Revenue" value={`₱${stats?.totalRevenue?.toLocaleString()}`} icon="payments" color="emerald" />
        <KpiCard title="Registered Players" value={stats?.registeredPlayers} icon="group" color="blue" />
        <KpiCard title="Payment Records" value={stats?.paymentRecords} icon="receipt_long" color="amber" />
        <KpiCard title="Equipment Sales" value={`₱${stats?.equipmentSalesTotal?.toLocaleString()}`} icon="shopping_bag" color="cyan" />
        <KpiCard title="Active Rentals" value={stats?.activeRentals} icon="sports_tennis" color="rose" />
      </section>

      {/* CHARTS GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN */}
        <div className="xl:col-span-1 space-y-6">
          <ChartCard title="Booking Status">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={bookingStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {bookingStatusData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff' }} itemStyle={{ color: '#fff' }}/>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Bookings per Court">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={bookingsPerCourtData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" stroke="#64748b" />
                <YAxis dataKey="name" type="category" width={100} stroke="#64748b" tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip cursor={{fill: '#1e293b'}} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff' }} />
                <Bar dataKey="bookings" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Payment Methods">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={paymentMethodsData} cx="50%" cy="50%" innerRadius={0} outerRadius={80} dataKey="value">
                  {paymentMethodsData.map((entry, index) => <Cell key={`cell-${index}`} fill={['#10b981', '#3b82f6', '#f59e0b'][index % 3]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* RIGHT COLUMN */}
        <div className="xl:col-span-2 space-y-6">
          <ChartCard title="Revenue Trend">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueTrendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" tick={{fill: '#94a3b8'}} />
                <YAxis stroke="#64748b" tick={{fill: '#94a3b8'}} tickFormatter={(val) => `₱${val}`} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff' }} />
                <Line type="monotone" dataKey="revenue" stroke="#06b6d4" strokeWidth={3} dot={{r: 4, fill: '#06b6d4', strokeWidth: 0}} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ChartCard title="Equipment Sales Report">
              {equipmentSalesData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[250px] text-slate-500">
                  <span className="material-symbols-outlined text-4xl mb-2">shopping_bag</span>
                  <p className="text-sm font-semibold">No sales transactions yet</p>
                  <p className="text-xs mt-1">Sales made through POS will appear here.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={equipmentSalesData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="category" stroke="#64748b" tick={{fill: '#94a3b8', fontSize: 11}} />
                    <YAxis stroke="#64748b" tick={{fill: '#94a3b8'}} tickFormatter={(val) => `₱${Number(val).toLocaleString()}`} />
                    <Tooltip cursor={{fill: '#1e293b'}} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff' }} formatter={(val) => [`₱${Number(val).toLocaleString()}`, 'Sales']} />
                    <Bar dataKey="sales" fill="#10b981" radius={[4, 4, 0, 0]}>
                      {equipmentSalesData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Equipment Rental Analytics">
              <div className="flex flex-col h-full">
                <ResponsiveContainer width="100%" height={120}>
                  <PieChart>
                    <Pie data={activeReturnedData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value">
                      <Cell fill="#f43f5e" />
                      <Cell fill="#10b981" />
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff' }} />
                    <Legend verticalAlign="top" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 text-xs text-slate-400 font-semibold mb-1 uppercase tracking-wider">Most Rented</div>
                <ResponsiveContainer width="100%" height={100}>
                  <BarChart data={mostRentedData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={80} stroke="#64748b" tick={{fill: '#94a3b8', fontSize: 11}} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: '#1e293b'}} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff' }} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>

          <ChartCard title="Bookings by Day of Week">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={bookingsByDayData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" tick={{fill: '#94a3b8'}} />
                <YAxis stroke="#64748b" tick={{fill: '#94a3b8'}} allowDecimals={false} />
                <Tooltip cursor={{fill: '#1e293b'}} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff' }} />
                <Bar dataKey="bookings" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon, color }) {
  const colorMap = {
    violet: "from-violet-600/20 to-violet-900/10 border-violet-500/30 text-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.1)]",
    emerald: "from-emerald-600/20 to-emerald-900/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]",
    blue: "from-blue-600/20 to-blue-900/10 border-blue-500/30 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]",
    amber: "from-amber-600/20 to-amber-900/10 border-amber-500/30 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)]",
    cyan: "from-cyan-600/20 to-cyan-900/10 border-cyan-500/30 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)]",
    rose: "from-rose-600/20 to-rose-900/10 border-rose-500/30 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.1)]",
  };

  const ringClass = colorMap[color];

  return (
    <div className={`bg-gradient-to-br bg-slate-900/40 backdrop-blur-md border rounded-xl p-5 transition-all hover:-translate-y-1 ${ringClass}`}>
      <div className="flex justify-between items-start mb-2">
        <div className={`p-2 rounded-lg bg-slate-950/50`}>
          <span className="material-symbols-outlined text-2xl">{icon}</span>
        </div>
      </div>
      <div>
        <h3 className="text-2xl font-black text-white tracking-tight">{value ?? 0}</h3>
        <p className="text-slate-400 font-semibold uppercase text-xs tracking-wider mt-1">{title}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/60 rounded-xl p-5 shadow-xl">
      <h3 className="text-slate-200 font-bold text-lg mb-4 flex items-center gap-2">
        {title}
      </h3>
      {children}
    </div>
  );
}