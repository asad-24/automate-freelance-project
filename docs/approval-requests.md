# Platform permission request drafts

These messages are ready for the product owner to review and send from the company account. They have not been sent. Replace bracketed items with accurate company details and expected usage.

## Upwork commercial API use

**To:** partnerships@upwork.com  
**Subject:** Commercial API access request for a multi-user freelancer workspace

Hello Upwork Partnerships,

We are building [company and product URL], a commercial workspace that helps freelancers find relevant jobs, draft proposals, and review marketplace messages. We would like to request written approval for commercial use of the Upwork API and guidance on the application and partner process.

The intended workflow is:

- Each user authorizes access to their own Upwork account through the approved OAuth flow.
- We read public marketplace job postings and, if approved, create proposals only after the user reviews and explicitly approves each proposal.
- We read and reply to messages only if the required messaging scopes are approved; any reply requires explicit user approval.
- We will follow the approved scopes, rate limits, retention/cache limits, and data-use requirements.
- We will not automate browser access, bypass platform controls, or send unapproved proposals or messages.

Expected launch size: [users] users and approximately [requests] API requests per day. Our planned pricing is [pricing model]. Please confirm whether this use case and pricing model are eligible, which app type and scopes are required, and any additional terms, review, or data-handling requirements.

Thank you,  
[name, role, company, contact details]

## Freelancer.com commercial API permission

**To:** Freelancer.com Developer/Partnerships support  
**Subject:** Written permission request for a commercial multi-user API integration

Hello,

We request written confirmation that [company and product URL] may use the Freelancer.com API in a commercial multi-user product. Please assess these proposed operations separately:

- Search and display public projects to the user who requested the search.
- Prepare a bid draft and submit it only after that user explicitly approves it through their own authorized account.
- Read the user's own project message threads and send a reply only after explicit user approval.

Please confirm whether this use is permitted under the User Agreement and API Terms, what OAuth/app scopes and review are required, whether each user must authorize an individual account, and the rules for caching, display, retention, fees, and use of API data. Please also confirm whether use in a commercial multi-tenant product is permitted despite the restrictions on ordinary-course business reliance and competing services.

We will keep all production calls disabled until we receive written scope approval.

Regards,  
[name, role, company, contact details]

## Fiverr seller API/partner access

**Subject:** Approved seller-side API or partner integration inquiry

Hello Fiverr Partnerships,

We are exploring a seller productivity workspace for [company/product URL]. We do not use browser bots or automated retrieval. Our current workflow is for a seller to review AI-written drafts and paste them into Fiverr manually.

Does Fiverr offer an approved API or partner program for a seller to receive their own message/order notifications and manage their own Gigs? If so, please share eligibility, scopes, data-use rules, review requirements, and whether commercial multi-user use is allowed. We will not automate seller accounts unless Fiverr explicitly approves the method.

Regards,  
[name, role, company, contact details]

## Reddit Data API commercial approval

**Subject:** Commercial Data API approval for a user-initiated r/forhire search

Hello Reddit Data API Team,

We request approval for [company/product URL] to use the authenticated Reddit Data API in a commercial product. Users would initiate searches for public `[Hiring]` posts in r/forhire. We would display a short excerpt, Reddit username, timestamp, and a link to the original post. We would not message users automatically, bypass access controls, or use scraping.

Please confirm whether this use is eligible, which OAuth application and scopes are required, and the permitted display, retention, deletion, and rate-limit requirements. Expected usage is [users] users and [requests] requests per day.

Regards,  
[name, role, company, contact details]
