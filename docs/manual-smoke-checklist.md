# Manual smoke checklist

Run this after the relevant test account, domain/provider, or written approval is available. Do not use a real marketplace account for sandbox cases.

## App and per-user data

- [ ] Sign up as a test admin, sign out, and sign back in.
- [ ] Create a second user and confirm inbox messages, skill profile, bidding rules, gig drafts, setup progress, and notifications are isolated.
- [ ] Confirm OAuth connection buttons remain unavailable until a provider flow is implemented; adding demo profile details must say they are demo-only.

## Job finder and bids

- [ ] Save a skill profile, reload, and confirm Radar uses it by default.
- [ ] Run a job scan; verify duplicate listing URLs appear once and each row links to the original source.
- [ ] Set a restrictive match score, minimum bid, and daily cap; confirm the server rejects each violating bid even if the client submits directly.
- [ ] In the Freelancer.com sandbox only, prepare a bid, require explicit approval, submit once, and verify a second submission cannot reuse an approval.
- [ ] When a sandbox/API response is available, update the recorded bid outcome and confirm the status remains private to that user.

## Forwarded inbox

- [ ] Verify the platform notification's sender, body/preview, and deep link using the test mailbox before enabling that platform in `INBOUND_EMAIL_PLATFORMS`.
- [ ] Complete Gmail/Outlook forwarding-address verification outside this app; this app does not display forwarding confirmation codes.
- [ ] Send a test forwarded notification through the provider webhook and confirm it appears for the correct user only.
- [ ] Deliver the same Message-ID twice and confirm one inbox record remains.
- [ ] Draft a reply, copy it, open the original platform thread, and verify that no message was sent from this app.

## Gig drafts and account setup

- [ ] Generate gig copy, copy each field, save a draft, reload, and confirm the draft persists.
- [ ] Open the Fiverr or Upwork editor link and publish manually using a test account only.
- [ ] Open each signup link and verify the generic profile/identity checklist; account registration and verification must remain user-operated.

## Operations and permissions

- [ ] Configure Sentry DSNs and confirm frontend/backend events arrive without exposing tokens or message bodies in logs.
- [ ] Sync the Render Blueprint, confirm API and Arq worker health, and verify the scheduled public-feed refresh.
- [ ] Keep Upwork, Freelancer.com, and Reddit live calls disabled until their written product permissions and approved credentials are recorded.
