# Customs import duty, VAT and C/O–FTA estimate (Demo + Portal)

## Branches and source

- Portal repository: `motmet75/portal`, **master** branch.
  The Vaadin `/tariff` screen reads `bieuthueTB` through `TaxItemService`.
  `TariffBridgeController` exposes a read-only reference endpoint
  `GET /api/internal/tariff/hs/{eightDigitHS}`.
- Demo repository: `motmet75/demo`, **main** branch.
  `GET /bom/inventory/customs-declaration/tariff/{eightDigitHS}`
  checks the Demo user's tenant/company authorization, then calls Portal
  on the backend with an independently configured bridge token.
- The browser never receives or sends the shared secret.

## Mandatory deployment configuration

Choose a strong, identical random token for both applications, for example:

```bash
openssl rand -hex 32
```

On the **Portal** server, in its secure external Spring properties:

```properties
tariff.bridge.token=REPLACE_WITH_THE_SAME_RANDOM_TOKEN
# Optional: an administrator-verified source/version, NOT merely today's date
tariff.bridge.version=unverified
```

On the **Demo** server, in `/opt/tuonghoa/demo/secrets/application-secrets.properties`:

```properties
customs.tariff.bridge-url=https://portal.tuonghoa-imex.com
customs.tariff.bridge-token=REPLACE_WITH_THE_SAME_RANDOM_TOKEN
```

Use the real Portal host. The Demo bridge allows HTTPS and HTTP **localhost only**.
Do not commit the token into either Git repository, and do not expose it
through any browser payload. Restart BOTH Java services after changing properties.

The Portal endpoint is unreachable when the bridge token is missing or shorter
than 24 characters. It is enabled through the Portal security chain but
authenticates each request with the X-Tariff-Bridge-Token header.

## Manual verification (server)

```bash
# Run after building and restarting Portal:
read -rs -p 'Tariff bridge token: ' TARIFF_TOKEN; echo
curl --fail-with-body -H "X-Tariff-Bridge-Token: $TARIFF_TOKEN" \
  "https://portal.tuonghoa-imex.com/api/internal/tariff/hs/84072190"
unset TARIFF_TOKEN
```

Use an 8-digit HS code that is known to exist in the Portal table. If the
example code does not exist in your data, the API correctly returns 404.
Then log into Demo, open **Nhập / Xuất kho bằng tờ khai Hải quan**,
load an import declaration, and expand **Tra cứu FTA/HS**.

## What this preview calculates

For EACH customs line:

- Invoice value = declaration quantity × invoice unit price, in its invoice currency.
- Customs taxable value in VND: the operator should enter the official
  value. If left blank, a **nonofficial estimate** can use invoice value ×
  entered customs exchange rate (or invoice value for VND).
- No C/O: reference **MFN** or normal import tariff, chosen explicitly.
  MFN is not guaranteed when the import is not eligible for MFN.
- C/O scenario: operator chooses a specific FTA rate for that HS; it is
  NOT automatically selected by country alone and has to be checked
  against the actual origin evidence and FTA rules.
- Import duty = customs taxable value × ad-valorem import duty rate.
- Import VAT base = customs taxable value + import duty + manually entered
  special consumption and environmental taxes, if relevant.
- VAT = VAT base × reviewed VAT percentage.
- Shows no-C/O, hypothetical C/O, and operator-selected totals separately.

This only supports percentage-based tax rates for illustration. Unparseable
entries such as `*`, `Q`, compound/absolute tariffs, absent HS codes or
missing effective-date data are **NOT** converted into 0%.

**Important limitations:** `bieuthueTB` may not contain effective-from/to
dates or official revision metadata. The bridge returns
`effectiveDateVerified=false`. The displayed tariff source is a
reference only; a reviewer must confirm the specific tariff year,
HS classification, origin, C/O or permitted alternative origin proof,
special import regimes, eligible country, and any quotas or exemptions.
Vietnamese VAT reductions have specific exclusions and time periods:
do NOT blindly apply 8% to every imported product.

