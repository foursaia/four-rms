# RMS — Complete Component Structure
## All 6 Panels | React.js / React Native | PRD v1.0

---

## SHARED / COMMON LAYER
```
src/
├── lib/
│   ├── supabase.ts              # Supabase client (singleton)
│   ├── realtime.ts             # Supabase Realtime subscriptions
│   ├── api.ts                  # typed fetch wrappers
│   └── n8n.ts                  # n8n webhook triggers
│
├── hooks/
│   ├── useAuth.ts              # auth.uid() + staff profile
│   ├── useOrders.ts            # realtime orders subscription
│   ├── useProducts.ts          # menu with cache
│   ├── useOrderETA.ts          # dynamic ETA calculation
│   └── useBranch.ts            # branch context
│
├── stores/                     # Zustand global state
│   ├── authStore.ts
│   ├── orderStore.ts
│   ├── cartStore.ts            # kiosk/website cart
│   ├── uiStore.ts
│   └── realtimeStore.ts        # FIX #7: Supabase channel subscription registry
│
├── components/ui/              # Design system primitives
│   ├── Button.tsx
│   ├── Badge.tsx               # status badges (Paid, Pending…)
│   ├── Card.tsx
│   ├── Modal.tsx
│   ├── Toast.tsx
│   ├── Spinner.tsx
│   ├── Avatar.tsx
│   ├── DataTable.tsx           # sortable, filterable table
│   ├── DateRangePicker.tsx     # shared across all report panels
│   ├── StatCard.tsx            # revenue / order count cards
│   └── EmptyState.tsx
│
└── types/
    ├── order.ts
    ├── product.ts
    ├── staff.ts
    └── db.ts                   # auto-generated from Supabase CLI
```

---

## PANEL 1 — CUSTOMER KIOSK
> Device: Tablet | Auth: None | Platform: PWA (React.js)

```
kiosk/
├── KioskApp.tsx                    # Root — idle timeout, reset session

├── screens/
│   ├── EntryScreen.tsx             # Full-screen "Dine In / Takeaway" CTA
│   │   ├── OrderTypeButton.tsx     # Large touch button (Dine In / Takeaway)
│   │   └── BackgroundSlideshow.tsx # Promotional images / branding
│   │
│   ├── MenuScreen.tsx              # Main ordering layout (2-panel)
│   │   ├── CategorySidebar.tsx     # Left — vertical category list
│   │   │   └── CategoryTile.tsx    # Image + name, tap to filter
│   │   ├── ProductGrid.tsx         # Right — responsive product grid
│   │   │   └── ProductCard.tsx     # Image, name, price, Add button
│   │   ├── AllergenFilterBar.tsx   # Top — dietary filter toggles
│   │   └── CartFloatingButton.tsx  # Bottom-right — shows item count
│   │
│   ├── ProductDetailScreen.tsx     # Full-screen product detail
│   │   ├── ProductHero.tsx         # Large image + name + description
│   │   ├── IngredientToggleList.tsx # Default (removable) ingredients
│   │   │   └── IngredientChip.tsx  # Toggle chip — selected / deselected
│   │   ├── AddonList.tsx           # Optional add-ons
│   │   │   └── AddonChip.tsx
│   │   ├── QuantitySelector.tsx    # − / count / + stepper
│   │   ├── RecommendedItems.tsx    # AI upsell overlay
│   │   └── AddToOrderButton.tsx    # Sticky bottom CTA
│   │
│   ├── BeverageSelectionScreen.tsx # Post-item beverage prompt
│   │   ├── BeverageGrid.tsx
│   │   └── SkipButton.tsx
│   │
│   ├── CartScreen.tsx              # Order summary before confirm
│   │   ├── CartItemRow.tsx         # Item, customisations, qty, price
│   │   ├── CartSummary.tsx         # Subtotal / tax / total in PKR
│   │   ├── EditItemButton.tsx      # Go back to product detail
│   │   └── ConfirmOrderButton.tsx
│   │
│   ├── PaymentScreen.tsx           # Choose Cash or Card
│   │   ├── CashInstructions.tsx    # "Please pay at counter"
│   │   └── CardTerminalPrompt.tsx  # "Tap / Insert card"
│   │
│   └── OrderConfirmScreen.tsx      # Post-payment success
│       ├── OrderNumberDisplay.tsx  # Large, bold — #0042
│       ├── ETADisplay.tsx          # "Ready in ~12 mins"
│       └── ThankYouAnimation.tsx   # Lottie / CSS animation
│
└── components/
    ├── KioskHeader.tsx             # Restaurant logo + time
    ├── KioskNavBar.tsx             # Back + Cart button
    └── IdleResetTimer.tsx          # Auto-reset after 90s of inactivity
```

