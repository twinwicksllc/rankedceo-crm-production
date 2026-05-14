import { NextRequest, NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import { createWaasClient } from '@/lib/waas/supabase'
import { createClient } from '@/lib/supabase/server'
import type { AuditReportData, WaasAudit } from '@/lib/waas/types'

interface RequestContext {
  params: { auditId: string }
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

function calculateScore(summary: any): number {
  if (!summary) return 0
  return Math.round(
    (summary.performance_score * 0.40) +
    (summary.seo_score * 0.30) +
    (summary.mobile_score * 0.20) +
    (summary.accessibility_score * 0.10)
  )
}

function getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

async function streamToBuffer(stream: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on('data', (chunk: Buffer) => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

export async function GET(_req: NextRequest, context: RequestContext) {
  try {
    const auditId = context.params.auditId

    // Check authentication
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch audit
    const waasClient = createWaasClient()
    const { data: audit, error } = await waasClient
      .from('audits')
      .select('*')
      .eq('id', auditId)
      .single() as { data: WaasAudit | null; error: any }

    if (error || !audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    // Verify ownership
    if (audit.tenant_id && user.email) {
      const { data: tenant } = await waasClient
        .from('tenants')
        .select('id')
        .eq('id', audit.tenant_id)
        .eq('submitted_by_email', user.email)
        .single()

      if (!tenant) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    }

    const report = (audit as any).report_data as AuditReportData | null
    if (!report) {
      return NextResponse.json({ error: 'No report data' }, { status: 400 })
    }

    // Create PDF
    const doc = new PDFDocument({ size: 'letter', margin: 40 })
    const targetDomain = extractDomain(audit.target_url)
    const score = calculateScore(report.summary)
    const grade = getGrade(score)
    const summary = report.summary

    // Title
    doc.fontSize(32).font('Helvetica-Bold').text('SEO Audit Report', { align: 'center' })
    doc.moveDown(0.5)
    doc.fontSize(16).text(targetDomain, { align: 'center' })
    doc.moveDown(2)

    // Metadata
    const completedDate = audit.completed_at ? new Date(audit.completed_at).toLocaleDateString() : 'N/A'
    doc.fontSize(10).text(`Report Generated: ${completedDate}`, { align: 'center' })
    doc.fontSize(10).text(`Report ID: ${audit.id.toUpperCase().slice(0, 8)}`, { align: 'center' })
    doc.moveDown(2)

    // Overall Score
    doc.fontSize(14).font('Helvetica-Bold').text('Overall Score')
    doc.moveDown(0.3)
    doc.fontSize(12).font('Helvetica').text(`Grade: ${grade}`)
    doc.fontSize(12).text(`Score: ${score}/100`)
    doc.moveDown(1)

    // Score Breakdown
    if (summary) {
      doc.fontSize(12).font('Helvetica-Bold').text('Score Breakdown')
      doc.moveDown(0.3)
      doc.fontSize(11).font('Helvetica')
      doc.text(`• Performance: ${Math.round(summary.performance_score)}/100`)
      doc.text(`• SEO: ${Math.round(summary.seo_score)}/100`)
      doc.text(`• Mobile: ${Math.round(summary.mobile_score)}/100`)
      doc.text(`• Accessibility: ${Math.round(summary.accessibility_score)}/100`)
      doc.moveDown(1)
    }

    // Keywords
    const keywords = (report as any).keywords_used ?? []
    if (keywords.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Keywords Evaluated')
      doc.moveDown(0.3)
      doc.fontSize(10).font('Helvetica')
      doc.text(keywords.slice(0, 5).join(', '), { width: 500 })
      doc.moveDown(1)
    }

    // Keyword Performance
    if (summary && (summary.top_search_result || summary.bottom_search_result)) {
      doc.fontSize(12).font('Helvetica-Bold').text('Keyword Performance')
      doc.moveDown(0.3)
      doc.fontSize(10).font('Helvetica')
      if (summary.top_search_result) {
        doc.text(`Best: "${summary.top_search_result.keyword}" @ position ${summary.top_search_result.position ?? 'N/A'}`)
      }
      if (summary.bottom_search_result) {
        doc.text(`Lowest: "${summary.bottom_search_result.keyword}" @ position ${summary.bottom_search_result.position ?? 'N/A'}`)
      }
      if (summary.mean_position) {
        doc.text(`Average Position: ${Math.round(summary.mean_position)}`)
      }
      doc.moveDown(1)
    }

    // Page Speed
    if ((report as any).page_speed) {
      const ps = (report as any).page_speed
      doc.fontSize(12).font('Helvetica-Bold').text('Page Speed')
      doc.moveDown(0.3)
      doc.fontSize(10).font('Helvetica')
      if (ps.mobile) {
        doc.text(`Mobile LCP: ${ps.mobile.lcp}ms | FID: ${ps.mobile.fid}ms | CLS: ${ps.mobile.cls}`)
      }
      if (ps.desktop) {
        doc.text(`Desktop LCP: ${ps.desktop.lcp}ms | FID: ${ps.desktop.fid}ms | CLS: ${ps.desktop.cls}`)
      }
      doc.moveDown(1)
    }

    // Leaderboard
    if ((report as any).leaderboard?.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Top Rankings')
      doc.moveDown(0.3)
      doc.fontSize(9).font('Helvetica')
      ;(report as any).leaderboard.slice(0, 5).forEach((e: any, i: number) => {
        const label = e.isTarget ? 'Your Site' : `#${i + 1}`
        doc.text(`${label}: ${e.domain} - Position: ${e.bestPosition ?? 'N/A'}`)
      })
    }

    // Footer
    doc.moveDown(1)
    doc.fontSize(8).text(
      `© ${new Date().getFullYear()} RankedCEO · Surface Audit Engine v2 · rankedceo.com`,
      { align: 'center' }
    )

    // Convert to buffer
    const buffer = await streamToBuffer(doc)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="audit-${targetDomain}-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    })
  } catch (err) {
    console.error('PDF error:', err)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
