import fs from 'fs'
import path from 'path'

describe('website landing page', () => {
  it('matches the standalone marketing landing content without auth CTAs', () => {
    const filePath = path.join(process.cwd(), 'website', 'index.html')
    const html = fs.readFileSync(filePath, 'utf8')

    expect(html).toContain('Open source self-hosted S3 portal')
    expect(html).toContain('Manage files in S3 with a flow your team can actually use.')
    expect(html).toContain('What S3 Portal does')
    expect(html).toContain('You bring your own AWS credentials')
    expect(html).toContain('Direct S3 Integration')
    expect(html).toContain('Zero-Trust Security')
    expect(html).toContain('Parallel Uploads')
    expect(html).toContain('Self-hosting steps')
    expect(html).not.toContain('Sign in')
    expect(html).not.toContain('Your S3 Storage, Finally Under Control')
  })
})