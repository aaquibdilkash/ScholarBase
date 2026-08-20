import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

const GRAVITY = 1.8

const TRENDING_MODELS = [
  { model: 'article', table: 'article' },
  { model: 'socialPost', table: 'social_post' },
  { model: 'helpPost', table: 'help_post' },
  { model: 'contribution', table: 'contribution' },
  { model: 'publication', table: 'publication' },
  { model: 'researchTool', table: 'research_tool' },
  { model: 'researchGrant', table: 'research_grant' },
  { model: 'course', table: 'course' },
  { model: 'journal', table: 'journal' },
  { model: 'result', table: 'result' },
  { model: 'researchSurvey', table: 'research_survey' },
  { model: 'researchEvent', table: 'research_event' },
  { model: 'phdAdmission', table: 'phd_admission' },
  { model: 'jobVacancy', table: 'job_vacancy' },
  { model: 'supervisor', table: 'supervisor' },
]

export async function GET() {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    await prisma.$transaction(async (tx) => {
      for (const { table } of TRENDING_MODELS) {
        await tx.$executeRawUnsafe(`
          UPDATE "${table}"
          SET "trendingScore" = "totalVotes" / POW(EXTRACT(EPOCH FROM NOW() - "createdAt") / 3600.0 + 2.0, ${GRAVITY})
          WHERE "createdAt" >= '${sevenDaysAgo.toISOString()}'
            AND "isDeleted" = false
        `)
      }
    })

    return NextResponse.json({ success: true, message: 'Trending scores updated.' })
  } catch (error) {
    console.error('Error updating trending scores:', error)
    return NextResponse.json({ success: false, error: 'Failed to update trending scores.' }, { status: 500 })
  }
}
