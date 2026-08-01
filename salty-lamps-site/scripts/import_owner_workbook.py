#!/usr/bin/env python3
"""Reads the completed catalogue workbook back in.

The other half of build_owner_workbook.py. The owner fills in cost, stock and
whether he's still selling each line; this validates what came back and writes it
through the admin API so every change lands in the audit log.

DESIGN NOTES
------------
Matched on the hidden 'Ref' column (column A), not on row position and not on
product code. The owner may sort or filter rows, and two products currently share a
code — matching on either would silently attach one product's cost to another,
which is the worst possible failure for a pricing import. Ref is the database's own
identifier and never changes.

Shop price is recalculated here rather than read from the sheet's green column.
openpyxl cannot evaluate formulas, so that column is unreadable unless Excel has
saved cached values, and trusting a cached value would mean a stale figure could
slip in. Recomputing from cost applies the same rule the sheet displays.

Reports first, writes only with --apply. Nothing is ever deleted: a line marked
"No" is hidden, not removed, because order history references it.

USAGE
    python3 scripts/import_owner_workbook.py <file.xlsx>
    python3 scripts/import_owner_workbook.py <file.xlsx> --apply
"""

import json
import math
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

from openpyxl import load_workbook

API = "http://localhost:8788"


def fetch(path):
    with urllib.request.urlopen(f"{API}{path}", timeout=20) as r:
        return json.load(r)


