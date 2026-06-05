import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { QuoteBill } from '@/lib/api';

// V1 order bill shape (legacy orders before 2026-05-12, no per-component breakdown)
export interface V1Bill {
  subtotal: string;
  deliveryFee: string;
  platformFee?: string;
  discount?: string;
  gstAmount?: string;
  total: string;
}

// V2 order bill shape (flat fields from ApiOrder for orders with v2 billing but no bill object)
export interface V2Bill {
  foodGross: string;
  promoDiscount?: string;
  restaurantDiscount?: string;
  packagingCharges?: string;
  packagingGstAmount?: string;
  deliveryFeeGstAmount?: string;
  platformFeeGstAmount?: string;
  gstAmount?: string;       // food GST
  gstRate?: string;         // food GST rate snapshot (e.g. "5")
  servicesGstRate?: string; // non-food GST rate snapshot (e.g. "5")
  deliveryFee: string;
  platformFee?: string;
  discount?: string;
  total: string;
  couponCode?: string | null;
}

interface Props {
  // Pass exactly one: canonical quote/order bill, v2 flat bill, or v1 legacy bill
  quoteBill?: QuoteBill | null;
  v2Bill?: V2Bill | null;
  v1Bill?: V1Bill | null;
}

function Row({ label, value, sub, bold, positive }: {
  label: string;
  value: string;
  sub?: string;
  bold?: boolean;
  positive?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={[styles.label, bold && styles.bold]}>{label}</Text>
        {sub ? <Text style={styles.subLabel}>{sub}</Text> : null}
      </View>
      <Text style={[styles.value, bold && styles.bold, positive && styles.positive]}>{value}</Text>
    </View>
  );
}

// Guide §4: "Format every money value as ₹ + 2 decimals (e.g. ₹45.00)"
function fmt(n: number) {
  return `₹${n.toFixed(2)}`;
}

function fmtStr(s: string | undefined | null) {
  if (!s) return '₹0.00';
  const n = parseFloat(s);
  return fmt(isNaN(n) ? 0 : n);
}

function p(s: string | undefined | null) {
  const n = parseFloat(s || '0');
  return isNaN(n) ? 0 : n;
}

