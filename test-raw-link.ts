import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testRawLink() {
  console.log('Finding a file to share...');
  const file = await prisma.file.findFirst({
    include: { credential: { include: { buckets: true } } }
  });
  
  if (!file) {
    console.error('No files found in DB');
    return;
  }
  
  console.log(`Found file: ${file.name} (bucketId: ${file.bucketId})`);
  
  const hash = 'test-raw-hash-' + Date.now();
  
  console.log('Creating permanent raw link in DB...');
  const link = await prisma.link.create({
    data: {
      hash,
      type: 'PUBLIC',
      fileId: file.id,
      userId: file.userId,
      allowDownload: true,
      allowPreview: true,
      expiresAt: null, // Permanent
    }
  });
  
  console.log(`Created link with hash: ${hash}`);
  const url = `http://localhost:3000/api/raw/${hash}`;
  console.log(`Testing redirect URL: ${url}`);
  
  try {
    const response = await fetch(url, { redirect: 'manual' });
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (response.status === 302) {
      console.log('✅ SUCCESS! Received 302 Redirect');
      console.log('Redirect Location:', response.headers.get('location'));
      
      const awsUrl = response.headers.get('location');
      if (awsUrl && (awsUrl.includes('amazonaws.com') || awsUrl.includes('cloudfront.net'))) {
        console.log('✅ URL correctly points to AWS/CloudFront');
      } else {
        console.error('❌ URL does not look like AWS/CloudFront');
      }
    } else {
      console.error('❌ Expected 302 redirect, got something else');
      const text = await response.text();
      console.error('Response:', text);
    }
  } catch (err) {
    console.error('Request failed:', err);
  } finally {
    console.log('Cleaning up test link...');
    await prisma.link.delete({ where: { id: link.id } });
    await prisma.$disconnect();
  }
}

testRawLink().catch(console.error);
