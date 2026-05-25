# Testing Documentation

## Overview

This document describes the automated test suite for S3 Portal, covering critical functionality across authentication, file operations, sharing, and RBAC.

## Test Suite Structure

```
__tests__/
├── lib/
│   └── crypto.test.ts              # Encryption, hashing, crypto utilities
├── auth/
│   └── flows.test.ts               # User registration, login, sessions
├── sharing/
│   └── links.test.ts               # Share links, expiration, access control
└── rbac/
    └── permissions.test.ts         # Role hierarchy, permissions, access control
```

## Running Tests

### Install Dependencies
```bash
npm install
```

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Run Specific Test File
```bash
npm test -- __tests__/lib/crypto.test.ts
```

### Run Tests Matching Pattern
```bash
npm test -- --testNamePattern="encrypt"
```

## Test Coverage

### Crypto Module (`__tests__/lib/crypto.test.ts`)
- **Encryption/Decryption** (6 tests)
  - Symmetric encryption with AES-256-GCM
  - Deterministic decryption
  - Credential format handling
  - Invalid ciphertext handling
  - Encryption key validation

- **Password Hashing** (6 tests)
  - Scrypt-based hashing
  - Salt-based verification
  - Incorrect password rejection
  - Unique hashes per password
  - Long password handling
  - Special character support

- **Edge Cases** (3 tests)
  - Empty string encryption
  - Unicode character support
  - Large data handling (1MB+)

**Total: 15 tests**

### Authentication Flows (`__tests__/auth/flows.test.ts`)
- **Registration** (5 tests)
  - Field validation (name, email, password)
  - Duplicate email prevention
  - Password hashing before storage
  - Automatic team creation
  - Transaction integrity

- **Session Management** (2 tests)
  - JWT token claims (roleId, teamId)
  - Cross-request session persistence

- **Password Validation** (2 tests)
  - Minimum length enforcement
  - Strong password acceptance

- **Email Validation** (2 tests)
  - Invalid format rejection
  - Valid format acceptance

- **Error Handling** (2 tests)
  - Database error recovery
  - Missing system roles handling

**Total: 13 tests**

### File Sharing - Share Links (`__tests__/sharing/links.test.ts`)
- **Link Creation** (4 tests)
  - Parameter validation
  - Unique hash generation
  - Password protection
  - Download expiration

- **Access Control** (5 tests)
  - Password verification
  - Download count tracking
  - Public access permissions
  - Preview without download

- **Security** (5 tests)
  - Presigned URL support
  - CloudFront signed URL support
  - Hash randomization
  - Credential non-exposure
  - Sensitive data protection

- **Expiration** (3 tests)
  - Expired link rejection
  - Valid link acceptance
  - Default expiration handling

- **Error Handling** (3 tests)
  - File not found scenarios
  - Unauthorized access
  - Invalid password hashes

**Total: 20 tests**

### RBAC - Permissions (`__tests__/rbac/permissions.test.ts`)
- **Role Hierarchy** (4 tests)
  - Role level enforcement
  - OWNER permissions (all access)
  - ADMIN permissions (limited)
  - VIEWER permissions (read-only)

- **Screen-Level Permissions** (4 tests)
  - Admin panel access control
  - File management access
  - Role management restrictions
  - Audit log access

- **Team-Based Access** (4 tests)
  - Team resource isolation
  - Cross-team prevention
  - Owner personal access
  - Non-member blocking

- **File Access Control** (4 tests)
  - Owner file operations
  - Team member operations
  - Unauthorized deletion prevention
  - Viewer download permissions

- **Credential Access** (3 tests)
  - Cross-team credential prevention
  - Encrypted credential protection
  - Team ownership enforcement

- **Permission Inheritance** (2 tests)
  - Role-based permission application
  - Hierarchical screen permissions

- **Permission Caching** (2 tests)
  - Cache population
  - Cache invalidation

- **Audit & Logging** (2 tests)
  - Permission denial logging
  - Permission change tracking

- **Edge Cases** (3 tests)
  - Deleted user handling
  - Suspended member handling
  - Missing role assignment handling

**Total: 28 tests**

## Test Statistics

| Suite | Count |
|-------|-------|
| Crypto | 15 |
| Auth | 13 |
| Sharing | 20 |
| RBAC | 28 |
| **Total** | **76** |

