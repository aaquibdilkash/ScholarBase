import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

const GRAVITY = 1.8

const TRENDING_MODELS = [
  { model: 'article', table: 'Article' },
  { model: 'socialPost', table: 'SocialPost' },
  { model: 'helpPost', table: 'HelpPost' },
  { model: 'contribution', table: 'Contribution' },
  { model: 'publication', table: 'Publication' },
  { model: 'researchTool', table: 'ResearchTool' },
  { model: 'researchGrant', table: 'ResearchGrant' },
  { model: 'course', table: 'Course' },
  { model: 'journal', table: 'Journal' },
  { model: 'result', table: 'Result' },
  { model: 'researchSurvey', table: 'ResearchSurvey' },
  { model: 'researchEvent', table: 'ResearchEvent' },
  { model: 'phdAdmission', table: 'PhdAdmission' },
  { model: 'jobVacancy', table: 'JobVacancy' },
  { model: 'recommendation', table: 'Recommendation' }, // 🔥 Added back to standard models
]

export async function GET() {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    await prisma.$transaction(async (tx) => {
      // 1. Standard Content (Votes + Comments)
      for (const { table } of TRENDING_MODELS) {
        await tx.$executeRawUnsafe(`
          UPDATE "${table}"
          SET "trendingScore" = (
            "totalVotes" + ("totalComments" * 1.5)
          ) / POW(EXTRACT(EPOCH FROM NOW() - "createdAt") / 3600.0 + 2.0, ${GRAVITY})
          WHERE "createdAt" >= '${sevenDaysAgo.toISOString()}'
            AND "isDeleted" = false
        `)
      }

      // 2. Scholar Trending (Reputation & Recency)
      await tx.$executeRawUnsafe(`
        UPDATE "User"
        SET "trendingScore" = "reputation" / POW(EXTRACT(EPOCH FROM NOW() - "updatedAt") / 3600.0 + 2.0, ${GRAVITY})
        WHERE "isDeleted" = false
      `)

      // 3. Supervisor Trending (Composite Score)
      await tx.$executeRawUnsafe(`
        UPDATE "Supervisor"
        SET "trendingScore" = (
          "totalVotes" + 
          ("totalComments" * 2) + 
          ("averageRating" * "recommendationCount" * 5)
        ) / POW(EXTRACT(EPOCH FROM NOW() - "createdAt") / 3600.0 + 2.0, ${GRAVITY})
        WHERE "isDeleted" = false
      `)
    })

    return NextResponse.json({ success: true, message: 'Trending scores updated.' })
  } catch (error) {
    console.error('Error updating trending scores:', error)
    return NextResponse.json({ success: false, error: 'Failed to update trending scores.' }, { status: 500 })
  }
}