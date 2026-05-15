This diagram shows the end-to-end flow for the primary feature: Secure file upload, including validation, quota checks, S3 presigned URL generation, async multipart handling, and error paths.

```mermaid
flowchart TD
  subgraph Entry
    A[User initiates upload]
    B[POST /api/files]
  end

  subgraph Validation
    C[Validate input (zod schema)]
    D[Authenticate user (NextAuth)]
    E[Authorize (requireScreenPermission)]
  end

  subgraph Processing
    F[Check quota (storage-quota)]
    G[Get accessible bucket]
    H[Decrypt AWS credentials]
    I[Build S3 key]
  end

  subgraph Async Dispatch
    J[Generate presigned S3 URL]
    K[Client uploads file to S3]
    L[Create/update file record in DB]
    M[Increment quota usage]
  end

  subgraph Outcome
    N[Return presigned URL]
    O[User uploads file]
    P[Verify upload (optional)]
    Q[Audit log]
  end

  A --> B --> C --> D --> E
  E --> F
  F -- Yes --> G --> H --> I --> J --> N
  F -- No (Quota exceeded) --> R[Error: Storage quota exceeded]
  N --> O --> K
  K --> L --> M --> P --> Q
  F -.-> R
  D -- No (Unauthenticated) --> S[Error: Unauthorized]
  E -- No (Forbidden) --> T[Error: Forbidden]

  %% Error paths
  J -- S3 error --> U[Error: S3 failure]
  K -- Upload error --> V[Error: Upload failed]
  P -- Verification error --> W[Error: Verification failed]

  %% UNCLEAR: Some async steps (e.g., multipart completion) may involve additional DB updates and quota checks.
```
