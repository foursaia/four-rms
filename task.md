# RMS Project - Master Task List

## 🛠 Phase 1: Core Portal Refinements & Printing
- [x] **Table Management (Task 2.2):**
    - [x] Implement Table Merging logic in `FloorMap.tsx`
    - [x] Refine Table Transfer logic (auto-release old tables)
- [x] **Printing & Hardware (Task 1.5):**
    - [x] Thermal Printer Integration for KOT (Kitchen Order Tickets)
    - [x] Auto-print receipt on payment confirmation
- [x] **Offline Resilience (Task 1.6):**
    - [x] Setup PWA Caching for offline Kiosk/Kitchen usage
    - [x] Implement local synchronization logic for internet outages

## 👔 Phase 2: Full Manager & CEO Functionality (UI Exists, Logic Pending)
- [/] **Manager Dashboard Logic:**
    - [x] Replace hardcoded Charts (Revenue, Orders) with real DB queries
    - [x] Connect "Popular Items" list to actual sales data
    - [x] **Menu Editor (Task 3.1):** Connect "Save" buttons to Database (Add/Edit/Delete)
    - [x] **Dynamic Device Management:** Manager UI to add/remove Kitchen, Kiosk, and Reception screens
- [ ] **CEO Analytics Logic:**
    - [x] **Global KPI:** Fetch real revenue from all branches combined
    - [x] **Staff Management:** Replace mock staff list with data from `profiles` table
    - [x] **Branch Network:** Ensure all branch stats are live, not random numbers
- [/] **Finance & Staff (Task 3.2 & 3.4):**
  - [x] Database tables (`expenses`, `attendance`) created (with safe SQL).
  - [x] Update `manager/page.tsx` with Finance & HR tab.
  - [x] Implement Expense Tracker UI (Add Expense, List Expenses).
  - [x] Implement Staff Attendance UI (List branch staff, Mark Present/Absent).
  - [ ] Add auto-attendance on login (requires an Auth/Login screen first).

## 💰 Phase 3: Finance & Cash Operations
- [x] **Shift & Cash (Task 2.4):**
    - [x] Implement Opening/Closing float for Cash Drawer
    - [x] Build shift reconciliation reports (Expected vs Actual cash)

## 🌐 Phase 4: Online Ordering & Customer Experience
- [ ] **Customer Website (Task 4.2):**
    - [ ] High-conversion landing page and online menu
    - [ ] Mobile-responsive checkout flow (integrated with POS)
- [ ] **AI Voice Agent (Task 5.3):**
    - [ ] Connect Vapi/Retell for Urdu conversational phone orders
- [ ] **WhatsApp Automations (19 Flows):**
    - [ ] Setup N8n workflows for notifications (Confirmed, Ready, Delivered)
    - [ ] Implement alerts (Low stock, Cash discrepancy, Peak hour)

---

## ✅ Completed Tasks
- [x] Basic Portal Layouts (Kiosk, Kitchen, Reception, Rider, CEO)
- [x] Global Time Synchronization (PKT)
- [x] Real-time Audio Alerts (Kitchen/Display)
- [x] Basic Table Management and Map UI
