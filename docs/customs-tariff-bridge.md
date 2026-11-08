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