This calculator is **read-only**. It does not update inventory quantity,
invoice purchase cost, customs declaration VAT, or official tax liabilities.

## Regression tests

```bash
cd /opt/tuonghoa/demo/bom-frontend
node --test tests/customsTariffCalc.test.mjs
npm run build
```

After validation, deploy the built frontend using the project's existing
`./bin/bom-frontend-live.sh restart` script.

If an invoice is denominated in USD or another currency but has no
recorded customs exchange rate, amounts are left unavailable rather than guessed.

## Parsing original Vietnamese customs Excel exports

Verified against the supplied legacy BIFF8 (.xls) declaration 103847745300,
registered on 19 February 2021. The workbook contains 52 printed pages:
2 header/summary pages followed by 50 numbered goods pages. Each page
starts with `<IMP>`, and goods pages include `<01>` through `<50>`.

For each goods line, `CustomsDeclarationExcelParser` now preserves:

| Customs Excel field | API JSON key | Unit |
| --- | --- | --- |
| Số lượng (1) | `quantity` | Original declaration unit |
| Đơn giá hóa đơn | `unitPrice` | Original invoice currency |
| Trị giá hóa đơn | `invoiceValue` | Original invoice currency |
| Thuế nhập khẩu → Trị giá tính thuế(S) | `importTaxableValueVnd` | VND |
| Thuế nhập khẩu → Đơn giá tính thuế | `importTaxUnitPriceVnd` | VND/unit |
| Thuế nhập khẩu → Thuế suất | `importTaxRate` | Percent |
| Thuế nhập khẩu → Số tiền thuế | `importTaxAmountVnd` | VND |
| Thuế nhập khẩu → Mã biểu thuế | `importTariffCode` | Original tax scheme code (e.g., A) |
| Thuế GTGT → Trị giá tính thuế | `vatTaxableValueVnd` | VND |
| Thuế GTGT → Thuế suất | `vatRate` | Percent |
| Thuế GTGT → Số tiền thuế | `vatAmountVnd` | VND |
| Thuế GTGT → Mã áp dụng thuế suất | `vatTariffCode` | Original code (e.g., VB901) |

For goods line 1 of this sample: quantity 400 PCE, invoice unit price
0.7575 USD, invoice value 303 USD, import duty base 6,941,730 VND,
original duty 22% = 1,527,180.6 VND, and original import VAT base
8,468,910.6 VND at 10%, with 846,891 VND **as declared**.
The calculated unrounded VAT is 846,891.06 VND; this should
NOT overwrite the rounded amount printed by Customs.

- Rates and declared tax amounts are **original evidence** and remain
  read-only in the comparison dialog. They must not be overwritten by
  a newer FTA tariff retrieved from Portal.
- Import duty and VAT on a historical declaration are **not**
  calculated by multiplying the foreign-currency invoice amount by the
  VAT percentage. The original Customs taxable bases in VND take priority.
- The tariff class code `A` is not evidence of a particular C/O;
  FTA preference requires an independently verified origin document or
  accepted alternative proof and eligibility under the applicable agreement.
- The existing inventory invoice VAT field remains an independent estimate,
  defaults to 0, and should not automatically mirror import VAT.
- The original parser output is stored in each document's `source_json`.
  If an identical XLS (same SHA-256) was uploaded **before** this change,
  uploading it again refreshes original tax fields ONLY for documents whose
  status is not `POSTED`. A previously `POSTED` document remains immutable
  for audit purposes and must not be re-written from a later parser version.

Regression:
```bash
cd /opt/tuonghoa/demo
./mvnw -Dtest=CustomsDeclarationExcelParserTest test
cd bom-frontend
node --test tests/customsTariffCalc.test.mjs
```

## Pre-import landed unit price in VND, at the declaration date

For import declarations (`<IMP>`), open the expanded
**Giá nhập kho VND sau thuế · FTA / HS** section **before confirming stock**.

- All-in unit price = (goods value VND + original import duty or reviewed
  FTA duty + original/import VAT or scenario VAT + separately entered
  special consumption/environmental taxes + separately allocated
  freight, customs clearance and other direct costs) / declared quantity.
