# Wix exported-field destinations

Reviewed 26 September 2026. These are structured historical fields with original string values, not proof of live commerce behavior. Blank strings, original money/date formats, units, consent states and source identities are preserved. No email, payment, refund or dispatch action is triggered by these records.

The Wix exports, proposed historical-record schema and rehearsal database are separate from the replacement shop's working database and catalogue. The proposed schema is deliberately outside the production migration sequence. The historical-record admin service requires its own archive database binding and fails closed when that binding is absent; its review audit is stored in that archive. No production archive database or binding is configured yet. Nothing in this mapping authorizes a live import or a merge into the replacement products, stock, orders or customer records. At the catalogue reconciliation stage, review the two structures and current shop content with the owner, decide which fields need live behavior, and approve a tested mapping before any production database change. Keep the existing shop data and owner edits intact throughout.

The source header contract rejects new, missing or reordered columns. Each record is identified by the complete export snapshot and its original row number; contacts are not merged by email. Changed exports form new snapshots. Business-record views provide field inspection, all-field search, exact JSON downloads and separately audited review notes.

The local-only rehearsal verifies every cell, order/item identity and summary agreement, product child order, byte-for-byte original recovery, no-op rerun, SQL restore and CSV re-export. It does not merge the 35 Wix products into the replacement catalogue, whose count can change while that shop is being built. Product identity, approved replacement copy, media mapping, units, tax groups, discounts, preorders, modifiers and customer-consent behavior still require explicit operational reconciliation.

## Field map

Continuation evidence, 26 September 2026: a fresh full rehearsal initially exposed an SQL export ordering defect on the local Python runtime: `sqlite_sequence` cleanup appeared before the AUTOINCREMENT table created that internal table. The rehearsal helper now defers complete sequence statements until after schema/data restoration, preserving sequence high-water marks and multiline original values. Five regression tests passed, including an empty-database full rehearsal and deleted sequence identity preservation. The fresh real-export rehearsal then passed all 294 fields and 480,778 cells, SQL restore, CSV re-export, no-op repeat import and byte-for-byte recovery of all four originals. Evidence remains private under `backups/wix/rehearsal-continuation-fixed-2026-09-26/`. This does not approve any live mapping or complete migration checklist item 5.

### products

