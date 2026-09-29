#!/usr/bin/env python3
"""Builds the return workbook that supplies what the public preview cannot show.

The owner confirmed the public preview's catalogue and prices. It cannot show how
many of each option he actually holds, what each parcel weighs once packed, or any
product that is hidden from customers. The database that knows those things belongs
to the retired account, which is off limits, so the owner types them in here.

Built offline from the committed content snapshot, which matches the confirmed
preview's option identities and prices. No network, no shop, no credentials.

  Public products   one row per public option, Ref = its stable option id. Stock and
                    weights are blank on purpose: blank means "leave as it is".
                    Prices are shown for reference and are NOT read back, so this
                    sheet cannot change one.
  Hidden products   products the public site cannot show. Rows sharing a product name
                    are the sizes of one product. Read by import_hidden_products.py.

The Public products headers are exactly the ones import_owner_workbook.py reads.

USAGE
    python3 scripts/build_owner_return_workbook.py [output.xlsx]
"""

import json
import sys
from datetime import date
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_owner_workbook import (  # noqa: E402  house style shared with the August workbook
    BORDER, BOLD, FILL_FILL_IN, FILL_READONLY, FILL_TITLE, MUTED, TITLE, WRAP, style_header,
)

SNAPSHOT = ROOT / "src/content/content-snapshot.json"
DECISIONS = ROOT / "d1/staging/catalogue-owner-decisions.json"
DEFAULT_OUT = ROOT.parent / "handover" / f"Salty-Lamps-Owner-Return-{date.today().isoformat()}.xlsx"

PUBLIC = "Public products"
HIDDEN = "Hidden products"
LISTS = "Lists"

# The bath salt is the one hidden product the reviews record as approved for inclusion.
# Its copy, options and rehearsal prices are prefilled for the owner to confirm; its
# stock and weights are exactly what is still missing, so they are left blank.
BATH_SALT = {
    "name": "Himalayan Crystal Bath Salt",
    "category_slug": "himalayan-salt-massage-relaxation-products",
    "description": ("Himalayan Crystal Rock Salt for Bath & Relaxation. Works best as natural skin "
                    "moisturiser and relaxes your muscles. We have this bath salt in 3 different pack sizes."),
    "options": [("BS-1000", "1Kg", "BS-1000"), ("BS-5000", "5Kg", "BS-5000"), ("BS-10", "10Kg", "BS-10")],
}


def kg(grams):
    return None if grams is None else grams / 1000


def public_rows(snapshot):
    categories = {c["slug"]: c["name"] for c in snapshot["categories"]}
    for card in snapshot["products"]:
        shown = [categories.get(s, s) for s in card["categories"] if not categories.get(s) == "All products"]
        yield {
            "ref": card["skuId"], "product": card["productName"], "size": card["variantLabel"] or "—",
            "code": card["sku"], "category": ", ".join(shown), "price": card["price"],
            "stock_now": card["stockQty"] if card["trackMode"] == "quantity" else ("In stock" if card["stock"] else "Out"),
            "weight_min": kg(card.get("productWeightMinG")), "weight_max": kg(card.get("productWeightMaxG")),
        }


def bath_salt_prices():
    decided = json.loads(DECISIONS.read_text())["bath_salt"]["approved_rehearsal_prices_pence"]
    return {code: decided[code] / 100 for code in decided}