- Inventory-unit indicative price divides the same amount by the declared
  quantity times the selected stock conversion ratio.
- Operators can explicitly choose the goods value VND basis:
  * original customs taxable value on the declaration (only an **indicative
    proxy** for purchase value, not necessarily the actual acquisition cost);
  * original invoice total × the **historical exchange rate entered by
    the operator**, for the actual customs declaration date.
- No historical exchange rate is invented or fetched as if it were today's
  rate. If the invoice is in USD/EUR/etc and this mode is selected without
  a historical rate, the price is shown as unavailable.
- For the original `DECLARED` scenario, preserve exact duty/VAT **amounts**
  printed on the customs declaration when unchanged, rather than recomputing
  them from the rates and causing rounding differences.
- A scenario based on an FTA is applied only when the operator confirms that
  actual C/O and applicable FTA conditions have been reviewed. Historical
  periods must use the correct rates for that period, not today's rates.
- Two separate unit prices are shown: **including import VAT** (cash-out
  view), and **indicative inventory cost** (VAT excluded only if the operator
  explicitly marks import input VAT as creditable).
- Other direct acquisition costs and other import taxes are editable VND
  amounts **per declaration line**; do not enter the same tax/charge twice.

Example, **declaration 103847745300, 19/02/2021, HS 39249090**:
400 PCE, 303 USD invoice, 6,941,730 VND original customs taxable value,
1,527,180.6 VND original duty and 846,891 VND original customs VAT.
With no separately allocated expenses, the all-in price using the
customs taxable value as a proxy is 9,315,801.6 VND, or
**23,289.504 VND/PCE**. Before creditable VAT, it is
**21,172.2765 VND/PCE**. Invoice-price-based costing requires the
historical FX rate plus freight/valuation adjustments as appropriate.

**This is a read-only review preview.** It does not yet persist a
purchase unit price to `inventory`, modify valuation/cost ledgers,
or automatically mark a declaration as posted. The operator must
confirm the correct cost allocation and VAT creditability separately.
Missing data is displayed as unavailable, not silently as zero.

Regression test:

```bash
cd /opt/tuonghoa/demo/bom-frontend
node --test tests/customsLandedCost.test.mjs
npm run build
```

## Missing HS in Portal without false "missing API" (Nov 2026)

Some installations replace a Portal HTTP 404 body with a generic error
page, causing Demo to show a route/Nginx error even when the controller
itself queried `bieuthueTB` and found no matching tariff code.

The Portal internal API now returns a **structured negative lookup**
with HTTP 200:

```json
{"status":"NOT_FOUND","code":"HS_NOT_FOUND","hsCode":"39269099",
 "message":"Mã HS 39269099 chưa có trong bảng bieuthueTB của Portal ..."}
```

A successful lookup contains `hsCode`, `fta`, `mfn`, `vat` and the
source metadata. Demo must validate the payload `status` and `code`:
it must NOT treat every HTTP 200 as a found tariff. Missing codes have
**no rate**, not a fabricated 0% rate. Ordinary 404s without structured
`HS_NOT_FOUND` still mean that the route, proxy or deployment requires
diagnostics.

Deploy **both** Portal `master` and Demo `main`. Do not deploy Portal
alone with an older Demo client that assumes HTTP 200 always means a hit.

To confirm the underlying tariff data, query the **actual Portal
database** (usually `tuonghoa`, depending on deployment):

```sql
SELECT id, hscode, "preferentialImTax", "Vat"
FROM "bieuthueTB"
WHERE regexp_replace(coalesce(hscode::text,''),'[^0-9]','','g')
      IN ('76169990','39269099')
ORDER BY hscode, id DESC;

SELECT id, hscode, "viDescription"
FROM "bieuthueTB"
WHERE regexp_replace(coalesce(hscode::text,''),'[^0-9]','','g') LIKE '39269%'
ORDER BY hscode, id DESC LIMIT 40;
```

The second query is for **diagnosis only**. Similar codes are not
substitutes for the exact code on a customs declaration.