---

## PANEL 2 — RECEPTIONIST
> Device: Desktop / Tablet | Auth: Staff ID + Password | Platform: React.js

```
receptionist/
├── ReceptionistApp.tsx

├── auth/
│   ├── LoginPage.tsx
│   │   ├── StaffIdInput.tsx
│   │   └── PasswordInput.tsx
│   └── ShiftOpeningModal.tsx       # Mandatory on first login
│       └── OpeningFloatInput.tsx

├── layout/
│   ├── ReceptionistLayout.tsx      # Sidebar + main content
│   ├── Sidebar.tsx                 # Nav: Orders, Tables, Manual, Cash, Reports
│   ├── TopBar.tsx                  # Staff name, date/time, shift info
│   └── NotificationBar.tsx         # Order ready alerts, stock alerts

├── pages/
│   ├── OrderQueuePage.tsx          # MAIN — live order management
│   │   ├── OrderQueueFilters.tsx   # Filter: All / Dine-In / Takeaway / Delivery / Source
│   │   ├── OrderList.tsx           # Realtime list
│   │   │   └── OrderCard.tsx       # Order#, type badge, source badge, items, total, status, time
│   │   ├── OrderDetailDrawer.tsx   # Slide-in: full order detail + actions
│   │   │   ├── OrderItemsList.tsx
│   │   │   ├── CustomisationTags.tsx
│   │   │   ├── OrderStatusStepper.tsx
│   │   │   ├── MarkPaidButton.tsx
│   │   │   ├── ModifyOrderButton.tsx   # Only within 2-min window
│   │   │   └── CancelOrderButton.tsx
│   │   └── OrderReadyToast.tsx     # Pop-up when kitchen marks ready
│   │
│   ├── TableManagementPage.tsx
│   │   ├── FloorMapCanvas.tsx      # Visual drag-and-drop floor layout
│   │   │   └── TableNode.tsx       # Color-coded: green/red/yellow + order#
│   │   ├── AssignTableModal.tsx    # Assign order → table
│   │   ├── TableStatusPanel.tsx    # List view fallback
│   │   └── AddRemoveTableControls.tsx
│   │
│   ├── ManualOrderPage.tsx         # Receptionist enters order manually
│   │   ├── ManualCategoryNav.tsx
│   │   ├── ManualProductGrid.tsx
│   │   ├── ManualProductModal.tsx  # Ingredient customisation
│   │   ├── ManualCart.tsx
│   │   ├── CustomerInfoForm.tsx    # Name, WhatsApp (for delivery)
│   │   └── ManualOrderSummary.tsx
│   │
│   ├── CashDrawerPage.tsx
│   │   ├── DrawerBalanceDisplay.tsx # Current balance in PKR
│   │   ├── TransactionForm.tsx      # Cash-In / Cash-Out + reason
│   │   ├── TransactionHistory.tsx   # Today's transactions log
│   │   └── ShiftCloseModal.tsx      # Closing float + discrepancy report
│   │
│   └── SalesDashboardPage.tsx       # Today's live stats
│       ├── SalesStatCards.tsx       # Dine-In / Takeaway / Online / Voice / Total
│       └── OrderSourceBreakdown.tsx # Mini chart
│
└── components/
    ├── OrderSourceBadge.tsx         # "Kiosk" | "Website" | "Voice" | "Manual"
    ├── OrderTypeBadge.tsx           # "Dine-In" | "Takeaway" | "Delivery"
    ├── PaymentStatusBadge.tsx       # "Paid" | "Pending" | "COD"
    ├── OrderTimestamp.tsx           # Time elapsed
    └── ModifyOrderModal.tsx         # Edit items/qty/customisations + reason
        ├── ManagerApprovalRequired.tsx
        └── ModifyItemRow.tsx
```

---

## PANEL 3 — KITCHEN DISPLAY SYSTEM (KDS)
> Device: Tablet (wall-mounted) | Auth: Staff ID + Password | Platform: React.js PWA