def patch(path, body):
    req = urllib.request.Request(
        f"{API}{path}", method="PATCH",
        data=json.dumps(body).encode(),
        headers={"content-type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return True, json.load(r)
    except urllib.error.HTTPError as e:
        return False, e.read().decode()[:200]


def shop_pence(cost, pack):
    """The rule the sheet shows live: double the cost, up to the next pound, less 1p."""
    return math.ceil(cost * pack * 2) * 100 - 1


def main():
    if len(sys.argv) < 2:
        sys.exit("usage: import_owner_workbook.py <file.xlsx> [--apply]")
    path = Path(sys.argv[1])
    apply = "--apply" in sys.argv
    if not path.exists():
        sys.exit(f"No such file: {path}")

    ws = load_workbook(path, data_only=False)["Products"]

    # Row 1 is the reminder banner, row 2 the header, data from row 3.
    sheet = {}
    problems = []
    for r in range(3, ws.max_row + 1):
        ref = ws.cell(row=r, column=1).value
        if ref in (None, ""):
            continue
        try:
            ref = int(ref)
        except (TypeError, ValueError):
            problems.append(f"row {r}: the Ref in column A is {ref!r}, which isn't one of ours")
            continue
        if ref in sheet:
            problems.append(f"row {r}: Ref {ref} appears more than once — the sheet has been "
                            "copied or duplicated somewhere")
            continue
        sheet[ref] = {
            "row": r,
            "product": ws.cell(row=r, column=2).value,
            "variant": ws.cell(row=r, column=3).value,
            "code": ws.cell(row=r, column=4).value,
            "cost": ws.cell(row=r, column=7).value,
            "pack": ws.cell(row=r, column=8).value or 1,
            "override": ws.cell(row=r, column=10).value,
            "stock": ws.cell(row=r, column=11).value,
            "selling": str(ws.cell(row=r, column=12).value or "").strip().lower(),
            "note": ws.cell(row=r, column=13).value,
        }

    live = fetch("/api/admin/products")["products"]
    by_ref = {s["id"]: (p, s) for p in live for s in p["skus"]}

    price_changes, stock_changes, code_changes, hide, missing, blank = [], [], [], [], [], []

    for ref, row in sheet.items():
        if ref not in by_ref:
            missing.append((ref, row))
            continue
        product, sku = by_ref[ref]
        label = str(row["code"] or sku["sku"])

        # An explicit shop price always wins over the calculated one — that column
        # exists precisely so the owner can disagree with the formula.
        if row["override"] not in (None, ""):
            try:
                want = round(float(row["override"]) * 100)
            except (TypeError, ValueError):
                problems.append(f"row {row['row']}: your own shop price {row['override']!r} isn't a number")
                continue
            if want != sku["price_pence"]:
                price_changes.append((label, sku, row, None, want))
        elif row["cost"] in (None, ""):
            blank.append((label, row))
        else:
            try:
                cost = float(row["cost"])
            except (TypeError, ValueError):
                problems.append(f"row {row['row']}: cost {row['cost']!r} is not a number")
                continue
            if cost <= 0:
                problems.append(f"row {row['row']}: cost must be more than zero")
                continue
            want = shop_pence(cost, int(row["pack"]))
            if want != sku["price_pence"]:
                price_changes.append((label, sku, row, cost, want))

        if row["code"] and str(row["code"]).strip() != sku["sku"]:
            code_changes.append((sku, sku["sku"], str(row["code"]).strip()))

        if row["stock"] not in (None, ""):
            try:
                qty = int(row["stock"])
            except (TypeError, ValueError):
                problems.append(f"row {row['row']}: stock {row['stock']!r} is not a whole number")
            else:
                if qty != sku["quantity"]:
                    stock_changes.append((label, sku, qty))

        if row["selling"] == "no":
            hide.append((label, product, sku))

    for ref in by_ref:
        if ref not in sheet:
            p, s = by_ref[ref]
            problems.append(f"{s['sku']!r} ({p['name']}) is in the shop but its row is missing "
                            "from the sheet")

    # Two products sharing a code is the defect this whole exercise exists to fix, so
    # do not let the fix reintroduce it. Codes may legitimately repeat WITHIN one
    # product (pack sizes of the same item), so this compares across products only.
    code_to_products = {}
    for ref, row in sheet.items():
        if ref not in by_ref or not row["code"]:
            continue
        base = re.sub(r"\s*\(\d+\)\s*$", "", str(row["code"]).strip())
        code_to_products.setdefault(base, set()).add(by_ref[ref][0]["name"])
    for base, names in sorted(code_to_products.items()):
        if len(names) > 1:
            problems.append(f"code {base!r} is used by more than one product: "
                            + "; ".join(sorted(names)))

    g = lambda p: f"£{p / 100:.2f}"
    print(f"\n=== {path.name} ===\n")
    print(f"  rows read              : {len(sheet)}")
    print(f"  price changes          : {len(price_changes)}")
    print(f"  product code changes   : {len(code_changes)}")
    print(f"  stock changes          : {len(stock_changes)}")
    print(f"  lines marked not selling: {len(hide)}")
    print(f"  costs left blank       : {len(blank)}")
    print(f"  codes not in the shop  : {len(missing)}")

    if problems:
        print(f"\n  !! {len(problems)} problem(s) — nothing will be written until these are resolved:")
        for p in problems[:25]:
            print(f"     {p}")

    if price_changes:
        print("\n--- Price changes ---")
        for code, sku, row, cost, want in price_changes:
            how = f"cost £{cost:>7.2f} x{row['pack']:<3}" if cost is not None else "price set by hand  "
            print(f"  {code:<16} {how} → {g(want):>9}  (was {g(sku['price_pence'])})")

    if code_changes:
        print("\n--- Product code changes ---")
        for sku, was, now in code_changes:
            print(f"  {was:<40} → {now}")

    if stock_changes:
        print("\n--- Stock changes ---")
        for code, sku, qty in stock_changes:
            print(f"  {code:<16} {sku['quantity']} → {qty}")

    if hide:
        print("\n--- Marked 'No' — will be HIDDEN, not deleted (order history references them) ---")
        for code, product, sku in hide:
            print(f"  {code:<16} {product['name']}")

    if blank:
        print(f"\n--- {len(blank)} line(s) with no cost given — left exactly as they are ---")
        for code, row in blank[:15]:
            print(f"  {code:<16} {row['product']}")

    if missing:
        print(f"\n--- {len(missing)} code(s) in the sheet that don't exist in the shop ---")
        print("    (probably renamed codes — these need creating by hand, not guessed at)")
        for code, row in missing[:15]:
            print(f"  {code:<16} {row['product']}")

    if problems:
        print("\nRefusing to write while there are problems above. Fix the sheet and re-run.\n")
        sys.exit(1)

    if not apply:
        print("\nReport only. Re-run with --apply to write these through the admin API.\n")
        return

    ok = 0
    for code, sku, row, cost, want in price_changes:
        good, err = patch(f"/api/admin/skus/{sku['id']}", {**sku, "price_pence": want})
        ok += good
        if not good:
            print(f"  FAILED {code}: {err}")
    for code, sku, qty in stock_changes:
        good, err = patch(f"/api/admin/skus/{sku['id']}",
                          {**sku, "quantity": qty, "in_stock": 1 if qty > 0 else 0})
        ok += good
        if not good:
            print(f"  FAILED {code}: {err}")
    for sku, was, now in code_changes:
        good, err = patch(f"/api/admin/skus/{sku['id']}", {**sku, "sku": now})
        ok += good
        if not good:
            print(f"  FAILED {was}: {err}")
    print(f"\n  {ok} change(s) written.")
    if hide:
        print(f"  {len(hide)} line(s) marked not-selling were NOT changed — hiding a product is "
              "a bigger decision than a price, so do it in the admin.\n")


if __name__ == "__main__":
    main()
