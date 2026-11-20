#!/usr/bin/env python3
"""Generate a rerunnable, balance-neutral NNC history import from JSON exports.

Input files are the output of row_to_json exports from nncminhchau and a
material/lot catalog from anhmedia. Keep those private exports outside git.
"""
import json
import sys
from collections import defaultdict


def sql(value):
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def main(source_path, catalog_path):
    source = json.load(open(source_path, encoding="utf-8"))
    catalog = json.load(open(catalog_path, encoding="utf-8"))
    # The local portal still retains superseded, invisible imports. The live
    # server snapshot contains only their approved, visible replacements.
    source["purchase"] = [p for p in source["purchase"]
                          if p.get("isvisible") is True and p.get("isapproved") is True]
    source["movement"] = [m for m in source["movement"]
                          if m.get("isvisible") is True and m.get("isapproved") is True]
    by_name = defaultdict(list)
    for row in catalog:
        by_name[row["material_name"]].append(row)
    names = {p["description"] for p in source["purchase"]} | {
        m["mtlviname"] for m in source["movement"]
    }
    for name in names:
        matches = by_name[name]
        if len(matches) != 1 or not matches[0]["inventory_id"]:
            raise ValueError(f"No unique material/lot for {name!r}: {len(matches)}")
    if len(source["purchase"]) != 20 or len(source["movement"]) != 267:
        raise ValueError("Source counts changed; inspect the new snapshot first")

    tenant = "(SELECT id FROM public.tenant WHERE tenant_code='nncminhchau.vn')"
    company = "(SELECT id FROM public.company WHERE tenant_id=" + tenant + " AND company_code='NNCMINHCHAU')"
    print("BEGIN;")
    print("SET LOCAL lock_timeout='10s';")
    print("SET LOCAL statement_timeout='60s';")
    for p in source["purchase"]:
        dest = by_name[p["description"]][0]
        values = [tenant, company, sql(p["id"]), sql(dest["material_id"]),
                  sql(dest["inventory_id"]), sql(p["invoiceno"]),
                  sql((p["invoicedate"] or "")[:10] or None), sql(p["supplierid"]),
                  sql(p["description"]), sql(p["qty"]), sql(p["unit"]),
                  sql(p["unitprice"]), sql(p["amount"]),
                  sql((p["vat"] or "").replace("%", "") or None), "'VND'",
                  sql(json.dumps(p, ensure_ascii=False, separators=(",", ":"))) + "::jsonb"]
        print("INSERT INTO public.nnc_legacy_purchase_line "
              "(tenant_id,company_id,source_id,material_id,inventory_id,invoice_number,"
              "invoice_date,supplier_name,description,quantity,unit,unit_price,subtotal,"
              "vat_rate,currency,source_row) VALUES (" + ",".join(values) + ") "
              "ON CONFLICT (tenant_id,company_id,source_id) DO NOTHING;")
    for m in source["movement"]:
        dest = by_name[m["mtlviname"]][0]
        if m["movementtype"] not in ("IN", "OUT") or float(m["quantity"]) <= 0:
            raise ValueError(f"Invalid source movement {m['id']}")
        values = [tenant, company, sql(m["id"]), sql(dest["material_id"]),
                  sql(dest["inventory_id"]), sql(m["movementtype"]),
                  sql(m["quantity"]), sql(m["movementdate"]), sql(m["referenceno"]),
                  sql(m["unit"]), sql(m["unitprice"]), "'VND'",
                  sql(json.dumps(m, ensure_ascii=False, separators=(",", ":"))) + "::jsonb"]
        print("INSERT INTO public.nnc_legacy_inventory_movement "
              "(tenant_id,company_id,source_id,material_id,inventory_id,movement_type,"
              "quantity,movement_date,reference_number,unit,unit_price,currency,source_row) "
              "VALUES (" + ",".join(values) + ") "
              "ON CONFLICT (tenant_id,company_id,source_id) DO NOTHING;")
    print("COMMIT;")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: nnc_legacy_history_sql.py source.json catalog.json")
    main(sys.argv[1], sys.argv[2])