```
kitchen/
├── KitchenApp.tsx                  # Always-on, fullscreen, no timeout

├── auth/
│   └── KitchenLoginPage.tsx        # Simple ID + password

├── layout/
│   ├── KDSLayout.tsx               # Dark theme, high contrast
│   └── KDSHeader.tsx               # Branch name, time, active order count

├── pages/
│   └── KitchenDisplayPage.tsx      # Main and only screen
│       ├── OrderGrid.tsx           # Columns: sorted by time (oldest first)
│       │   └── KitchenOrderCard.tsx
│       │       ├── OrderNumberHeader.tsx       # Large bold #0042
│       │       ├── OrderTypeBadge.tsx          # Dine-In / Takeaway / Delivery
│       │       ├── OrderSourceBadge.tsx        # Voice Order badge
│       │       ├── ElapsedTimerBadge.tsx       # Auto-counting timer, red if >15min
│       │       ├── ItemCheckList.tsx           # Items with customisations
│       │       │   └── KitchenItemRow.tsx      # Checkbox to mark item ready
│       │       └── MarkOrderReadyButton.tsx    # Full-width CTA
│       │
│       ├── NewOrderAlert.tsx       # Audio + visual flash for new order
│       ├── ItemAvailabilityPanel.tsx # Side panel — quick out-of-stock toggle
│       │   └── StockToggleRow.tsx  # Item name + toggle switch
│       └── KDSFilterBar.tsx        # Filter: All / Dine-In / Delivery
│
└── components/
    ├── KitchenBadge.tsx
    ├── AudioAlert.tsx              # Plays beep on new order
    └── FullscreenGuard.tsx         # Auto re-enters fullscreen if exited
```

---

## PANEL 4 — MANAGER
> Device: Desktop / Tablet | Auth: Password + PIN | Platform: React.js