def start_sheet(ws):
    ws.sheet_view.showGridLines = False
    ws.column_dimensions["A"].width = 4
    ws.column_dimensions["B"].width = 110
    ws["B1"] = "Salty Lamps — a few things only you can tell us"
    ws["B1"].font, ws["B1"].fill = TITLE, FILL_TITLE
    ws.row_dimensions[1].height = 34

    def line(text, bold=False, height=None):
        r = ws.max_row + 1
        c = ws.cell(row=r, column=2, value=text)
        c.alignment = WRAP
        if bold:
            c.font = BOLD
        if height:
            ws.row_dimensions[r].height = height

    line("")
    line("The new website keeps exactly the products and prices you approved on the preview. "
         "The preview can't show us three things, so this sheet asks for them: how many of each "
         "you actually hold, what each parcel weighs once packed, and any product that is "
         "hidden from customers. About 30 minutes.", height=48)
    line("")
    line("What the colours mean", bold=True)
    line("Blue = please fill this in.    Grey = for reference, please don't change it.", height=18)
    line("")
    line("Tab 1 — Public products", bold=True)
    line("One line per size you sell. For each, type (a) STOCK you have now and (b) the packed "
         "shipping weight in kg: the weight of the parcel ready to post, box and padding included "
         "(1.5 means one and a half kilos). Prices are shown so you can see the line, but nothing "
         "you type here can change a price.", height=64)
    line("Not sure? Leave it blank. Blank means \"leave as it is\", never zero. If you truly have "
         "none, type 0.", height=32)
    line("")
    line("Tab 2 — Hidden products", bold=True)
    line("List every product that is in your shop but that customers can't see: drafts, discontinued "
         "lines, seasonal or special offers. Use one row per size. Rows with the same product name "
         "become one product with several sizes. The bath salt is filled in already, so please "
         "check it. Leave the last-but-one column blank to keep a product hidden; type Yes only "
         "when it should go on sale.", height=80)
    line("Photos can't be typed into a sheet. Please send them separately, named after the product.",
         height=32)
    line("")
    line("Nothing on this sheet is published by itself. We check it with you first.", height=18)
    ws["B" + str(ws.max_row)].font = MUTED


def public_sheet(ws, rows):
    heads = [
        ("Ref\n(don't change)", 9, FILL_READONLY),
        ("Product", 40, FILL_READONLY),
        ("Size / option", 22, FILL_READONLY),
        ("Product code\n(correct it if wrong)", 18, FILL_READONLY),
        ("Category", 28, FILL_READONLY),
        ("Price on the site now\n(reference only)", 16, FILL_READONLY),
        ("Stock the site shows now\n(reference only)", 18, FILL_READONLY),
        ("STOCK you have now", 14, FILL_FILL_IN),
        ("Packed shipping weight (kg)", 18, FILL_FILL_IN),
        ("Product weight from (kg)", 16, FILL_FILL_IN),
        ("Product weight to (kg)", 16, FILL_FILL_IN),
        ("Show product weight", 14, FILL_FILL_IN),
        ("STILL SELLING?", 12, FILL_FILL_IN),
        ("Notes", 40, FILL_FILL_IN),
    ]
    style_header(ws, heads, row=1)
    ws.freeze_panes = "C2"
    for row in rows:
        ws.append([row["ref"], row["product"], row["size"], row["code"], row["category"], row["price"],
                   row["stock_now"], None, None, row["weight_min"], row["weight_max"], None, None, None])
    last = ws.max_row
    for r in range(2, last + 1):
        for c in range(1, len(heads) + 1):
            cell = ws.cell(r, c)
            cell.border = BORDER
            cell.alignment = Alignment(wrap_text=True, vertical="top")
            cell.fill = heads[c - 1][2]
        ws.cell(r, 6).number_format = "£0.00"
    whole = DataValidation(type="whole", operator="between", formula1="0", formula2="1000000", allow_blank=True,
                           errorTitle="Whole number", error="Type a whole number, 0 or more.")
    weight = DataValidation(type="decimal", operator="between", formula1="0.001", formula2="1000000", allow_blank=True,
                            errorTitle="Weight in kg", error="Type a weight in kilos, for example 1.5.")
    yes_no = DataValidation(type="list", formula1='"Yes,No"', allow_blank=True)
    for dv, col in [(whole, "H"), (weight, "I"), (weight, "J"), (weight, "K"), (yes_no, "L"), (yes_no, "M")]:
        ws.add_data_validation(dv)
        dv.add(f"{col}2:{col}{last}")