| Source field | Destination column |
| --- | --- |
| handle | wix_products.handle |
| fieldType | wix_products.fieldtype |
| name | wix_products.name |
| visible | wix_products.visible |
| plainDescription | wix_products.plaindescription |
| categorySlugs | wix_products.categoryslugs |
| primaryCategorySlug | wix_products.primarycategoryslug |
| media | wix_products.media |
| mediaAltText | wix_products.mediaalttext |
| ribbon | wix_products.ribbon |
| brand | wix_products.brand |
| price | wix_products.price |
| strikethroughPrice | wix_products.strikethroughprice |
| baseUnit | wix_products.baseunit |
| baseUnitMeasurement | wix_products.baseunitmeasurement |
| totalUnits | wix_products.totalunits |
| totalUnitsMeasurement | wix_products.totalunitsmeasurement |
| cost | wix_products.cost |
| inventory | wix_products.inventory |
| preOrderEnabled | wix_products.preorderenabled |
| preOrderMessage | wix_products.preordermessage |
| preOrderLimit | wix_products.preorderlimit |
| sku | wix_products.sku |
| barcode | wix_products.barcode |
| weight | wix_products.weight |
| packageLength | wix_products.packagelength |
| packageWidth | wix_products.packagewidth |
| packageHeight | wix_products.packageheight |
| packageUnit | wix_products.packageunit |
| productOptionName1 | wix_products.productoptionname1 |
| productOptionType1 | wix_products.productoptiontype1 |
| productOptionChoices1 | wix_products.productoptionchoices1 |
| productOptionName2 | wix_products.productoptionname2 |
| productOptionType2 | wix_products.productoptiontype2 |
| productOptionChoices2 | wix_products.productoptionchoices2 |
| productOptionName3 | wix_products.productoptionname3 |
| productOptionType3 | wix_products.productoptiontype3 |
| productOptionChoices3 | wix_products.productoptionchoices3 |
| productOptionName4 | wix_products.productoptionname4 |
| productOptionType4 | wix_products.productoptiontype4 |
| productOptionChoices4 | wix_products.productoptionchoices4 |
| productOptionName5 | wix_products.productoptionname5 |
| productOptionType5 | wix_products.productoptiontype5 |
| productOptionChoices5 | wix_products.productoptionchoices5 |
| productOptionName6 | wix_products.productoptionname6 |
| productOptionType6 | wix_products.productoptiontype6 |
| productOptionChoices6 | wix_products.productoptionchoices6 |
| modifierName1 | wix_products.modifiername1 |
| modifierType1 | wix_products.modifiertype1 |
| modifierCharLimit1 | wix_products.modifiercharlimit1 |
| modifierMandatory1 | wix_products.modifiermandatory1 |
| modifierDescription1 | wix_products.modifierdescription1 |
| modifierName2 | wix_products.modifiername2 |
| modifierType2 | wix_products.modifiertype2 |
| modifierCharLimit2 | wix_products.modifiercharlimit2 |
| modifierMandatory2 | wix_products.modifiermandatory2 |
| modifierDescription2 | wix_products.modifierdescription2 |
| modifierName3 | wix_products.modifiername3 |
| modifierType3 | wix_products.modifiertype3 |
| modifierCharLimit3 | wix_products.modifiercharlimit3 |
| modifierMandatory3 | wix_products.modifiermandatory3 |
| modifierDescription3 | wix_products.modifierdescription3 |
| modifierName4 | wix_products.modifiername4 |
| modifierType4 | wix_products.modifiertype4 |
| modifierCharLimit4 | wix_products.modifiercharlimit4 |
| modifierMandatory4 | wix_products.modifiermandatory4 |
| modifierDescription4 | wix_products.modifierdescription4 |
| modifierName5 | wix_products.modifiername5 |
| modifierType5 | wix_products.modifiertype5 |
| modifierCharLimit5 | wix_products.modifiercharlimit5 |
| modifierMandatory5 | wix_products.modifiermandatory5 |
| modifierDescription5 | wix_products.modifierdescription5 |
| modifierName6 | wix_products.modifiername6 |
| modifierType6 | wix_products.modifiertype6 |
| modifierCharLimit6 | wix_products.modifiercharlimit6 |
| modifierMandatory6 | wix_products.modifiermandatory6 |
| modifierDescription6 | wix_products.modifierdescription6 |
| modifierName7 | wix_products.modifiername7 |
| modifierType7 | wix_products.modifiertype7 |
| modifierCharLimit7 | wix_products.modifiercharlimit7 |
| modifierMandatory7 | wix_products.modifiermandatory7 |
| modifierDescription7 | wix_products.modifierdescription7 |
| modifierName8 | wix_products.modifiername8 |
| modifierType8 | wix_products.modifiertype8 |
| modifierCharLimit8 | wix_products.modifiercharlimit8 |
| modifierMandatory8 | wix_products.modifiermandatory8 |
| modifierDescription8 | wix_products.modifierdescription8 |
| modifierName9 | wix_products.modifiername9 |
| modifierType9 | wix_products.modifiertype9 |
| modifierCharLimit9 | wix_products.modifiercharlimit9 |
| modifierMandatory9 | wix_products.modifiermandatory9 |
| modifierDescription9 | wix_products.modifierdescription9 |
| modifierName10 | wix_products.modifiername10 |
| modifierType10 | wix_products.modifiertype10 |
| modifierCharLimit10 | wix_products.modifiercharlimit10 |
| modifierMandatory10 | wix_products.modifiermandatory10 |
| modifierDescription10 | wix_products.modifierdescription10 |

### orders

