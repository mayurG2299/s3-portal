/** @jest-environment node */

jest.mock("@/lib/db", () => ({
  prisma: {
    teamMember: { findFirst: jest.fn(), findUnique: jest.fn() },
    aWSCredential: { findMany: jest.fn() },
    link: { findMany: jest.fn() },
  },
}));

jest.mock("next-auth", () => ({
  __esModule: true,
  default: jest.fn(() => jest.fn()),
  getServerSession: jest.fn(),
}));

import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { GET as credentialsGet } from "@/app/api/credentials/route";
import { GET as linksGet } from "@/app/api/links/route";

const mockSession = (userId: string, teamId?: string) => {
  (getServerSession as jest.Mock).mockResolvedValue({
    user: { id: userId, teamId: teamId || null },
  });
};

describe("Personal-Scope Fallback API", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("returns only personal credentials and sets flag if teamId is invalid", async () => {
    mockSession("user-1", "team-x");
    (prisma.teamMember.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.aWSCredential.findMany as jest.Mock).mockResolvedValue([
      { id: "cred1", userId: "user-1", teamId: null },
    ]);

    const req = {
      url: "http://localhost/api/credentials?teamId=team-x",
    } as any;
    const res = await credentialsGet(req);
    const json = await res.json();
    expect(json.personalScopeFallback).toBe(true);
    expect(json.credentials).toEqual([
      { id: "cred1", userId: "user-1", teamId: null },
    ]);
  });

  it("keeps personal fallback when explicit teamId is invalid even if session team is valid", async () => {
    mockSession("user-1", "team-valid");
    (prisma.teamMember.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "mem1", userId: "user-1", teamId: "team-valid" });
    (prisma.aWSCredential.findMany as jest.Mock).mockResolvedValue([
      { id: "cred1", userId: "user-1", teamId: null },
    ]);

    const req = {
      url: "http://localhost/api/credentials?teamId=team-invalid",
    } as any;
    const res = await credentialsGet(req);
    const json = await res.json();

    expect(json.personalScopeFallback).toBe(true);
    expect(json.credentials).toEqual([
      { id: "cred1", userId: "user-1", teamId: null },
    ]);
  });

  it("returns only personal links and sets flag if teamId is invalid", async () => {
    mockSession("user-2", "team-y");
    (prisma.teamMember.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.link.findMany as jest.Mock).mockResolvedValue([
      {
        id: "link1",
        userId: "user-2",
        file: { teamId: null, size: 123, name: "f", contentType: "t" },
      },
    ]);

    const req = { url: "http://localhost/api/links?teamId=team-y" } as any;
    const res = await linksGet(req);
    const json = await res.json();
    expect(json.personalScopeFallback).toBe(true);
    expect(json.links[0].userId).toBe("user-2");
    expect(json.links[0].file.teamId).toBe(null);
  });

  it("returns team credentials and flag false if user is member", async () => {
    mockSession("user-3", "team-z");
    (prisma.teamMember.findFirst as jest.Mock).mockResolvedValue({
      id: "mem1",
      userId: "user-3",
      teamId: "team-z",
    });
    // getAccessibleBucketIds calls findUnique; return an admin-level member
    // so it returns null (unrestricted) and no bucket filtering is applied.
    (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue({
      id: "mem1",
      role: { level: 50 },
      bucketAccess: [],
    });
    (prisma.aWSCredential.findMany as jest.Mock).mockResolvedValue([
      { id: "cred2", teamId: "team-z", buckets: [] },
    ]);

    const req = {
      url: "http://localhost/api/credentials?teamId=team-z",
    } as any;
    const res = await credentialsGet(req);
    const json = await res.json();
    expect(json.personalScopeFallback).toBe(false);
    expect(json.credentials[0].teamId).toBe("team-z");
  });

  it("returns team links and flag false if user is member", async () => {
    mockSession("user-4", "team-a");
    (prisma.teamMember.findFirst as jest.Mock).mockResolvedValue({
      id: "mem2",
      userId: "user-4",
      teamId: "team-a",
    });
    (prisma.link.findMany as jest.Mock).mockResolvedValue([
      {
        id: "link2",
        userId: "user-4",
        file: { teamId: "team-a", size: 123, name: "f", contentType: "t" },
      },
    ]);

    const req = { url: "http://localhost/api/links?teamId=team-a" } as any;
    const res = await linksGet(req);
    const json = await res.json();
    expect(json.personalScopeFallback).toBe(false);
    expect(json.links[0].file.teamId).toBe("team-a");
  });

  it("does not expose passwordHash in links responses", async () => {
    mockSession("user-5", "team-b");
    (prisma.teamMember.findFirst as jest.Mock).mockResolvedValue({
      id: "mem3",
      userId: "user-5",
      teamId: "team-b",
    });
    (prisma.link.findMany as jest.Mock).mockResolvedValue([
      {
        id: "link3",
        hash: "public-hash",
        passwordHash: "super-secret-hash",
        userId: "user-5",
        file: { teamId: "team-b", size: 456, name: "secure-file", contentType: "text/plain" },
      },
    ]);

    const req = { url: "http://localhost/api/links?teamId=team-b" } as any;
    const res = await linksGet(req);
    const json = await res.json();

    expect(json.links[0].passwordHash).toBeUndefined();
    expect(json.links[0].hasPassword).toBe(true);
    expect(json.links[0].hash).toBe("public-hash");
  });
});
