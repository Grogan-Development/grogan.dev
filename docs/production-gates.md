# Production gates

## LocalBusiness JSON-LD

`LocalBusiness` structured data is intentionally omitted unless both production values have been verified as public and supplied at build time:

- `NEXT_PUBLIC_LOCAL_BUSINESS_PHONE`
- `NEXT_PUBLIC_GOOGLE_BUSINESS_PROFILE_URL`

The GBP URL must be an HTTPS `www.google.com` URL and the phone must contain at least ten digits. Do not use placeholders. Until both values are approved, the site emits no `LocalBusiness` schema or unverified phone/address/GBP claims.