```
manager/
├── ManagerApp.tsx

├── auth/
│   ├── ManagerLoginPage.tsx
│   └── PinVerificationModal.tsx    # 2-step: after password

├── layout/
│   ├── ManagerLayout.tsx
│   ├── ManagerSidebar.tsx          # Dashboard / Reports / Staff / Menu / Kitchen / Alerts
│   ├── ManagerTopBar.tsx
│   └── AlertsBanner.tsx            # Peak hour / low stock / cash discrepancy

├── pages/
│   ├── DashboardPage.tsx           # Real-time operational overview
│   │   ├── LiveStatCards.tsx       # Orders today, revenue, pending, completed
│   │   ├── KitchenQueuePreview.tsx # Read-only KDS view (condensed)
│   │   ├── RecentCancellations.tsx
│   │   └── PeakHourAlert.tsx       # Banner: "18 orders in last 15 mins"
│   │
│   ├── SalesReportsPage.tsx
│   │   ├── DateRangePicker.tsx     # Today/Yesterday/Week/Month/Custom
│   │   ├── SalesSummaryCards.tsx   # Revenue / Order Count / AOV
│   │   ├── OrderTypeBreakdown.tsx  # Dine-In vs Takeaway vs Online vs Voice
│   │   ├── RevenueBarChart.tsx     # Recharts BarChart
│   │   ├── RevenueTrendLineChart.tsx
│   │   ├── CancellationSection.tsx # Count, total refunded, top reasons
│   │   └── ExportButtons.tsx       # PDF / Excel download
│   │
│   ├── StaffManagementPage.tsx
│   │   ├── StaffListTable.tsx      # Name, role, branch, status, actions
│   │   ├── CreateStaffModal.tsx    # Role, name, phone, salary structure
│   │   ├── EditStaffModal.tsx
│   │   ├── DeactivateStaffModal.tsx
│   │   └── StaffDetailDrawer.tsx
│   │       ├── ShiftLogTable.tsx   # Per-staff shift history
│   │       ├── CashDrawerHistory.tsx
│   │       └── PerformanceMetrics.tsx  # Orders processed, modifications, cancellations
│   │
│   ├── MenuManagementPage.tsx
│   │   ├── CategoryManager.tsx     # Add/edit/sort/delete categories
│   │   │   └── CategoryForm.tsx
│   │   ├── ProductListTable.tsx    # All products with status + availability toggle
│   │   ├── ProductFormModal.tsx    # Add/edit product
│   │   │   ├── BasicInfoTab.tsx    # Name, price, desc, image
│   │   │   ├── IngredientsTab.tsx  # Default + addon ingredients
│   │   │   ├── DietaryTagsTab.tsx  # Allergen checkboxes
│   │   │   └── RecommendationsTab.tsx  # Pin upsell items
│   │   └── AvailabilityToggle.tsx  # Available / Out of Stock / Hidden
│   │
│   ├── ShiftManagementPage.tsx
│   │   ├── WeeklyScheduleCalendar.tsx  # Staff × Day grid
│   │   ├── AssignShiftModal.tsx
│   │   ├── AttendanceLogTable.tsx
│   │   └── OvertimeSummaryCard.tsx
│   │
│   ├── SalaryPage.tsx
│   │   ├── SalaryProfilesTable.tsx     # Each staff, their structure + rates
│   │   ├── EditSalaryProfileModal.tsx
│   │   ├── MonthlyPayrollSheet.tsx     # Month selector + staff rows
│   │   │   └── PayrollRow.tsx          # Base / OT / Deductions / Net / Status
│   │   ├── SalaryAdjustmentModal.tsx   # Bonus / Penalty + reason (logged)
│   │   ├── MarkAsPaidModal.tsx         # Payment method + date
│   │   ├── SalarySlipPreview.tsx       # PDF preview before sending
│   │   └── AdvanceManagementPanel.tsx
│   │
│   ├── ExpenseTrackingPage.tsx
│   │   ├── ExpenseForm.tsx             # Date, category, amount, receipt upload
│   │   ├── ExpenseListTable.tsx
│   │   ├── BudgetVsActualChart.tsx     # Per category bar chart
│   │   └── ExportExpensesButton.tsx
│   │
│   ├── FeedbackPage.tsx
│   │   ├── RatingOverviewCards.tsx     # Average rating, trend
│   │   ├── FeedbackTable.tsx           # Per order: rating, comment, customer
│   │   ├── LowRatedItemsAlert.tsx      # Items with 3+ consecutive low ratings
│   │   └── GoogleReviewFunnelChart.tsx
│   │
│   ├── BroadcastPage.tsx
│   │   ├── BroadcastComposer.tsx       # Message + image + audience filter
│   │   ├── ScheduleSelector.tsx
│   │   ├── BroadcastHistoryTable.tsx
│   │   └── BroadcastStatsCard.tsx      # Sent / Delivered / Read
│   │
│   ├── InventoryPage.tsx               # Phase 2
│   │   ├── InventoryTable.tsx
│   │   ├── AdjustStockModal.tsx
│   │   ├── LowStockAlerts.tsx
│   │   └── DailyStockSummary.tsx
│   │
│   ├── PeakHourConfigPage.tsx
│   │   ├── ThresholdInput.tsx
│   │   └── WindowMinutesInput.tsx
│   │
│   └── QRCodeManagerPage.tsx
│       ├── TableQRList.tsx
│       └── PrintQRButton.tsx
│
└── components/
    ├── ReportExportButton.tsx      # Shared PDF/Excel export
    ├── StaffRoleBadge.tsx
    └── ConfirmActionModal.tsx      # Destructive action confirmation
```

---

## PANEL 5 — CEO
> Device: Desktop / Mobile | Auth: Password + PIN | Platform: React.js

