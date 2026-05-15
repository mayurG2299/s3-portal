This diagram shows the approval/status workflow for files in S3 Portal, including all states, transitions, role-based access, and side effects such as audit logging and quota updates.

```mermaid
stateDiagram-v2
  [*] --> Created
  Created --> Uploading: "upload / user"
  Uploading --> Uploaded: "complete / user"
  Uploaded --> Verified: "verify / admin or owner"
  Uploaded --> Deleted: "delete / owner or admin"
  Verified --> Deleted: "delete / owner or admin"
  Created --> Deleted: "delete / owner or admin"

  state Uploaded {
    Uploaded --> Uploading: "retry / user"
    Uploaded --> Verified: "verify / admin or owner"
    Uploaded --> Deleted: "delete / owner or admin"
  }

  state Verified {
    Verified --> Deleted: "delete / owner or admin"
  }

  %% Role-based access per transition
  %% upload: user
  %% complete: user
  %% verify: admin or owner
  %% delete: owner or admin
  %% retry: user

  %% Side effects
  note right of Uploaded
    - Audit log written
    - Quota incremented
    - DB record updated
  end
  note right of Verified
    - Audit log written
    - Quota checked/adjusted
    - DB record updated
  end
  note right of Deleted
    - Audit log written
    - Quota decremented
    - DB record deleted
    - S3 object deleted
  end

  %% UNCLEAR: Additional states may exist for shared links or favorites, but not directly part of file approval.
```
