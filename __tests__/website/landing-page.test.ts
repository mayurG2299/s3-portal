import fs from 'fs'
import path from 'path'

describe('website landing page', () => {
  it('redirects root to self-hosting documentation using clean URLs', () => {
    const filePath = path.join(process.cwd(), 'website', 'index.html')
    const html = fs.readFileSync(filePath, 'utf8')

    expect(html).toContain('http-equiv="refresh" content="0; url=/documentation/self-hosting"')
    expect(html).toContain("window.location.replace('/documentation/self-hosting')")
    expect(html).toContain('<a href="/documentation/self-hosting">Self Hosting</a>')
  })

  it('redirects documentation index to self-hosting documentation using clean URLs', () => {
    const filePath = path.join(process.cwd(), 'website', 'documentation', 'index.html')
    const html = fs.readFileSync(filePath, 'utf8')

    expect(html).toContain('http-equiv="refresh" content="0; url=/documentation/self-hosting"')
    expect(html).toContain("window.location.replace('/documentation/self-hosting')")
    expect(html).toContain('<a href="/documentation/self-hosting">Self Hosting</a>')
  })

  it('does not define documentation html rewrite rules that conflict with Pages clean URLs', () => {
    const filePath = path.join(process.cwd(), 'website', '_redirects')
    const redirects = fs.readFileSync(filePath, 'utf8')

    expect(redirects).not.toContain('/documentation/self-hosting')
    expect(redirects).not.toContain('/documentation/aws-setup')
    expect(redirects).not.toContain('/documentation               /documentation/index.html')
  })
})