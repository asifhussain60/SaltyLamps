# Salty Lamps — Infrastructure (plain-English)

This document explains, in plain terms, what runs the Salty Lamps website — the services it uses, what each one does, and roughly what it costs. No technical background needed.

> **The one-sentence version:** the entire site runs on **Cloudflare** (hosting, database, image storage, and admin security), and **Stripe** handles card payments. There are no other servers to manage.

> This page mirrors the in-admin **Documentation → Infrastructure** page. Both render the same diagrams from [`diagrams/`](diagrams/).

## The big picture

A shopper's web browser only ever talks to Cloudflare. Behind the scenes, small Cloudflare programs fetch products from the database, serve images, and hand payments to Stripe.

![System architecture: the browser talks to Cloudflare Pages, which talks to D1, R2, Stripe and Cloudflare Access.](diagrams/system-architecture.svg)

*Solid lines are what shoppers do; dashed lines are admin-only.*

## What each service is — and what it costs

| Service | What it does | Cost |
|---|---|---|
| ☁️ **Cloudflare Pages** | Hosts the website and delivers it fast worldwide — the "home" of the shop. | Free tier covers this site |
| ⚙️ **Cloudflare Functions** | Small programs that load products, take checkout, confirm payments, and power the admin. | Included with Pages |
| 🗄️ **D1 database** | The shop's memory: every product, price, stock level and order. | Free tier covers this site |
| 🖼️ **R2 storage** | Holds product photos uploaded through the admin. | Free up to 10 GB |
| 💳 **Stripe** | Takes card payments on its own secure page — the shop never sees card numbers. | Standard per-transaction fee |
| 🛡️ **Cloudflare Access** | The lock on the admin door — decides who may enter the admin area. | Free for a few admins |

## How a purchase works

Card details are only ever entered on Stripe's own page, never on the shop. Once Stripe confirms payment, it tells the site to record the order.

![Checkout flow: shopper clicks pay, the site creates a Stripe session, the shopper pays on Stripe, Stripe notifies the site, and the order is saved.](diagrams/checkout-flow.svg)

## How the admin area is protected

The admin portal is separated from the public shop. In the real (production) setup, Cloudflare Access asks anyone trying to enter to sign in first, and the site double-checks that sign-in on every action.

![Admin auth: Cloudflare Access signs the admin in and issues a pass, which the site verifies on every admin request.](diagrams/admin-auth.svg)

> ⚠️ **Note about the current test site:** the current dev / UAT site has this lock switched off on purpose (`DEV_ADMIN_BYPASS`), so testers can try the admin freely. On the real shop this must be switched back on — see the Technical Documentation.

## Two separate environments

There are two independent copies of the shop, so testing never touches real customers.

| | Dev / UAT (testing) | Production (the real shop) |
|---|---|---|
| Purpose | Trying out changes safely | Real customers & real orders |
| Orders shown | Simulated demo orders | Only genuine orders |
| Payments | Test payments | Live Stripe payments |
| Cloudflare account | The developer's account | The owner's own account |

When the shop moves to production, it runs entirely on the owner's own Cloudflare and Stripe accounts, so the owner controls hosting, data, and payments end-to-end. See [`PRODUCTION-HANDOVER.md`](../PRODUCTION-HANDOVER.md).
