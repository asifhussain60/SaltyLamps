# Salty Lamps deployment boundary

The former proposal deployment belonged to the retired `asifhussain60@hotmail.com` Cloudflare account. Its deployment command is disabled and must not be re-enabled or used. The old account, project, database, bucket and saved credentials are historical provenance only.

The approved destination is the Cloudflare account owned by `Saltylamps@hotmail.com`. `asifhussain60@gmail.com` is authorized to be an administrator **within that owner account**; the invitation, acceptance and effective role still need verification. The separate Gmail-owned personal account is not the Salty Lamps deployment destination. See [account ownership](../infra/account-ownership.md).

The [production handover](PRODUCTION-HANDOVER.md) and [migration plan](docs/migration.md) govern setup. Production configuration still contains a placeholder and the deployment gate is expected to stop. It must remain stopped until owner-account resources, protected administrator access, import review, backups, payment providers, mail and rollback checks have passed. The Wix shop and Zoho mail remain live.

For offline review, `npm run build` uses the committed content snapshot and makes no remote database request by default. Local browser tests must use disposable local data. No customer-domain launch or live payment should be inferred from a successful build.
