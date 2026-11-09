"""Explicit owner provisioning: python -m app.owner_access EMAIL --grant --identity-checked.

Run on a trusted machine with the API's MongoDB settings. The operator must
verify the person's identity and control of the email outside this CLI first.
Adding an address to OWNER_EMAILS alone never grants account privileges.
"""
import argparse
import asyncio

from . import db
from .config import get_settings


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("email")
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--grant", action="store_true")
    action.add_argument("--revoke", action="store_true")
    parser.add_argument("--identity-checked", action="store_true")
    args = parser.parse_args()
    if not db.enabled():
        parser.error("MONGODB_URI is required; an in-memory API is a different process.")
    if args.grant and (not args.identity_checked or args.email.lower().strip() not in get_settings().owner_email_set):
        parser.error("Grant requires an allowlisted OWNER_EMAILS address and --identity-checked.")
    if not await db.set_platform_owner(args.email, args.grant):
        parser.error("The account must sign up before provisioning.")
    print("Owner access granted." if args.grant else "Owner access revoked.")


if __name__ == "__main__":
    asyncio.run(main())
