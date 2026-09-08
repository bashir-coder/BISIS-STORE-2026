# Manual secret rotation required

Real credentials were present in local environment files during the security audit.
Do not commit those files or bake them into container images.

Before any deployment, an authorized operator must rotate and replace every affected
credential through the production secret manager, including Supabase service-role and
anonymous keys, JWT/signing keys, Google OAuth credentials, SMTP credentials, AI
provider credentials, Telegram credentials, and blockchain/RPC credentials. This
repository intentionally does not automate that irreversible operation.

## Payment verification launch blocker

The backend supports Polygon USDC verification only when `WEB3_RPC_URL`,
`WEB3_NETWORK=polygon`, `USDC_CONTRACT_ADDRESS`, and a valid
`WEB3_RECIPIENT_ADDRESS` are supplied by the deployment secret manager.
The current local configuration does not contain an authoritative recipient.
Do not mark payments verified or fulfil orders until those values are configured,
the approved launch migration (including `verify_payment_and_order`) is applied,
and the RPC provider is confirmed reachable.
