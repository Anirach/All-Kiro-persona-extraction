import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkDatabase() {
  try {
    const projectCount = await prisma.project.count()
    const sourceCount = await prisma.source.count()
    const evidenceCount = await prisma.evidenceUnit.count()
    const personaCount = await prisma.persona.count()
    const claimCount = await prisma.claim.count()
    
    console.log('✅ Database verification successful!')
    console.log(`📊 Data summary:`)
    console.log(`  Projects: ${projectCount}`)
    console.log(`  Sources: ${sourceCount}`)
    console.log(`  Evidence Units: ${evidenceCount}`)
    console.log(`  Personas: ${personaCount}`)
    console.log(`  Claims: ${claimCount}`)
    
    // Test a complex query with relations
    const projectsWithSources = await prisma.project.findMany({
      include: {
        sources: {
          include: {
            evidenceUnits: true
          }
        },
        personas: {
          include: {
            claims: true
          }
        }
      }
    })
    
    console.log(`🔗 Relationship test: Found ${projectsWithSources.length} projects with related data`)
    
  } catch (error) {
    console.error('❌ Database verification failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkDatabase()