def hidden_sheet(ws, category_names, prices, category_of):
    heads = [
        ("Product name", 34, FILL_FILL_IN),
        ("Category", 30, FILL_FILL_IN),
        ("Description (shown to customers)", 50, FILL_FILL_IN),
        ("Size / option\n(blank if it has only one)", 20, FILL_FILL_IN),
        ("Product code", 16, FILL_FILL_IN),
        ("Price £", 12, FILL_FILL_IN),
        ("STOCK you have now", 14, FILL_FILL_IN),
        ("Packed shipping weight (kg)", 18, FILL_FILL_IN),
        ("Product weight from (kg)", 16, FILL_FILL_IN),
        ("Product weight to (kg)", 16, FILL_FILL_IN),
        ("Put on sale now?\n(blank = stay hidden)", 16, FILL_FILL_IN),
        ("Notes", 40, FILL_FILL_IN),
    ]
    style_header(ws, [(h, w, f) for h, w, f in heads], row=1)
    ws.freeze_panes = "B2"
    for code, size, label in BATH_SALT["options"]:
        ws.append([BATH_SALT["name"], category_of[BATH_SALT["category_slug"]], BATH_SALT["description"], size, code,
                   prices[code], None, None, None, None, None,
                   "Prices are the ones you approved for testing: please confirm them. Stock and weight are still needed."])
    for r in range(2, 60):
        for c in range(1, len(heads) + 1):
            cell = ws.cell(r, c)
            cell.border = BORDER
            cell.alignment = Alignment(wrap_text=True, vertical="top")
            cell.fill = FILL_FILL_IN
        ws.cell(r, 6).number_format = "£0.00"
    cat = DataValidation(type="list", formula1=f"='{LISTS}'!$A$2:$A${len(category_names) + 1}", allow_blank=True)
    money = DataValidation(type="decimal", operator="greaterThan", formula1="0", allow_blank=True,
                           errorTitle="Price", error="Type a price in pounds, more than zero.")
    whole = DataValidation(type="whole", operator="between", formula1="0", formula2="1000000", allow_blank=True)
    weight = DataValidation(type="decimal", operator="between", formula1="0.001", formula2="1000000", allow_blank=True)
    yes = DataValidation(type="list", formula1='"Yes"', allow_blank=True)
    for dv, col in [(cat, "B"), (money, "F"), (whole, "G"), (weight, "H"), (weight, "I"), (weight, "J"), (yes, "K")]:
        ws.add_data_validation(dv)
        dv.add(f"{col}2:{col}59")


def lists_sheet(ws, category_names):
    ws["A1"] = "Category names"
    ws["A1"].font = BOLD
    for i, name in enumerate(category_names, start=2):
        ws.cell(i, 1, name)
    ws.column_dimensions["A"].width = 46
    ws.sheet_state = "hidden"


def build(out):
    snapshot = json.loads(SNAPSHOT.read_text())
    rows = list(public_rows(snapshot))
    if len(rows) != 76 or len({r["ref"] for r in rows}) != 76:
        raise SystemExit(f"Expected 76 distinct public options, found {len(rows)}. Refusing to build.")
    category_names = [c["name"] for c in snapshot["categories"] if not c.get("is_virtual")]
    wb = Workbook()
    start_sheet(wb.active)
    wb.active.title = "START HERE"
    public_sheet(wb.create_sheet(PUBLIC), rows)
    hidden_sheet(wb.create_sheet(HIDDEN), category_names, bath_salt_prices(),
                 {c["slug"]: c["name"] for c in snapshot["categories"]})
    lists_sheet(wb.create_sheet(LISTS), category_names)
    out.parent.mkdir(parents=True, exist_ok=True)
    wb.save(out)
    return len(rows)


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OUT
    if target.exists():
        raise SystemExit(f"{target} exists; refusing to overwrite a workbook that may hold answers.")
    print(f"Wrote {target} with {build(target)} public options and the bath salt prefilled.")
