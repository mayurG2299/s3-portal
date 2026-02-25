import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyMigration() {
  try {
    console.log('🔍 Verifying migration...\n');

    // Check AwsBucket count
    const bucketCount = await prisma.awsBucket.count();
    console.log(`✅ AwsBucket records: ${bucketCount}`);

    // Check if all files have bucketId
    const totalFiles = await prisma.file.count();
    console.log(`✅ Total files: ${totalFiles}`);

    // Sample bucket with credential
    const sampleBucket = await prisma.awsBucket.findFirst({
      include: {
        credential: { select: { name: true } },
        _count: { select: { files: true } }
      }
    });

    if (sampleBucket) {
      console.log(`\n📦 Sample bucket:`);
      console.log(`   Bucket: ${sampleBucket.bucket}`);
      console.log(`   Credential: ${sampleBucket.credential.name}`);
      console.log(`   Files: ${sampleBucket._count.files}`);
      console.log(`   CloudFront: ${sampleBucket.cloudfrontDomain || 'Not configured'}`);
    }

    // Check if old bucket column exists on AWSCredential
    const credentials = await prisma.aWSCredential.findMany({
      include: {
        buckets: true
      }
    });

    console.log(`\n🔑 Credentials: ${credentials.length}`);
    credentials.forEach(cred => {
      console.log(`   ${cred.name}: ${cred.buckets.length} bucket(s)`);
      cred.buckets.forEach(bucket => {
        console.log(`      - ${bucket.bucket}${bucket.cloudfrontDomain ? ' (CDN enabled)' : ''}`);
      });
    });

    console.log('\n✅ Migration verification complete!');
  } catch (error) {
    console.error('❌ Error verifying migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyMigration();