```
ceo/
├── CEOApp.tsx

├── auth/
│   ├── CEOLoginPage.tsx
│   └── PinVerificationModal.tsx

├── layout/
│   ├── CEOLayout.tsx
│   ├── CEOSidebar.tsx              # BI Dashboard / Reports / Salary / Staff / Forecasting
│   └── BranchSwitcher.tsx          # Phase 2: All Branches / Branch A / Branch B

├── pages/
│   ├── BIDashboardPage.tsx         # Main business intelligence view
│   │   ├── RevenueOverviewSection.tsx
│   │   │   ├── GrandTotalCard.tsx
│   │   │   ├── RevenueLineChart.tsx        # Daily/Weekly/Monthly/Yearly toggle
│   │   │   └── RevenueBySourceChart.tsx    # Kiosk vs Website vs Voice — Pie / Donut
│   │   ├── OrderVolumeSection.tsx
│   │   │   ├── OrderCountTrendChart.tsx
│   │   │   └── AOVCard.tsx                 # Average Order Value
│   │   ├── PeakHoursHeatmap.tsx            # Hour × Day grid, colour intensity
│   │   ├── BestSellingItemsTable.tsx        # Top N items by revenue and quantity
│   │   ├── ReturningVsNewCustomers.tsx      # Doughnut chart
│   │   ├── UpsellConversionCard.tsx         # AI recommendation conversion rate
│   │   └── PayrollVsRevenueCard.tsx         # Labour cost ratio
│   │
│   ├── InvoiceDownloadPage.tsx     # Core CEO feature — flexible reports
│   │   ├── DateRangeSelector.tsx   # Presets: Today/Week/Month/Last 3M/Last 6M/Year
│   │   ├── CustomDatePicker.tsx    # Calendar range picker
│   │   ├── CustomHourPicker.tsx    # Specific date + start/end time
│   │   ├── InvoicePreview.tsx      # PDF preview in browser (iFrame or react-pdf)
│   │   ├── DownloadPDFButton.tsx
│   │   └── DownloadExcelButton.tsx
│   │
│   ├── SalaryHistoryPage.tsx       # Read-only full payroll view
│   │   ├── MonthSelector.tsx
│   │   ├── PayrollSummaryCard.tsx  # Total payroll / staff count / manual adjustments
│   │   ├── StaffPayrollTable.tsx   # Per-staff: structure, gross, deductions, net, status
│   │   ├── FlaggedAdjustmentsList.tsx   # Manager manual changes — flagging UI
│   │   └── PayrollTrendChart.tsx        # Year-on-year payroll cost
│   │
│   ├── CancellationsRefundsPage.tsx    # Read-only
│   │   ├── RefundSummaryCards.tsx
│   │   ├── CancellationReasonsChart.tsx # Bar chart by reason
│   │   └── RefundTransactionTable.tsx
│   │
│   ├── StaffPerformancePage.tsx    # Read-only overview
│   │   ├── PerStaffMetricsTable.tsx
│   │   └── ShiftComplianceChart.tsx    # On-time vs late by week
│   │
│   ├── DemandForecastPage.tsx
│   │   ├── WeeklyForecastCard.tsx      # Mon–Sun expected orders
│   │   ├── ForecastVsActualChart.tsx
│   │   └── ForecastAccuracyBadge.tsx
│   │
│   └── ExpensePnLPage.tsx          # Profit overview
│       ├── RevenueSummaryCard.tsx
│       ├── ExpenseSummaryCard.tsx
│       └── NetProfitCard.tsx        # Revenue − Expenses = Profit (visual gauge)
│
└── components/
    ├── ReadOnlyBadge.tsx           # Subtle indicator: CEO view is read-only
    ├── ChartTooltip.tsx            # Shared rich tooltip for all charts
    └── CEOStatCard.tsx             # Large KPI card with sparkline
```

---

## PANEL 6 — DELIVERY BOY
> Device: Mobile | Auth: Staff ID + Password | Platform: React Native / Flutter

```
delivery/
├── DeliveryApp.tsx (React Native root)

├── auth/
│   └── LoginScreen.tsx             # Staff ID + Password

├── navigation/
│   └── DeliveryNavigator.tsx       # Bottom tab: Orders / Profile

├── screens/
│   ├── OrderQueueScreen.tsx        # Active delivery orders
│   │   ├── OrderCard.tsx           # Compact: order#, customer, address, total
│   │   ├── EmptyQueueState.tsx
│   │   └── RefreshControl           # Pull-to-refresh
│   │
│   ├── OrderDetailScreen.tsx       # Full order detail for one delivery
│   │   ├── CustomerInfoCard.tsx    # Name, WhatsApp tap-to-call, address
│   │   ├── ItemsListCard.tsx       # Items ordered (read-only)
│   │   ├── TotalAmountCard.tsx     # COD amount to collect
│   │   ├── OpenInMapsButton.tsx    # Launches Google Maps with address
│   │   ├── WhatsAppCallButton.tsx  # Direct WhatsApp link to customer
│   │   ├── OutForDeliveryButton.tsx  # Status update
│   │   └── MarkDeliveredButton.tsx   # Status update → triggers notification
│   │
│   └── ProfileScreen.tsx
│       ├── DeliveryBoyNameCard.tsx
│       ├── TodayDeliveryCount.tsx
│       └── LogoutButton.tsx
│
└── components/
    ├── StatusUpdateToast.tsx       # "Status updated successfully"
    ├── DeliveryStatusBadge.tsx     # Assigned / Out / Delivered
    └── OfflineIndicator.tsx        # Shows when no internet
```

---

## SUPPLEMENTARY — WEBSITE (Online Ordering)
> Next.js | Public-facing | Mobile + Desktop

