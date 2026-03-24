import fs from 'fs'
import path from 'path'

describe('website landing page', () => {
  it('redirects root to self-hosting documentation', () => {
    const filePath = path.join(process.cwd(), 'website', 'index.html')
    const html = fs.readFileSync(filePath, 'utf8')

    expect(html).toContain('http-equiv="refresh" content="0; url=documentation/self-hosting.html"')
    expect(html).toContain("window.location.replace('documentation/self-hosting.html')")
    expect(html).toContain('<a href="documentation/self-hosting.html">Self Hosting</a>')
  })

  it('redirects documentation index to self-hosting documentation', () => {
    const filePath = path.join(process.cwd(), 'website', 'documentation', 'index.html')
    const html = fs.readFileSync(filePath, 'utf8')

    expect(html).toContain('http-equiv="refresh" content="0; url=self-hosting.html"')
    expect(html).toContain("window.location.replace('self-hosting.html')")
    expect(html).toContain('<a href="self-hosting.html">Self Hosting</a>')
  })
})