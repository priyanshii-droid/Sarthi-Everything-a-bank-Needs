# Saarthi provider boundary
Adapters implement `listAccounts(connection)`, `listTransactions(connection, options)`, and optionally `getBalances(connection)`, `refresh(connection)` and `disconnect(connection)`.

The application stores provider-issued connection references/tokens, never bank login passwords, PINs, OTPs or CVVs. A production adapter should use the provider's official OAuth/consent flow and token vault/KMS rather than accepting credentials in Saarthi request bodies.