```
website/ (Next.js App Router)
├── app/
│   ├── page.tsx                    # Landing / redirect to /menu
│   ├── menu/
│   │   └── page.tsx                # MenuPage.tsx
│   │       ├── CategorySidebar.tsx
│   │       ├── ProductGrid.tsx
│   │       ├── AllergenFilterBar.tsx
│   │       └── CartStickyFooter.tsx
│   ├── product/[id]/
│   │   └── page.tsx                # ProductDetailPage.tsx
│   │       ├── ProductImages.tsx
│   │       ├── IngredientCustomiser.tsx
│   │       ├── AddonSelector.tsx
│   │       ├── RecommendedRow.tsx  # "You may also like"
│   │       └── AddToCartButton.tsx
│   ├── checkout/
│   │   └── page.tsx                # CheckoutPage.tsx
│   │       ├── CartReview.tsx
│   │       ├── CustomerInfoForm.tsx  # Name, WhatsApp, Delivery address
│   │       ├── BeverageStep.tsx
│   │       ├── CODInfoBox.tsx
│   │       └── PlaceOrderButton.tsx
│   └── order-confirmed/
│       └── page.tsx                # OrderConfirmedPage.tsx
│           ├── OrderNumberDisplay.tsx
│           ├── ETADisplay.tsx
│           └── TrackingInfo.tsx

├── components/
│   ├── WebHeader.tsx               # Logo + Cart icon
│   ├── RecentOrdersSection.tsx     # For returning customers (by WhatsApp)
│   └── ScheduleOrderToggle.tsx     # Pre-order date/time picker
│
└── api/
    ├── orders/route.ts             # POST new order → Supabase + n8n webhook
    └── customer/route.ts           # GET customer by WhatsApp
```

---

## TABLE RELATIONSHIPS SUMMARY

```
branches ─────────────────────────────────────────────────────────────────┐
  ├── staff (branch_id)                                                    │
  ├── categories (branch_id)                                               │
  │     └── products (category_id)                                         │
  │           ├── product_ingredients → ingredients                        │
  │           ├── product_dietary_tags                                     │
  │           └── product_recommendations (product_id ↔ recommended_id)   │
  ├── restaurant_tables (branch_id)                                        │
  ├── orders (branch_id)                                                   │
  │     ├── order_items (order_id) → products                             │
  │     │     └── order_item_customisations → ingredients                  │
  │     ├── order_modifications → staff                                    │
  │     ├── order_cancellations → staff                                    │
  │     ├── delivery_assignments → staff (delivery_boy)                    │
  │     └── customer_feedback → customers                                  │
  ├── shifts (branch_id) → staff                                           │
  ├── cash_drawer_sessions → staff, shifts                                 │
  │     └── cash_transactions → orders                                     │
  ├── inventory_items → ingredients                                        │
  │     └── inventory_transactions → orders                               │
  ├── expenses                                                              │
  ├── salary_profiles → staff                                              │
  │     └── salary_records → salary_adjustments, salary_advances          │
  ├── broadcasts → broadcast_recipients → customers                        │
  ├── notification_logs                                                     │
  └── demand_forecasts                                                     │
                                                                           │
customers ────────────────────────────────────────────────────────────────┘
  └── orders (customer_id)
```

---

## SUPABASE REALTIME — SUBSCRIPTION MAP

| Panel          | Subscribes To                                    | Events        |
|----------------|--------------------------------------------------|---------------|
| Receptionist   | orders, restaurant_tables, inventory_items        | INSERT, UPDATE |
| Kitchen (KDS)  | orders, order_items, products (status changes)   | INSERT, UPDATE |
| Delivery Boy   | delivery_assignments                             | INSERT, UPDATE |
| Manager        | orders (read), inventory_items, peak_hour_config  | UPDATE        |
| CEO            | No realtime (report snapshots only)              | —             |
| Kiosk          | products (availability changes)                  | UPDATE        |

---

## STATE MANAGEMENT STRATEGY

| Store         | Contents                                   | Panels Using          |
|---------------|--------------------------------------------|-----------------------|
| authStore     | staff profile, role, branch_id             | All                   |
| orderStore    | live orders list, active order selected    | Receptionist, Kitchen |
| cartStore     | items, customisations, order type          | Kiosk, Website        |
| uiStore       | modals open, sidebar state, active page    | All admin panels      |
| realtimeStore | Supabase channel subscriptions registry    | Receptionist, Kitchen |

---
*Generated from RMS PRD v1.0 — April 2025*
