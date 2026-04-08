// Mock environment variables for tests
process.env.ENCRYPTION_KEY = "test-encryption-key-min-32-chars!";
process.env.NEXTAUTH_SECRET = "test-nextauth-secret";
process.env.NEXTAUTH_URL = "http://localhost:3000";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.AWS_REGION = "us-east-1";
process.env.AWS_ACCESS_KEY_ID = "test-key";
process.env.AWS_SECRET_ACCESS_KEY = "test-secret";
process.env.S3_BUCKET = "test-bucket";
process.env.CLOUDFRONT_DOMAIN = "test.cloudfront.net";
process.env.MAX_FILE_SIZE_MB = "5000";

if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
}
