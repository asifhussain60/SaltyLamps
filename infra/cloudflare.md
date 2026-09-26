# Retired proposal Cloudflare record

> Historical provenance only. The former `asifhussain60@hotmail.com` Cloudflare account, its `salty-lamps-proposal` project, database, bucket and saved credentials are prohibited for further Salty Lamps work. Do not run remote commands from an older revision of this guide. The current rule is [account ownership](account-ownership.md); the active migration instructions are in the [migration plan](../salty-lamps-site/docs/migration.md) and [production handover](../salty-lamps-site/PRODUCTION-HANDOVER.md).

The old proposal was a test deployment with simulated orders. Its database was backed up locally before Asif retired the account; that backup is a historical artifact and must not be copied wholesale into production. The customer shop remains on Wix. The approved destination is the Salty Lamps owner account, with Gmail invited as its administrator once permissions are verified.

For local development, use the committed content snapshot and a disposable local database. The default configuration now contains a local-only database identifier. Live data operations require an explicit, reviewed owner-account target. The former deployment and demo-data refresh commands stop before reading credentials or contacting Cloudflare.
