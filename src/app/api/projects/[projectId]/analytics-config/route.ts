import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    console.log('\n=== Analytics Config API Request ===');
    console.log('Project ID:', params.projectId);

    // Skip authentication for analytics-config endpoint
    // Get the project to verify it exists and get its client ID
    const project = await db.project.findUnique({
      where: { id: params.projectId },
      select: { 
        clientId: true,
        deploymentUrl: true,
        id: true 
      }
    });
    
    if (!project) {
      console.log('Project not found:', params.projectId);
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Fetch analytics config
    const config = await db.analyticsConfig.findUnique({
      where: { projectId: params.projectId },
    });

    // If no config exists, return default values
    if (!config) {
      console.log('No analytics config found, returning default values');
      return NextResponse.json({
        gaEnabled: false,
        gaPropertyId: null
      });
    }

    console.log('Found analytics config:', {
      gaEnabled: config.gaEnabled,
      gaPropertyId: config.gaPropertyId ? '[REDACTED]' : null
    });

    // Return analytics config
    return NextResponse.json({
      gaEnabled: config.gaEnabled,
      gaPropertyId: config.gaPropertyId,
      projectId: project.id,
      deploymentUrl: project.deploymentUrl
    });
  } catch (error) {
    console.error('Error fetching analytics config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics config' },
      { status: 500 }
    );
  }
} 