export function BillBreakdown({ quoteBill, v2Bill, v1Bill }: Props) {
  // Guide §4: "expanded by default and still collapsible"
  const [gstExpanded, setGstExpanded] = useState(true);

  // ── Canonical QuoteBill (live quote or order.bill) ────────────────────────
  if (quoteBill) {
    const b = quoteBill;
    const hasPromo = b.promo_discount > 0;
    const hasRestaurantDiscount = b.restaurant_discount > 0;
    // Guide §4: "GST Total → gst.total" (includes platform GST)
    const hasGstDetail = b.gst.total > 0;

    return (
      <View style={styles.container}>
        {/* Guide §4 row order */}
        <Row label="Food Total" value={fmt(b.food_gross)} />
        {hasPromo && (
          <Row
            label="Promo Discount"
            value={`-${fmt(b.promo_discount)}`}
            positive
            sub={b.coupon_code ?? undefined}
          />
        )}
        {hasRestaurantDiscount && (
          <Row label="Restaurant Discount" value={`-${fmt(b.restaurant_discount)}`} positive />
        )}

        <View style={styles.divider} />

        {/* Guide §4: "Packaging Charges — always show, even when ₹0.00" */}
        <Row label="Packaging Charges" value={fmt(b.packaging)} />
        <Row
          label="Delivery Partner Fee"
          value={b.delivery_partner_fee === 0 ? 'FREE' : fmt(b.delivery_partner_fee)}
        />
        {/* Guide §4: Platform Fee — always show */}
        <Row label="Platform Fee" value={fmt(b.platform_fee_inclusive)} />

        {hasGstDetail && (
          <>
            <View style={styles.divider} />
            {/* Guide §4: tappable GST header, expanded by default */}
            <Pressable style={styles.gstRow} onPress={() => setGstExpanded((x) => !x)}>
              <View style={styles.rowLeft}>
                <Text style={styles.label}>GST</Text>
              </View>
              <View style={styles.gstRight}>
                <Text style={styles.value}>{fmt(b.gst.total)}</Text>
                <Ionicons
                  name={gstExpanded ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color="#888"
                  style={{ marginLeft: 4 }}
                />
              </View>
            </Pressable>
            {gstExpanded && (
              <View style={styles.gstDetails}>
                {/* Guide §4: always show all four sub-lines */}
                <Row
                  label={`GST on Food${b.rates?.food_gst ? ` (${b.rates.food_gst}%)` : ''}`}
                  value={fmt(b.gst.food)}
                />
                <Row
                  label={`GST on Packaging${b.rates?.services_gst ? ` (${b.rates.services_gst}%)` : ''}`}
                  value={fmt(b.gst.packaging)}
                />
                <Row
                  label={`GST on Delivery Partner Fee${b.rates?.services_gst ? ` (${b.rates.services_gst}%)` : ''}`}
                  value={fmt(b.gst.delivery)}
                />
                {/* Guide §5: platform GST is already inside platform_fee_inclusive — mark as incl. */}
                <Row
                  label={`GST on Platform Fee${b.rates?.services_gst ? ` (${b.rates.services_gst}%, incl.)` : ' (incl.)'}`}
                  value={fmt(b.gst.platform)}
                />
              </View>
            )}
          </>
        )}

        <View style={styles.divider} />
        <Row label="Overall Total" value={fmt(b.overall_total)} bold />
      </View>
    );
  }

  // ── V2 flat bill (fallback for orders with v2 fields but no bill object) ──
  if (v2Bill) {
    const b = v2Bill;
    const hasPromo = p(b.promoDiscount) > 0;
    const hasRestDiscount = p(b.restaurantDiscount) > 0;

    const foodGstAmt = p(b.gstAmount);
    const packagingGstAmt = p(b.packagingGstAmount);
    const deliveryGstAmt = p(b.deliveryFeeGstAmount);
    const platformGstAmt = p(b.platformFeeGstAmount);
    // Guide: gst.total = food + packaging + delivery + platform
    const totalGst = foodGstAmt + packagingGstAmt + deliveryGstAmt + platformGstAmt;
    const hasGstDetail = totalGst > 0;

    const foodRate = b.gstRate;
    const servicesRate = b.servicesGstRate;

    return (
      <View style={styles.container}>
        <Row label="Food Total" value={fmtStr(b.foodGross)} />
        {hasPromo && (
          <Row
            label="Promo Discount"
            value={`-${fmtStr(b.promoDiscount)}`}
            positive
            sub={b.couponCode ?? undefined}
          />
        )}
        {hasRestDiscount && (
          <Row label="Restaurant Discount" value={`-${fmtStr(b.restaurantDiscount)}`} positive />
        )}

        <View style={styles.divider} />

        <Row label="Packaging Charges" value={fmtStr(b.packagingCharges)} />
        <Row
          label="Delivery Partner Fee"
          value={p(b.deliveryFee) === 0 ? 'FREE' : fmtStr(b.deliveryFee)}
        />
        <Row label="Platform Fee" value={fmtStr(b.platformFee)} />

        {hasGstDetail && (
          <>
            <View style={styles.divider} />
            <Pressable style={styles.gstRow} onPress={() => setGstExpanded((x) => !x)}>
              <View style={styles.rowLeft}>
                <Text style={styles.label}>GST</Text>
              </View>
              <View style={styles.gstRight}>
                <Text style={styles.value}>{fmt(totalGst)}</Text>
                <Ionicons
                  name={gstExpanded ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color="#888"
                  style={{ marginLeft: 4 }}
                />
              </View>
            </Pressable>
            {gstExpanded && (
              <View style={styles.gstDetails}>
                <Row
                  label={`GST on Food${foodRate ? ` (${foodRate}%)` : ''}`}
                  value={fmt(foodGstAmt)}
                />
                <Row
                  label={`GST on Packaging${servicesRate ? ` (${servicesRate}%)` : ''}`}
                  value={fmt(packagingGstAmt)}
                />
                <Row
                  label={`GST on Delivery Partner Fee${servicesRate ? ` (${servicesRate}%)` : ''}`}
                  value={fmt(deliveryGstAmt)}
                />
                <Row
                  label={`GST on Platform Fee${servicesRate ? ` (${servicesRate}%, incl.)` : ' (incl.)'}`}
                  value={fmt(platformGstAmt)}
                />
              </View>
            )}
          </>
        )}

        <View style={styles.divider} />
        <Row label="Overall Total" value={fmtStr(b.total)} bold />
      </View>
    );
  }

  // ── V1 legacy bill (orders before 2026-05-12, no per-component breakdown) ─
  if (v1Bill) {
    const b = v1Bill;
    const hasDiscount = p(b.discount) > 0;
    const gstAmt = p(b.gstAmount);
    const hasGst = gstAmt > 0;
    return (
      <View style={styles.container}>
        <Row label="Food Total" value={fmtStr(b.subtotal)} />
        {hasDiscount && <Row label="Discount" value={`-${fmtStr(b.discount)}`} positive />}
        <View style={styles.divider} />
        {/* Guide §6: "Delivery Partner Fee = deliveryFee" */}
        <Row
          label="Delivery Partner Fee"
          value={p(b.deliveryFee) === 0 ? 'FREE' : fmtStr(b.deliveryFee)}
        />
        {p(b.platformFee) > 0 && <Row label="Platform Fee" value={fmtStr(b.platformFee)} />}
        {/* Guide §6: "a single GST = gstAmount" */}
        {hasGst && <Row label="GST" value={fmt(gstAmt)} />}
        <View style={styles.divider} />
        <Row label="Overall Total" value={fmtStr(b.total)} bold />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  rowLeft: {
    flex: 1,
    marginRight: 8,
  },
  label: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'Poppins_400Regular',
  },
  subLabel: {
    fontSize: 11,
    color: '#888',
    fontFamily: 'Poppins_400Regular',
    marginTop: 1,
  },
  value: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'Poppins_400Regular',
  },
  bold: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: '#111',
  },
  positive: {
    color: '#22a45d',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 4,
  },
  gstRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gstRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gstDetails: {
    paddingLeft: 12,
    gap: 4,
  },
});
