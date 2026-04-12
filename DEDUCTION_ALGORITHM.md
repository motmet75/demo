# Inventory Deduction Algorithm

## Overview

When an order is moved to production (`moveToProduction`) or finalized (`finishOrder`),
the system deducts the required material quantities from inventory using a **two-group,
quota-on-free-stock** algorithm.

---

## Key Formula

### Available For Deduction (per inventory row)

```
freeStock             = max(0, onHand - locked)
availableForDeduction = max(0, freeStock × (1 − quota% / 100))
```

> **Why:** `locked` represents stock already committed elsewhere.  
> The quota% waste/scrap buffer should only apply to the **free** portion, not the locked portion.  
> Old (wrong): `onHand × (1 − quota%) − locked` → locked stock incorrectly ate into the quota buffer.

### Example

```
onHand  = 64.00
locked  = 61.51
quota%  = 10%

freeStock             = 64.00 - 61.51       = 2.49
availableForDeduction = 2.49 × (1 - 0.10)  = 2.241  ✅
```

### Locked Buffer (soft-reserve after deduction)

After deducting `couldBeDeducted`, a proportional waste buffer is soft-reserved:

```
lockedAdd = couldBeDeducted × quota% / (1 − quota%)
```

This keeps the waste fraction locked in the warehouse without touching `quantityTotal`.

---

## Inventory Row Sorting — Two-Group Strategy

Inventory rows for each material are split into **two groups** before deduction:

### Group 1 — Tagged rows (`orderToDeduction` is non-null and non-blank)
- Sorted by: `orderToDeduction` **A→Z** (case-insensitive), then `materialCode` **A→Z**
- Processed **first**

### Group 2 — Untagged rows (`orderToDeduction` is null or blank)
- Sorted by: `materialCode` **A→Z**
- Processed **last**

### Final order = Group 1 + Group 2

```
[Group 1]  orderToDeduction = "AAA", materialCode = "MAT-001"
[Group 1]  orderToDeduction = "AAA", materialCode = "MAT-002"
[Group 1]  orderToDeduction = "BBB", materialCode = "MAT-001"
[Group 2]  orderToDeduction = null,  materialCode = "MAT-001"
[Group 2]  orderToDeduction = null,  materialCode = "MAT-002"
```

---

## Deduction Loop (per material)

```
remaining = totalRequiredQty

for each inv in invRows (Group 1 first, then Group 2):
    if remaining <= 0 → break

    freeStock             = max(0, onHand - locked)
    availableForDeduction = max(0, freeStock × (1 − quota%))
    couldBeDeducted       = min(remaining, availableForDeduction)

    if availableForDeduction <= 0 → skip
    if couldBeDeducted <= 0       → skip

    lockedAdd = couldBeDeducted × quota% / (1 − quota%)

    // Write to DB
    quantityOnHand  = onHand - couldBeDeducted
    quantityLocked  = locked + lockedAdd   (only if lockedAdd > 0)

    // Distribute couldBeDeducted across orders
    rowRemaining = couldBeDeducted
    for each orderId in orderIds:
        orderNeed = sum of effectivePlannedQty for this order+material logs
        forOrder  = min(rowRemaining, orderNeed)
        → create ISSUE_TO_PRODUCTION movement (quantity = -forOrder)
        → stamp deductedInventoryId on consumption logs
        rowRemaining -= forOrder

    remaining -= couldBeDeducted
```

---

## Check Inventory (`checkInventory`)

Uses the same formula per row to compute total available for a material:

```
available = Σ max(0, (onHand_i - locked_i) × (1 − quotaPct_i / 100))
```

- Each row uses its **own** `quotaPct` (not a single representative value).
- Result is compared against `required` to determine `SUFFICIENT` / `INSUFFICIENT`.

---

## `deductInventory` (used by `finishOrder`)

Same formula as above but simpler — no movement records, no order distribution.  
Only `quantityOnHand` is updated (no `lockedAdd`):

```
freeStock  = max(0, onHand - locked)
deductible = max(0, freeStock × (1 − quota%))
take       = min(remaining, deductible)
quantityOnHand = onHand - take
```

---

## What Is Never Touched

| Field | Touched? |
|---|---|
| `quantityTotal` | ❌ Never |
| `quantityLocked` | ✅ Only in `moveToProduction` (soft-reserve) |
| `quantityOnHand` | ✅ Yes — deducted |
| `orderToDeduction` | ❌ Never modified by deduction logic |

---

## Debug Output (moveToProduction)

Each row logs the following via `System.out.println("[MTP-DEDUCT] ...")`:

```
inventoryId
materialCode
orderToDeduction
group             (TAGGED / UNTAGGED)
onHand
locked
freeStock
quotaPct
quotaFactor
availableForDeduction
remainingDemand
couldBeDeducted
lockedAdd
onHandAfter
lockedAfter
skip?             (true if row was skipped)
```
