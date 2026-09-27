# Administrator Access API route — review only

The owner-account Zero Trust dashboard crashes when the exact Emails rule is selected. The owner reproduced the form failure. No Access application, policy, administrator DNS record, or protected administrator deployment exists. Do not retry the browser form or expose the administrator host while this remains unresolved.

## Narrow API design

1. Use the verified Salty Lamps Cloudflare account only. The proposed token permission is `Access: Apps and Policies Write`, scoped to that account. Do not use a global API key or any credential from the retired account. The token does not yet exist in the approved secret store.
2. Create one self-hosted Access application for the entire `admin.saltylamps.co.uk` hostname. Do not add a public-path override, bypass rule, or wildcard domain. Select only the existing Cloudflare identity provider, using its ID read from the owner account when the change is made.
3. Attach one Allow policy whose Include rules are the two approved email addresses, `Saltylamps@hotmail.com` and `asifhussain60@gmail.com`, and whose Require rule is membership in the approved owner Cloudflare account. Include rules are OR; Require rules are AND. This intersects the explicit allowlist with account membership. Do not include a domain-wide email rule or Everyone. The retired address must never appear in an Allow rule.
4. Read back the saved application, policy, identity provider and audience tag from the owner account. Confirm the policy has exactly the intended selectors and no bypass before adding DNS or deploying the administrator application.
5. Then verify unauthenticated denial, both approved sign-ins, and denial after revocation. Keep application-level administrator checks enabled; Access alone is not evidence that the shop's own permissions are correct.

This is an offline design review, not authorization or evidence that Access has been configured. The API request body and target IDs must be checked against the live owner account before execution. The administrator protection stage remains blocked.

## Official references checked on 27 September 2026

- [Create an Access application](https://developers.cloudflare.com/api/resources/zero_trust/subresources/access/subresources/applications/methods/create/) — requires `Access: Apps and Policies Write` and supports a self-hosted application.
- [Create an Access application policy](https://developers.cloudflare.com/api/resources/zero_trust/subresources/access/subresources/applications/subresources/policies/methods/create/) — application-specific policy endpoint.
- [Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/) — Include is OR, Require is AND; Cloudflare Account Member requires the Cloudflare identity provider.
- [Publish a self-hosted application](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/) — use a public hostname and an Access policy; applications deny users by default unless an Allow policy matches.
