"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function seedRoles() {
    console.log('🌱 Seeding default roles...');
    // Create default roles
    const owner = await prisma.role.upsert({
        where: { name: 'OWNER' },
        update: {},
        create: {
            id: 'role_owner',
            name: 'OWNER',
            description: 'Full access to all features and settings',
            level: 100,
            isSystem: true,
            updatedAt: new Date(),
        },
    });
    const admin = await prisma.role.upsert({
        where: { name: 'ADMIN' },
        update: {},
        create: {
            id: 'role_admin',
            name: 'ADMIN',
            description: 'Can manage team, files, and most settings',
            level: 50,
            isSystem: true,
            updatedAt: new Date(),
        },
    });
    const viewer = await prisma.role.upsert({
        where: { name: 'VIEWER' },
        update: {},
        create: {
            id: 'role_viewer',
            name: 'VIEWER',
            description: 'Read-only access to files and links',
            level: 10,
            isSystem: true,
            updatedAt: new Date(),
        },
    });
    const bucketAdmin = await prisma.role.upsert({
        where: { name: 'BUCKET ADMIN' },
        update: {},
        create: {
            id: 'role_bucket_admin',
            name: 'BUCKET ADMIN',
            description: 'Full file and credential access scoped to assigned buckets only',
            level: 40,
            isSystem: true,
            updatedAt: new Date(),
        },
    });
    console.log('✅ Roles created:', { owner: owner.name, admin: admin.name, viewer: viewer.name, bucketAdmin: bucketAdmin.name });
    // Create OWNER permissions (all screens with EDIT)
    const ownerScreens = [
        'FILES_LIST', 'FILES_UPLOAD', 'FILES_DELETE', 'FILES_SHARE',
        'CREDENTIALS_LIST', 'CREDENTIALS_CREATE', 'CREDENTIALS_EDIT', 'CREDENTIALS_DELETE',
        'TEAM_SETTINGS', 'TEAM_MEMBERS', 'TEAM_INVITATIONS', 'TEAM_DELETE',
        'LINKS_LIST', 'LINKS_CREATE', 'LINKS_DELETE',
        'ADMIN_AUDIT_LOG', 'ADMIN_SETTINGS'
    ];
    for (const screen of ownerScreens) {
        await prisma.rolePermission.upsert({
            where: {
                roleId_screenName: {
                    roleId: owner.id,
                    screenName: screen,
                },
            },
            update: {},
            create: {
                id: `rp_owner_${screen.toLowerCase()}`,
                roleId: owner.id,
                screenName: screen,
                permissionLevel: 'EDIT',
            },
        });
    }
    console.log(`✅ Created ${ownerScreens.length} OWNER permissions`);
    // Create ADMIN permissions
    const adminPerms = [
        { screen: 'FILES_LIST', level: 'EDIT' },
        { screen: 'FILES_UPLOAD', level: 'EDIT' },
        { screen: 'FILES_DELETE', level: 'EDIT' },
        { screen: 'FILES_SHARE', level: 'EDIT' },
        { screen: 'CREDENTIALS_LIST', level: 'EDIT' },
        { screen: 'CREDENTIALS_CREATE', level: 'EDIT' },
        { screen: 'CREDENTIALS_EDIT', level: 'EDIT' },
        { screen: 'CREDENTIALS_DELETE', level: 'EDIT' },
        { screen: 'TEAM_SETTINGS', level: 'VIEW' },
        { screen: 'TEAM_MEMBERS', level: 'EDIT' },
        { screen: 'TEAM_INVITATIONS', level: 'EDIT' },
        { screen: 'LINKS_LIST', level: 'EDIT' },
        { screen: 'LINKS_CREATE', level: 'EDIT' },
        { screen: 'LINKS_DELETE', level: 'EDIT' },
        { screen: 'ADMIN_AUDIT_LOG', level: 'VIEW' },
    ];
    for (const perm of adminPerms) {
        await prisma.rolePermission.upsert({
            where: {
                roleId_screenName: {
                    roleId: admin.id,
                    screenName: perm.screen,
                },
            },
            update: {},
            create: {
                id: `rp_admin_${perm.screen.toLowerCase()}`,
                roleId: admin.id,
                screenName: perm.screen,
                permissionLevel: perm.level,
            },
        });
    }
    console.log(`✅ Created ${adminPerms.length} ADMIN permissions`);
    // Create VIEWER permissions
    const viewerScreens = ['FILES_LIST', 'LINKS_LIST'];
    for (const screen of viewerScreens) {
        await prisma.rolePermission.upsert({
            where: {
                roleId_screenName: {
                    roleId: viewer.id,
                    screenName: screen,
                },
            },
            update: {},
            create: {
                id: `rp_viewer_${screen.toLowerCase()}`,
                roleId: viewer.id,
                screenName: screen,
                permissionLevel: 'VIEW',
            },
        });
    }
    console.log(`✅ Created ${viewerScreens.length} VIEWER permissions`);
    // Create BUCKET ADMIN permissions — same as ADMIN but scoped to assigned buckets (level 40 < 50)
    const bucketAdminPerms = [
        { screen: 'FILES_LIST', level: 'EDIT' },
        { screen: 'FILES_UPLOAD', level: 'EDIT' },
        { screen: 'FILES_DELETE', level: 'EDIT' },
        { screen: 'FILES_SHARE', level: 'EDIT' },
        { screen: 'CREDENTIALS_LIST', level: 'VIEW' },
        { screen: 'LINKS_LIST', level: 'EDIT' },
        { screen: 'LINKS_CREATE', level: 'EDIT' },
        { screen: 'LINKS_DELETE', level: 'EDIT' },
        { screen: 'TEAM_MEMBERS', level: 'VIEW' },
    ];
    for (const perm of bucketAdminPerms) {
        await prisma.rolePermission.upsert({
            where: {
                roleId_screenName: {
                    roleId: bucketAdmin.id,
                    screenName: perm.screen,
                },
            },
            update: {},
            create: {
                id: `rp_bucket_admin_${perm.screen.toLowerCase()}`,
                roleId: bucketAdmin.id,
                screenName: perm.screen,
                permissionLevel: perm.level,
            },
        });
    }
    console.log(`✅ Created ${bucketAdminPerms.length} BUCKET ADMIN permissions`);
    console.log('🎉 Seeding completed successfully!');
}
async function seedBucketAccessForExistingMembers() {
    console.log('Seeding bucket access for existing members...');
    const members = await prisma.teamMember.findMany({
        include: {
            role: true,
            team: {
                include: {
                    credentials: {
                        include: { buckets: true },
                    },
                },
            },
        },
    });
    for (const member of members) {
        // Skip admins/owners — they're unrestricted by design (no rows needed)
        if (member.role.level >= 50) {
            console.log(`  Skipping admin/owner member ${member.id} (unrestricted)`);
            continue;
        }
        const allBuckets = member.team.credentials.flatMap((c) => c.buckets);
        if (allBuckets.length === 0)
            continue;
        await prisma.teamMemberBucketAccess.createMany({
            data: allBuckets.map((b) => ({
                teamMemberId: member.id,
                bucketId: b.id,
            })),
            skipDuplicates: true,
        });
        console.log(`  Granted ${allBuckets.length} bucket(s) to member ${member.id} in team ${member.teamId}`);
    }
    console.log('Done seeding bucket access.');
}
async function main() {
    await seedRoles();
    await seedBucketAccessForExistingMembers();
}
main()
    .catch((error) => {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
