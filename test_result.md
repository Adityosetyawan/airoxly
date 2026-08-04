#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

## user_problem_statement:
"Setelah selesai mengisi data Transaksi pembelian, sekali klik 'kirim WA, simpan sekaligus kupon kartu undian' langsung terkirim ke no WA pelanggan seperti contoh gambar." + earlier scope for Customer sorting/ranking and Admin/SuperAdmin customer views.

## Session Scope (Aug 2026):
1. Backend sort: added "recent" & "debt" sort options for /api/customers; fixed "last" sort to push never-purchased customers to bottom.
2. Sales customers.tsx: added "Terbaru Beli" & "Hutang Terbesar" sort chips.
3. New shared CustomersList + CustomerDetailReadonly components.
4. New Admin route /(admin)/customers + customer/[id] (scoped by group_letter) with sales-filter dropdown.
5. New SuperAdmin route /(superadmin)/customers + customer/[id] (all sales) with sales-filter dropdown.
6. Improved scanner permission UX: proper Alert with "Buka Pengaturan" via Linking.openSettings when canAskAgain=false.
7. WhatsApp receipt+ticket flow reworked: new sendReceiptToWhatsApp util → saves ticket image to gallery, copies image bytes to clipboard, opens wa.me deep link directly to customer's saved number with nota pre-filled. No share sheet, no contact picker.
8. Button relabeled "Kirim WA, Simpan & Kupon" on transaction form.

## backend:
  - task: "GET /api/customers with new sort options (recent, debt) + null-safe last sort"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Regex extended to include recent|debt; last sort now moves customers with null last_purchase_date to the bottom (was showing them first because Mongo sorts null ascending). recent sort pushes null-date customers to end. debt sort by total_debt desc."

## frontend:
  - task: "Admin customer list + detail (group-filtered) with sales filter"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(admin)/customers.tsx, /app/frontend/app/(admin)/customer/[id].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
  - task: "SuperAdmin customer list + detail (all sales) with sales filter"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(superadmin)/customers.tsx, /app/frontend/app/(superadmin)/customer/[id].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
  - task: "Sales customers sort chips: added Terbaru Beli & Hutang Terbesar"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(sales)/customers.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
  - task: "One-tap WA receipt+ticket: wa.me deep link + gallery save + image to clipboard"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/utils/capture.ts, /app/frontend/app/(sales)/transaction/[id].tsx, /app/frontend/app/(sales)/transaction/new.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "New sendReceiptToWhatsApp util replaces shareShotWithText. Note: full WA send (image auto-attach) CANNOT be tested in web preview or Expo Go — needs a real device build. Backend-side and non-native flow can be validated (wa.me deep link opens; text prefill works).  MediaLibrary + Clipboard.setImageAsync only functional on native."

## metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 13

## Follow-up (same session):
User requested: "Sertakan no undian pada WA bukti Transaksi. Dan pada kupon undian otomatis sudah didownload. Apabila mau dikirim ke pelanggan langsung klik WA lagi."

Changes:
1. `formatReceipt` (whatsapp.ts) now renders lottery ticket numbers inside the receipt text under a "🎁 Kupon Undian" section.
2. `sendReceiptToWhatsApp` simplified: no longer copies image to clipboard. Only saves to gallery + opens wa.me with pre-filled text (which already contains ticket numbers).
3. Two clearly separated actions on the transaction detail page:
   - Primary: "Kirim Nota WA (+ Nomor Undian)" — text nota with ticket numbers
   - Secondary (green): "Kirim Kartu Undian ke WA" — opens share sheet to send just the ticket card image
4. Toast updated: "Nota terkirim. Kartu Undian tersimpan di galeri — klik 'Kirim Kartu Undian' untuk kirim gambarnya"

Manually verified in web preview: transaction detail loaded with ticket card + both buttons visible; button labels correct. wa.me deep link opens with encoded text including "OXLY-XXXXXX". Sharing/save gallery flows require native device.

  run_ui: true

## test_plan:
  current_focus:
    - "GET /api/customers with new sort options (recent, debt) + null-safe last sort"
    - "Admin customer list + detail with sales filter"
    - "SuperAdmin customer list + detail with sales filter"
    - "Sales customers sort chips update"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

## agent_communication:
    -agent: "main"
    -message: "Backend: only /api/customers endpoint signature changed (sort pattern regex + Python post-sort for last/recent). Please verify: (1) sort=no|ranking|recent|last|loans|debt all return 200 with correct ordering, (2) sort=last places customers with null last_purchase_date at the end and orders remaining ascending, (3) sort=recent places customers with a purchase first (descending by date) and null-date customers last, (4) admin role scope still respects group_letter filter, (5) sales role only sees own customers, (6) super_admin optional sales_id filter still works. Frontend: verify Admin dashboard has a new 'Kelola Pelanggan' link that opens Pelanggan Wilayah scoped to their group. SuperAdmin dashboard has 'Data Pelanggan' Quick Access opening Semua Pelanggan. Both should have a working sales-filter dropdown and 6 sort chips. Do NOT attempt to test the WhatsApp/clipboard/gallery-save flow — it only works on native builds. Just verify the transaction detail page still renders, the button label reads 'Kirim WA, Simpan & Kupon' on new transaction form, and no crashes."