| Source field | Destination column |
| --- | --- |
| Order number | wix_orders.order_number |
| Date created | wix_orders.date_created |
| Time | wix_orders.time |
| Fulfill by | wix_orders.fulfill_by |
| Total order quantity | wix_orders.total_order_quantity |
| Contact email | wix_orders.contact_email |
| Note from customer | wix_orders.note_from_customer |
| Additional checkout info | wix_orders.additional_checkout_info |
| Business location | wix_orders.business_location |
| Tags | wix_orders.tags |
| Order ID | wix_orders.order_id |
| Delivery method | wix_orders.delivery_method |
| Delivery time | wix_orders.delivery_time |
| Recipient name | wix_orders.recipient_name |
| Recipient phone | wix_orders.recipient_phone |
| Recipient company name | wix_orders.recipient_company_name |
| Delivery country | wix_orders.delivery_country |
| Delivery state | wix_orders.delivery_state |
| Delivery state name | wix_orders.delivery_state_name |
| Delivery city | wix_orders.delivery_city |
| Delivery address | wix_orders.delivery_address |
| Delivery zip/postal code | wix_orders.delivery_zip_postal_code |
| Billing name | wix_orders.billing_name |
| Billing phone | wix_orders.billing_phone |
| Billing company name | wix_orders.billing_company_name |
| Billing country | wix_orders.billing_country |
| Billing state | wix_orders.billing_state |
| Billing state name | wix_orders.billing_state_name |
| Billing city | wix_orders.billing_city |
| Billing address | wix_orders.billing_address |
| Billing zip/postal code | wix_orders.billing_zip_postal_code |
| Payment status | wix_orders.payment_status |
| Payment method | wix_orders.payment_method |
| Global coupon code | wix_orders.global_coupon_code |
| Global discount amount | wix_orders.global_discount_amount |
| Gift card amount | wix_orders.gift_card_amount |
| Shipping rate | wix_orders.shipping_rate |
| Total tax | wix_orders.total_tax |
| Total | wix_orders.total |
| Currency | wix_orders.currency |
| Refunded amount | wix_orders.refunded_amount |
| Net amount | wix_orders.net_amount |
| Additional fees | wix_orders.additional_fees |
| Amount paid | wix_orders.amount_paid |
| Fulfillment status | wix_orders.fulfillment_status |
| Item fulfillment locations | wix_orders.item_fulfillment_locations |
| Tracking number | wix_orders.tracking_number |
| Fulfillment service | wix_orders.fulfillment_service |
| Shipping label | wix_orders.shipping_label |

### items