## Continuous Integration

Tests are automatically run on:
- **Push to main branch** 
- **Pull requests**

The CI workflow:
```yaml
1. Checkout code
2. Setup Node.js 18
3. Install dependencies
4. Generate Prisma client
5. Lint code
6. Run tests (with coverage)
7. Build Next.js application
```

Tests must pass before merging PRs.

## Coverage Targets

Current coverage targets by module:

| Module | Target |
|--------|--------|
| `lib/crypto.ts` | 95%+ |
| `lib/auth.ts` | 80%+ |
| `lib/permissions.ts` | 90%+ |
| API Routes | 70%+ |

Run with `npm run test:coverage` to view detailed coverage reports.

## Mocking Strategy

Tests use Jest mocks for:
- **Prisma Client**: Database operations
- **AWS SDK**: S3 and CloudFront operations
- **NextAuth**: Session management
- **Environment Variables**: Configuration

Example mock setup:
```typescript
jest.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: jest.fn(), create: jest.fn() },
    // ...
  }
}))
```

## Adding New Tests

### 1. Create Test File
```bash
mkdir -p __tests__/my-feature
touch __tests__/my-feature/feature.test.ts
```

### 2. Write Test
```typescript
describe('Feature Name', () => {
  it('should do something', () => {
    // arrange
    const input = 'test'
    
    // act
    const result = fn(input)
    
    // assert
    expect(result).toBe('expected')
  })
})
```

### 3. Run Tests
```bash
npm test
```

## Test Best Practices

1. **Clear Test Names**: Describe what is being tested and expected outcome
   ```typescript
   it('should hash password consistently with scrypt', async () => {})
   ```

2. **Arrange-Act-Assert Pattern**: Structure tests clearly
   ```typescript
   // Arrange: Set up test data
   const password = 'Test123!'
   
   // Act: Call function
   const hash = await hashPassword(password)
   
   // Assert: Verify outcome
   expect(hash).toBeDefined()
   ```

3. **Test Edge Cases**: Cover boundary conditions
   - Empty strings
   - Large data
   - Special characters
   - Unicode
   - Null/undefined

4. **Mock External Dependencies**: Isolate unit logic
   - Database (Prisma)
   - AWS services
   - Authentication
   - File system

5. **Use Descriptive Assertions**
   ```typescript
   // Good
   expect(isExpired).toBe(true)
   expect(permissions).toContain('READ')
   
   // Avoid
   expect(x).toBe(1)
   ```

6. **Group Related Tests**: Use `describe` blocks
   ```typescript
   describe('Share Link Creation', () => {
     it('...', () => {})
     it('...', () => {})
   })
   ```

## Debugging Tests

### Run Single Test
```bash
npm test -- __tests__/lib/crypto.test.ts
```

### Run Tests Matching Pattern
```bash
npm test -- --testNamePattern="encrypt"
```

### Verbose Output
```bash
npm test -- --verbose
```

### Debug in Node Inspector
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

Then open `chrome://inspect` in Chrome.

## Common Issues

### Issue: Tests timeout
**Solution**: Increase Jest timeout
```typescript
jest.setTimeout(10000) // 10 seconds
```

### Issue: Mocks not working
**Solution**: Clear mocks in beforeEach
```typescript
beforeEach(() => {
  jest.clearAllMocks()
})
```

### Issue: Module not found
**Solution**: Check tsconfig paths and jest.config.js moduleNameMapper

### Issue: Prisma client not available
**Solution**: Run `npm run db:generate` before tests

## CI/CD Integration

Tests are enforced via GitHub Actions:
- Failure blocks PR merge
- Coverage reports uploaded to artifacts
- Failed tests prevent deployment

View workflow: `.github/workflows/ci.yml`

## Performance

- **Total test suite**: ~5-10 seconds
- **Test execution**: Parallel via Jest
- **Coverage report**: ~2-3 seconds

Optimize with:
```bash
npm test -- --maxWorkers=4
```

## Future Enhancements

- [ ] E2E tests with Playwright
- [ ] Performance benchmarks
- [ ] Integration tests with test database
- [ ] API contract testing
- [ ] Visual regression testing
- [ ] Security scanning

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Best Practices](https://testingjavascript.com/)
