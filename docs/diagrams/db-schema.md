This diagram shows the complete database schema for S3 Portal, including all tables, columns, types, primary/foreign keys, relationships, and enum values.

```mermaid
erDiagram
  AWSCredential {
    id String PK
    name String
    encryptedAccessKey String
    encryptedSecretKey String
    region String
    userId String FK
      %% nullable
      teamId String FK
    createdAt DateTime
    updatedAt DateTime
  }
  AccessLog {
    id String PK
      %% nullable
      linkId String FK
    userId String FK?
    ipAddress String
      %% nullable
      userAgent String
    action String
    success Boolean
      %% nullable
      errorMessage String
    createdAt DateTime
      %% nullable
      metadata Json
      %% nullable
      resourceId String
      %% nullable
      resourceType String
      %% nullable
      teamId String FK
  }
  File {
    id String PK
    key String
    name String
    size BigInt
      %% nullable
      contentType String
      %% nullable
      etag String
    parentPath String
    userId String FK
      %% nullable
      teamId String FK
    credentialId String FK
      %% nullable
      metadata Json
    createdAt DateTime
    updatedAt DateTime
    tags String[]
      %% nullable
      description String
    bucketId String FK
  }
  AwsBucket {
    id String PK
    credentialId String FK
    bucket String
      %% nullable
      cloudfrontDomain String
      %% nullable
      cloudfrontKeyPairId String
      %% nullable
      encryptedCloudfrontPrivateKey String
    createdAt DateTime
    updatedAt DateTime
  }
  FileFavorite {
    id String PK
    userId String FK
    fileId String FK
    createdAt DateTime
  }
  Link {
    id String PK
    hash String
    type LinkType
    fileId String FK
      %% nullable
      expiresAt DateTime
      %% nullable
      passwordHash String
      %% nullable
      maxDownloads Int
    downloadCount Int
    allowDownload Boolean
    allowPreview Boolean
    userId String FK
    createdAt DateTime
    updatedAt DateTime
  }
  Role {
    id String PK
    name String
      %% nullable
      description String
    level Int
    isSystem Boolean
    createdAt DateTime
    updatedAt DateTime
  }
  RolePermission {
    id String PK
    roleId String FK
    screenName ScreenName
    permissionLevel PermissionLevel
    createdAt DateTime
  }
  ScreenPermission {
    id String PK
    teamMemberId String FK
    screenName ScreenName
    permissionLevel PermissionLevel
    createdAt DateTime
    updatedAt DateTime
  }
  Team {
    id String PK
    name String
    slug String
    ownerId String FK
    createdAt DateTime
    updatedAt DateTime
  }
  StorageQuota {
    id String PK
    teamId String FK
    usedBytes BigInt
      %% nullable
      limitBytes BigInt
    createdAt DateTime
    updatedAt DateTime
  }
  TeamMember {
    id String PK
    teamId String FK
    userId String FK
    createdAt DateTime
    updatedAt DateTime
    roleId String FK
  }
  TeamInvite {
    id String PK
    teamId String FK
    email String
    roleId String FK
    invitedById String FK
    status InviteStatus
    token String
    expiresAt DateTime
    createdAt DateTime
    updatedAt DateTime
  }
  User {
    id String PK
    email String
    name String?
      %% nullable
      passwordHash String
    createdAt DateTime
    updatedAt DateTime
      %% nullable
      deletedAt DateTime
  }

  AWSCredential ||--o{ AwsBucket : has
  AWSCredential ||--o{ File : has
  AWSCredential }o--|| Team : belongs_to
  AWSCredential }o--|| User : belongs_to
  AccessLog }o--|| Link : relates_to
  AccessLog }o--|| Team : relates_to
  AccessLog }o--|| User : relates_to
  File ||--o{ FileFavorite : has
  File ||--o{ Link : has
  File }o--|| AwsBucket : belongs_to
  File }o--|| AWSCredential : belongs_to
  File }o--|| Team : belongs_to
  File }o--|| User : belongs_to
  AwsBucket ||--o{ File : has
  AwsBucket }o--|| AWSCredential : belongs_to
  FileFavorite }o--|| File : belongs_to
  FileFavorite }o--|| User : belongs_to
  Link }o--|| File : belongs_to
  Link }o--|| User : belongs_to
  Role ||--o{ RolePermission : has
  Role ||--o{ TeamInvite : has
  Role ||--o{ TeamMember : has
  RolePermission }o--|| Role : belongs_to
  ScreenPermission }o--|| TeamMember : belongs_to
  Team ||--o{ AWSCredential : has
  Team ||--o{ AccessLog : has
  Team ||--o{ File : has
  Team ||--o{ StorageQuota : has
  Team }o--|| User : owner
  Team ||--o{ TeamInvite : has
  Team ||--o{ TeamMember : has
  StorageQuota }o--|| Team : belongs_to
  TeamMember }o--|| Role : belongs_to
  TeamMember }o--|| Team : belongs_to
  TeamMember }o--|| User : belongs_to
  TeamInvite }o--|| User : invited_by
  TeamInvite }o--|| Role : belongs_to
  TeamInvite }o--|| Team : belongs_to
  User ||--o{ AWSCredential : has
  User ||--o{ AccessLog : has
  User ||--o{ File : has
  User ||--o{ FileFavorite : has
  User ||--o{ Link : has
  User ||--o{ Team : has
  User ||--o{ TeamInvite : sent_invites
  User ||--o{ TeamMember : has

  %% Enum values
  %% LinkType: PUBLIC, PRESIGNED, CLOUDFRONT
  %% InviteStatus: PENDING, ACCEPTED, CANCELLED, EXPIRED
  %% PermissionLevel: VIEW, EDIT
  %% ScreenName: FILES_LIST, FILES_UPLOAD, FILES_DELETE, FILES_SHARE, CREDENTIALS_LIST, CREDENTIALS_CREATE, CREDENTIALS_EDIT, CREDENTIALS_DELETE, TEAM_SETTINGS, TEAM_MEMBERS, TEAM_INVITATIONS, TEAM_DELETE, LINKS_LIST, LINKS_CREATE, LINKS_DELETE, ADMIN_AUDIT_LOG, ADMIN_SETTINGS
```