| Source field | Destination column |
| --- | --- |
| Order number | wix_items.order_number |
| Date created | wix_items.date_created |
| Time | wix_items.time |
| Fulfill by | wix_items.fulfill_by |
| Total order quantity | wix_items.total_order_quantity |
| Contact email | wix_items.contact_email |
| Note from customer | wix_items.note_from_customer |
| Additional checkout info | wix_items.additional_checkout_info |
| Business location | wix_items.business_location |
| Tags | wix_items.tags |
| Order ID | wix_items.order_id |
| Item | wix_items.item |
| Fulfillment location | wix_items.fulfillment_location |
| Variant | wix_items.variant |
| Modifiers/Add-ons | wix_items.modifiers_add_ons |
| SKU | wix_items.sku |
| Qty | wix_items.qty |
| Quantity refunded | wix_items.quantity_refunded |
| Price | wix_items.price |
| Item coupon code | wix_items.item_coupon_code |
| Item discount amount | wix_items.item_discount_amount |
| Weight | wix_items.weight |
| Custom text | wix_items.custom_text |
| Deposit amount | wix_items.deposit_amount |
| Delivery method | wix_items.delivery_method |
| Delivery time | wix_items.delivery_time |
| Recipient name | wix_items.recipient_name |
| Recipient phone | wix_items.recipient_phone |
| Recipient company name | wix_items.recipient_company_name |
| Delivery country | wix_items.delivery_country |
| Delivery state | wix_items.delivery_state |
| Delivery state name | wix_items.delivery_state_name |
| Delivery city | wix_items.delivery_city |
| Delivery address | wix_items.delivery_address |
| Delivery zip/postal code | wix_items.delivery_zip_postal_code |
| Billing name | wix_items.billing_name |
| Billing phone | wix_items.billing_phone |
| Billing company name | wix_items.billing_company_name |
| Billing country | wix_items.billing_country |
| Billing state | wix_items.billing_state |
| Billing state name | wix_items.billing_state_name |
| Billing city | wix_items.billing_city |
| Billing address | wix_items.billing_address |
| Billing zip/postal code | wix_items.billing_zip_postal_code |
| Payment status | wix_items.payment_status |
| Payment method | wix_items.payment_method |
| Global coupon code | wix_items.global_coupon_code |
| Global discount amount | wix_items.global_discount_amount |
| Gift card amount | wix_items.gift_card_amount |
| Shipping rate | wix_items.shipping_rate |
| Total tax | wix_items.total_tax |
| Total | wix_items.total |
| Currency | wix_items.currency |
| Refunded amount | wix_items.refunded_amount |
| Net amount | wix_items.net_amount |
| Additional fees | wix_items.additional_fees |
| Amount paid | wix_items.amount_paid |
| Fulfillment status | wix_items.fulfillment_status |
| Item fulfillment locations | wix_items.item_fulfillment_locations |
| Tracking number | wix_items.tracking_number |
| Fulfillment service | wix_items.fulfillment_service |
| Shipping label | wix_items.shipping_label |

### contacts

