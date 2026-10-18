import { NextRequest, NextResponse } from 'next/server';

// Type definitions for incoming job data from the Oscar Kitchen tracker
interface JobImport {
  job: {
    name: string;
    client: string;
    startDate: string;
    endDate: string;
    status: 'scheduled' | 'in_progress' | 'completed';
  };
  units: Array<{
    section: string;
    id: string;
    name: string;
    w: number | null;
    h: number | null;
    d: number | null;
    qty: number;
    notes: string;
    checked: boolean;
    addedAt?: string;
    completedAt?: string;
  }>;
  clientSupplies: Array<{
    id: string;
    name: string;
    notes: string;
    checked: boolean;
  }>;
  tasks: Array<{
    id: string;
    name: string;
    due: string;
    notes: string;
    checked: boolean;
  }>;
  diary: Array<{
    id: string;
    date: string;
    text: string;
  }>;
  exportedAt: string;
}

// Simple API key auth - uses JOBKIT_API_KEY from environment
const API_KEY = process.env.JOBKIT_API_KEY;

export async function POST(request: NextRequest) {
  try {
    // Check API key
    const authHeader = request.headers.get('authorization');
    if (!API_KEY) {
      console.error('JOBKIT_API_KEY not configured');
      return NextResponse.json({ error: 'API not configured' }, { status: 503 });
    }
    if (!authHeader || authHeader !== `Bearer ${API_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data: JobImport = await request.json();

    // Validate required fields
    if (!data.job?.name || !data.job?.client) {
      return NextResponse.json({ error: 'Missing job name or client' }, { status: 400 });
    }

    // Log the import (for now - can add database storage later)
    console.log('Job import received:', {
      name: data.job.name,
      client: data.job.client,
      status: data.job.status,
      unitsCount: data.units.length,
      completedUnits: data.units.filter(u => u.checked).length,
      exportedAt: data.exportedAt
    });

    // Return success with stats
    return NextResponse.json({
      success: true,
      message: `Imported ${data.job.name}`,
      stats: {
        units: data.units.length,
        supplies: data.clientSupplies.length,
        tasks: data.tasks.length,
        diary: data.diary.length,
        completedUnits: data.units.filter(u => u.checked).length
      }
    });

  } catch (error) {
    console.error('Job import error:', error);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
