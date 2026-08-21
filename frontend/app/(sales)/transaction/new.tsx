import React, { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { theme, rp } from "@/src/theme";
import { api, Customer, Product, Transaction, TransactionItem } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import { formatReceipt, sendWhatsApp } from "@/src/whatsapp";
import { useAuth } from "@/src/AuthContext";
import { useOnlineStatus } from "@/src/hooks/useOnlineStatus";
import {
  enqueueTransaction,
  getCachedCustomer,
  getCachedProducts,
  patchCachedCustomer,
} from "@/src/utils/offlineStore";
import { useCalcBar } from "@/src/components/KeyboardCalcBar";

export default function TransactionForm() {
  const params = useLocalSearchParams<{ customer_id?: string; edit_id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user } = useAuth();
  const online = useOnlineStatus();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [bayar, setBayar] = useState("");
  const [pinjam, setPinjam] = useState("");
  const [kembali, setKembali] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Try network first; fall back to offline cache for products & customer.
        let prods: Product[] = [];
        try {
          prods = await api.listProducts();
        } catch {
          prods = await getCachedProducts();
        }
        // Filter products by access control (allowed_groups / allowed_sales).
        // Empty lists on both = terbuka untuk semua.
        const myGroup = (user?.group_letter || "").toUpperCase().trim();
        const mySalesCode = (user?.sales_code || user?.username || "").toUpperCase().trim();
        prods = prods.filter((p) => {
          const groups = (p.allowed_groups || []).map((g) => (g || "").toUpperCase());
          const sales = (p.allowed_sales || []).map((s) => (s || "").toUpperCase());
          if (groups.length === 0 && sales.length === 0) return true;
          if (groups.includes(myGroup)) return true;
          if (sales.includes(mySalesCode)) return true;
          return false;
        });
        setProducts(prods);

        if (params.edit_id) {
          const t = await api.listTransactions({ customer_id: params.customer_id });
          const tx = t.find((x) => x.id === params.edit_id);
          if (tx) {
            setEditingTxn(tx);
            const q: Record<string, number> = {};
            tx.items.forEach((i) => (q[i.product_id] = i.qty));
            setQtys(q);
            setBayar(String(tx.bayar || ""));
            setPinjam(String(tx.pinjam_galon || ""));
            setKembali(String(tx.galon_kembali || ""));
          }
        } else {
          // NEW transaction — reset any stale inputs from a previous session
          // (e.g., Sales balik ke customer yang sama & buat transaksi baru).
          setEditingTxn(null);
          setQtys({});
          setBayar("");
          setPinjam("");
          setKembali("");
        }

        if (params.customer_id) {
          let c: Customer | null = null;
          try {
            c = await api.getCustomer(params.customer_id);
          } catch {
            c = await getCachedCustomer(params.customer_id);
          }
          setCustomer(c);
        }
      } catch (e: any) {
        // Last-resort attempt from cache.
        const [prods, c] = await Promise.all([
          getCachedProducts(),
          params.customer_id ? getCachedCustomer(params.customer_id) : Promise.resolve(null),
        ]);
        setProducts(prods);
        setCustomer(c);
        if (prods.length === 0 || !c) {
          toast.show(e.message || "Gagal muat data", "error");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [params.customer_id, params.edit_id, toast, user?.group_letter, user?.sales_code, user?.username]);

  // Calc bars for numeric fields
  const bayarBar = useCalcBar(bayar, { hint: "Uang dibayar" });
  const pinjamBar = useCalcBar(pinjam, { hint: "Pinjam galon", format: (r) => `${parseInt(r, 10) || 0} galon` });
  const kembaliBar = useCalcBar(kembali, { hint: "Galon kembali", format: (r) => `${parseInt(r, 10) || 0} galon` });

  const items: TransactionItem[] = useMemo(
    () =>
      products
        .map((p) => ({
          product_id: p.id,
          product_name: p.name,
          unit: p.unit,
          qty: qtys[p.id] || 0,
          price: p.price,
          subtotal: (qtys[p.id] || 0) * p.price,
        }))
        .filter((i) => i.qty > 0),
    [products, qtys],
  );

  const total = useMemo(() => items.reduce((a, b) => a + b.subtotal, 0), [items]);
  const bayarNum = parseFloat(bayar) || 0;
  const pinjamNum = parseInt(pinjam) || 0;
  const kembaliNum = parseInt(kembali) || 0;
  const sisa = bayarNum - total;
  const hutangTx = sisa < 0 ? -sisa : 0;

  const setQ = (pid: string, delta: number) => {
    setQtys((q) => ({ ...q, [pid]: Math.max(0, (q[pid] || 0) + delta) }));
  };

  const doSave = async (sendWA: boolean) => {
    if (!customer) return;
    if (items.length === 0 && pinjamNum === 0 && kembaliNum === 0) {
      toast.show("Tambahkan minimal 1 item atau pinjam/kembali galon", "error");
      return;
    }

    // ── OFFLINE PATH: enqueue locally and update cached customer optimistically.
    if (!online && !editingTxn) {
      setSaving(true);
      try {
        const localId =
          (typeof crypto !== "undefined" && (crypto as any).randomUUID)
            ? (crypto as any).randomUUID()
            : `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

        await enqueueTransaction({
          local_id: localId,
          customer_id: customer.id,
          customer_name: customer.name,
          customer_no: customer.customer_no,
          items,
          bayar: bayarNum,
          pinjam_galon: pinjamNum,
          galon_kembali: kembaliNum,
          total,
        });

        // Optimistic cache update so the customer detail screen still shows
        // consistent balances while offline.
        const newDebt = Math.max(0, (customer.total_debt || 0) - Math.min(customer.total_debt || 0, Math.max(0, bayarNum - total))) + Math.max(0, total - bayarNum);
        const newLoans = Math.max(0, (customer.gallon_loans || 0) + pinjamNum - kembaliNum);
        await patchCachedCustomer(customer.id, {
          total_debt: newDebt,
          gallon_loans: newLoans,
          total_purchases: (customer.total_purchases || 0) + total,
          purchase_count: (customer.purchase_count || 0) + 1,
          last_purchase_date: new Date().toISOString(),
        });

        toast.show(
          "📴 Offline — transaksi disimpan & akan sinkron saat online",
          "success",
        );

        if (sendWA && customer.wa_number) {
          try {
            const msg = formatReceipt({
              storeName: "Air OXLY",
              salesCode: user?.sales_code || user?.username,
              customerName: customer.name,
              customerNo: customer.customer_no,
              date: new Date().toISOString(),
              items,
              total,
              bayar: bayarNum,
              hutang_transaksi: Math.max(0, total - bayarNum),
              pinjam_galon: pinjamNum,
              galon_kembali: kembaliNum,
              new_debt: newDebt,
              new_loans: newLoans,
              edited: false,
            });
            await sendWhatsApp(customer.wa_number, msg);
          } catch {}
        }
        router.back();
        return;
      } catch (e: any) {
        toast.show(e?.message || "Gagal menyimpan offline", "error");
        return;
      } finally {
        setSaving(false);
      }
    }

    // ── ONLINE PATH (existing behavior)
    setSaving(true);
    try {
      let saved: Transaction;
      if (editingTxn) {
        saved = await api.editTransaction(editingTxn.id, {
          items,
          bayar: bayarNum,
          pinjam_galon: pinjamNum,
          galon_kembali: kembaliNum,
        });
        toast.show("Transaksi diperbarui", "success");
      } else {
        saved = await api.createTransaction({
          customer_id: customer.id,
          items,
          bayar: bayarNum,
          pinjam_galon: pinjamNum,
          galon_kembali: kembaliNum,
        });
        toast.show("Transaksi tersimpan", "success");
      }

      if (sendWA) {
        // If transaction has lottery tickets, redirect to detail with autoSendWA flag
        // so the detail page (which has the TicketCard rendered) can send image+text together.
        if (saved.lottery_tickets && saved.lottery_tickets.length > 0) {
          router.replace({
            pathname: "/(sales)/transaction/[id]",
            params: { id: saved.id, autoSendWA: "1" },
          });
          return;
        }
        try {
          const msg = formatReceipt({
            storeName: "Air OXLY",
            salesCode: user?.sales_code || user?.username,
            customerName: saved.customer_name,
            customerNo: saved.customer_no,
            date: saved.date,
            items: saved.items,
            total: saved.total,
            bayar: saved.bayar,
            hutang_transaksi: saved.hutang_transaksi,
            pinjam_galon: saved.pinjam_galon,
            galon_kembali: saved.galon_kembali,
            new_debt: saved.new_debt,
            new_loans: saved.new_loans,
            edited: !!editingTxn,
            lottery_tickets: saved.lottery_tickets,
            lottery_period_name: saved.lottery_period_name,
          });
          await sendWhatsApp(customer.wa_number || "", msg);
        } catch (e: any) {
          toast.show(e.message || "Gagal buka WhatsApp", "error");
        }
      }
      router.replace({ pathname: "/(sales)/transaction/[id]", params: { id: saved.id } });
    } catch (e: any) {
      toast.show(e.message || "Gagal simpan", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !customer) {
    return (
      <SafeAreaView style={styles.wrap} edges={["top"]}>
        <Text style={{ textAlign: "center", marginTop: 40, color: theme.color.muted }}>Memuat…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="back-btn">
          <Ionicons name="chevron-back" size={24} color={theme.color.onSurface} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{editingTxn ? "Edit Transaksi" : "Transaksi Baru"}</Text>
          <Text style={styles.subtitle}>{customer.name} · #{customer.customer_no}</Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 180 }}
          keyboardShouldPersistTaps="handled"
        >
          {editingTxn && (
            <View style={styles.warn}>
              <Ionicons name="warning-outline" size={16} color={theme.color.warning} />
              <Text style={styles.warnText}>Transaksi hanya bisa diedit 1x</Text>
            </View>
          )}

          <View style={styles.prevBox}>
            <Text style={styles.prevLabel}>Hutang lama</Text>
            <Text style={styles.prevValue}>Rp {rp(customer.total_debt)}</Text>
            <View style={styles.prevDivider} />
            <Text style={styles.prevLabel}>Pinjam galon</Text>
            <Text style={styles.prevValue}>{customer.gallon_loans} gln</Text>
          </View>

          <Text style={styles.section}>Produk</Text>
          {products.map((p) => {
            const hideRoles = p.hide_price_roles || [];
            const legacySales = !!p.hide_price && hideRoles.length === 0;
            const hideForSales = legacySales || hideRoles.includes("sales");
            return (
            <View key={p.id} style={styles.pRow} testID={`product-${p.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pName}>{p.name}</Text>
                {!hideForSales && (
                  <Text style={styles.pPrice}>Rp {rp(p.price)} / {p.unit}</Text>
                )}
              </View>
              <View style={styles.stepper}>
                <TouchableOpacity onPress={() => setQ(p.id, -1)} style={styles.stepBtn} testID={`minus-${p.id}`}>
                  <Ionicons name="remove" size={20} color={theme.color.onSurface} />
                </TouchableOpacity>
                <TextInput
                  value={String(qtys[p.id] || 0)}
                  onChangeText={(v) => setQtys((q) => ({ ...q, [p.id]: parseInt(v.replace(/[^\d]/g, "")) || 0 }))}
                  keyboardType="number-pad"
                  style={styles.stepInput}
                  testID={`qty-${p.id}`}
                />
                <TouchableOpacity onPress={() => setQ(p.id, 1)} style={styles.stepBtn} testID={`plus-${p.id}`}>
                  <Ionicons name="add" size={20} color={theme.color.onSurface} />
                </TouchableOpacity>
              </View>
            </View>
            );
          })}

          <Text style={styles.section}>Galon</Text>
          <View style={styles.gallonRow}>
            <View style={styles.gallonBox}>
              <Text style={styles.gLabel}>Pinjam Galon</Text>
              <TextInput
                value={pinjam}
                onChangeText={(v) => setPinjam(v.replace(/[^\d]/g, ""))}
                onFocus={pinjamBar.onFocus}
                onBlur={pinjamBar.onBlur}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={theme.color.muted}
                style={styles.gInput}
                testID="pinjam-input"
              />
            </View>
            <View style={styles.gallonBox}>
              <Text style={styles.gLabel}>Galon Kembali</Text>
              <TextInput
                value={kembali}
                onChangeText={(v) => setKembali(v.replace(/[^\d]/g, ""))}
                onFocus={kembaliBar.onFocus}
                onBlur={kembaliBar.onBlur}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={theme.color.muted}
                style={styles.gInput}
                testID="kembali-input"
              />
            </View>
          </View>

          <Text style={styles.section}>Pembayaran</Text>
          <View style={styles.payBox}>
            <Text style={styles.gLabel}>Total belanja</Text>
            <Text style={styles.totalText}>Rp {rp(total)}</Text>
          </View>
          <View style={{ marginTop: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <Text style={styles.gLabel}>Uang dibayar</Text>
              {total > 0 && bayarNum !== total && (
                <TouchableOpacity
                  onPress={() => setBayar(String(total))}
                  style={styles.wajibBtn}
                  testID="fill-wajib-bayar-btn"
                >
                  <Ionicons name="cash" size={12} color={theme.color.brand} />
                  <Text style={styles.wajibBtnText}>Bayar lunas Rp {rp(total)}</Text>
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              value={bayar}
              onChangeText={(v) => setBayar(v.replace(/[^\d]/g, ""))}
              onFocus={bayarBar.onFocus}
              onBlur={bayarBar.onBlur}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={theme.color.muted}
              style={styles.payInput}
              testID="bayar-input"
            />
            {total > 0 && (
              <Text style={styles.wajibHint}>
                💡 Wajib bayar sesuai belanja: <Text style={{ fontWeight: "700", color: theme.color.brand }}>Rp {rp(total)}</Text>
              </Text>
            )}
          </View>

          <View style={styles.summary}>
            {sisa >= 0 ? (
              <>
                <Text style={styles.sumLine}>Sisa uang (kurangi hutang lama): <Text style={{ color: theme.color.success, fontWeight: "600" }}>Rp {rp(sisa)}</Text></Text>
                <Text style={styles.sumLine}>Estimasi sisa hutang: <Text style={{ fontWeight: "600" }}>Rp {rp(Math.max(0, customer.total_debt - sisa))}</Text></Text>
              </>
            ) : (
              <>
                <Text style={styles.sumLine}>Kekurangan bayar (jadi hutang): <Text style={{ color: theme.color.error, fontWeight: "600" }}>Rp {rp(hutangTx)}</Text></Text>
                <Text style={styles.sumLine}>Estimasi total hutang: <Text style={{ fontWeight: "600" }}>Rp {rp(customer.total_debt + hutangTx)}</Text></Text>
              </>
            )}
          </View>
        </ScrollView>

        <View style={[styles.stickyBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            onPress={() => doSave(false)}
            disabled={saving}
            style={[styles.saveGhost, saving && { opacity: 0.6 }]}
            testID="save-only-btn"
          >
            <Text style={styles.saveGhostText}>Simpan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => doSave(true)}
            disabled={saving}
            style={[styles.saveWA, saving && { opacity: 0.6 }]}
            testID="save-wa-btn"
          >
            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
            <Text style={styles.saveWAText}>{saving ? "Menyimpan…" : "Kirim WA, Simpan & Kupon"}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.border,
    gap: 8,
  },
  back: { padding: 8 },
  title: { fontSize: 17, fontWeight: "600", color: theme.color.onSurface },
  subtitle: { fontSize: 12, color: theme.color.muted },
  warn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    marginBottom: 12,
  },
  warnText: { color: "#92400E", fontSize: 13, fontWeight: "500" },
  prevBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: theme.color.brandTertiary,
    borderRadius: 14,
    gap: 8,
  },
  prevLabel: { fontSize: 11, color: theme.color.onBrandTertiary },
  prevValue: { fontSize: 14, fontWeight: "600", color: theme.color.onBrandTertiary },
  prevDivider: { width: 1, height: 24, backgroundColor: theme.color.onBrandTertiary, opacity: 0.2, marginHorizontal: 8 },
  section: { fontSize: 14, fontWeight: "600", marginTop: 20, marginBottom: 8, color: theme.color.onSurface },
  pRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  pName: { fontSize: 14, fontWeight: "500", color: theme.color.onSurface },
  pPrice: { fontSize: 12, color: theme.color.muted, marginTop: 2 },
  stepper: { flexDirection: "row", alignItems: "center" },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.color.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepInput: {
    width: 44,
    height: 36,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "600",
    color: theme.color.onSurface,
  },
  gallonRow: { flexDirection: "row", gap: 8 },
  gallonBox: { flex: 1 },
  gLabel: { fontSize: 12, color: theme.color.muted, marginBottom: 4 },
  gInput: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: theme.color.onSurface,
    backgroundColor: theme.color.surfaceSecondary,
  },
  payBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    backgroundColor: theme.color.surfaceSecondary,
    borderRadius: 12,
  },
  totalText: { fontSize: 18, fontWeight: "600", color: theme.color.brand },
  payInput: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    fontWeight: "600",
    color: theme.color.onSurface,
    backgroundColor: theme.color.surfaceSecondary,
    marginTop: 4,
  },
  summary: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: theme.color.surfaceSecondary, gap: 6 },
  sumLine: { fontSize: 13, color: theme.color.onSurfaceSecondary },
  wajibBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: theme.color.brandTertiary,
  },
  wajibBtnText: { fontSize: 11, fontWeight: "700", color: theme.color.onBrandTertiary },
  wajibHint: { fontSize: 11, color: theme.color.muted, marginTop: 6, marginLeft: 2 },
  stickyBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.color.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.color.border,
    padding: 12,
    flexDirection: "row",
    gap: 8,
  },
  saveGhost: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: theme.color.brandPrimary, alignItems: "center", justifyContent: "center" },
  saveGhostText: { color: theme.color.brand, fontWeight: "600" },
  saveWA: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#25D366",
  },
  saveWAText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