| Source field | Destination column |
| --- | --- |
| First Name | wix_contacts.first_name |
| Last Name | wix_contacts.last_name |
| Email 1 | wix_contacts.email_1 |
| Phone 1 | wix_contacts.phone_1 |
| Phone 2 | wix_contacts.phone_2 |
| Phone 3 | wix_contacts.phone_3 |
| Address 1 - Type | wix_contacts.address_1_type |
| Address 1 - Street | wix_contacts.address_1_street |
| Address 1 - Street Line 2 | wix_contacts.address_1_street_line_2 |
| Address 1 - City | wix_contacts.address_1_city |
| Address 1 - State/Region | wix_contacts.address_1_state_region |
| Address 1 - Zip | wix_contacts.address_1_zip |
| Address 1 - Country | wix_contacts.address_1_country |
| Address 2 - Type | wix_contacts.address_2_type |
| Address 2 - Street | wix_contacts.address_2_street |
| Address 2 - Street Line 2 | wix_contacts.address_2_street_line_2 |
| Address 2 - City | wix_contacts.address_2_city |
| Address 2 - State/Region | wix_contacts.address_2_state_region |
| Address 2 - Zip | wix_contacts.address_2_zip |
| Address 2 - Country | wix_contacts.address_2_country |
| Address 3 - Type | wix_contacts.address_3_type |
| Address 3 - Street | wix_contacts.address_3_street |
| Address 3 - Street Line 2 | wix_contacts.address_3_street_line_2 |
| Address 3 - City | wix_contacts.address_3_city |
| Address 3 - State/Region | wix_contacts.address_3_state_region |
| Address 3 - Zip | wix_contacts.address_3_zip |
| Address 3 - Country | wix_contacts.address_3_country |
| Address 4 - Type | wix_contacts.address_4_type |
| Address 4 - Street | wix_contacts.address_4_street |
| Address 4 - Street Line 2 | wix_contacts.address_4_street_line_2 |
| Address 4 - City | wix_contacts.address_4_city |
| Address 4 - State/Region | wix_contacts.address_4_state_region |
| Address 4 - Zip | wix_contacts.address_4_zip |
| Address 4 - Country | wix_contacts.address_4_country |
| Address 5 - Type | wix_contacts.address_5_type |
| Address 5 - Street | wix_contacts.address_5_street |
| Address 5 - Street Line 2 | wix_contacts.address_5_street_line_2 |
| Address 5 - City | wix_contacts.address_5_city |
| Address 5 - State/Region | wix_contacts.address_5_state_region |
| Address 5 - Zip | wix_contacts.address_5_zip |
| Address 5 - Country | wix_contacts.address_5_country |
| Address 6 - Type | wix_contacts.address_6_type |
| Address 6 - Street | wix_contacts.address_6_street |
| Address 6 - Street Line 2 | wix_contacts.address_6_street_line_2 |
| Address 6 - City | wix_contacts.address_6_city |
| Address 6 - State/Region | wix_contacts.address_6_state_region |
| Address 6 - Zip | wix_contacts.address_6_zip |
| Address 6 - Country | wix_contacts.address_6_country |
| Address 7 - Type | wix_contacts.address_7_type |
| Address 7 - Street | wix_contacts.address_7_street |
| Address 7 - Street Line 2 | wix_contacts.address_7_street_line_2 |
| Address 7 - City | wix_contacts.address_7_city |
| Address 7 - State/Region | wix_contacts.address_7_state_region |
| Address 7 - Zip | wix_contacts.address_7_zip |
| Address 7 - Country | wix_contacts.address_7_country |
| Address 8 - Type | wix_contacts.address_8_type |
| Address 8 - Street | wix_contacts.address_8_street |
| Address 8 - Street Line 2 | wix_contacts.address_8_street_line_2 |
| Address 8 - City | wix_contacts.address_8_city |
| Address 8 - State/Region | wix_contacts.address_8_state_region |
| Address 8 - Zip | wix_contacts.address_8_zip |
| Address 8 - Country | wix_contacts.address_8_country |
| Address 9 - Type | wix_contacts.address_9_type |
| Address 9 - Street | wix_contacts.address_9_street |
| Address 9 - Street Line 2 | wix_contacts.address_9_street_line_2 |
| Address 9 - City | wix_contacts.address_9_city |
| Address 9 - State/Region | wix_contacts.address_9_state_region |
| Address 9 - Zip | wix_contacts.address_9_zip |
| Address 9 - Country | wix_contacts.address_9_country |
| Address 10 - Type | wix_contacts.address_10_type |
| Address 10 - Street | wix_contacts.address_10_street |
| Address 10 - City | wix_contacts.address_10_city |
| Address 10 - State/Region | wix_contacts.address_10_state_region |
| Address 10 - Zip | wix_contacts.address_10_zip |
| Address 10 - Country | wix_contacts.address_10_country |
| Company | wix_contacts.company |
| Labels | wix_contacts.labels |
| Created At (UTC+0) | wix_contacts.created_at_utc_0 |
| Email subscriber status | wix_contacts.email_subscriber_status |
| SMS subscriber status | wix_contacts.sms_subscriber_status |
| Last Activity | wix_contacts.last_activity |
| Last Activity Date (UTC+0) | wix_contacts.last_activity_date_utc_0 |
| Source | wix_contacts.source |
| Language | wix_contacts.language |
| Message | wix_contacts.message |
| Subject | wix_contacts.subject |

## Execution boundaries

Use scripts/rehearse-wix-import.py with the private source directory and a NEW private output directory. It only creates local SQLite databases and exports. Do not apply its SQLite dump directly to production: deployment/import needs D1 batching, resource limits, reviewed identity reconciliation, Access protection and a verified migration ledger. The new schema is migration 016; it does not alter live orders, contacts, stock or payment provider state.

Historical values remain immutable through the admin. Operational review state and notes live separately in wix_record_work and are attributed in admin_audit. Never use historical order IDs as Stripe session IDs or replay historic notifications.

Business settings observed in Wix are captured privately and remain outside the four CSV field contract. The active culinary-salt discount and tax groups are launch blockers until behavior is reproduced and approved, even though CSV preservation passes.
