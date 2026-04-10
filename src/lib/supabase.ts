import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for page content
export type HomepageContent = {
  hero: {
    badge: string;
    title: string;
    titleHighlight: string;
    subtitle: string;
  };
  services: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
  cta: {
    title: string;
    titleHighlight: string;
    subtitle: string;
    buttonText: string;
  };
};

export type AboutContent = {
  hero: {
    title: string;
    titleHighlight: string;
    subtitle: string;
  };
  stats: Array<{
    number: string;
    label: string;
  }>;
};

export type SketchupContent = {
  hero: {
    badge: string;
    title: string;
    titleHighlight: string;
    paragraphs: string[];
  };
  benefits: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
  stats: Array<{
    number: string;
    label: string;
  }>;
};

export type ContactContent = {
  title: string;
  titleHighlight: string;
  subtitle: string;
  email: string;
  phone: string;
  location: string;
};

export type PortfolioContent = {
  title: string;
  titleHighlight: string;
  subtitle: string;
  projects: Array<{
    id: number;
    title: string;
    description: string;
    category: string;
    image: string;
  }>;
};

// Fetch content for a page
export async function getPageContent<T>(pageId: string): Promise<T | null> {
  const { data, error } = await supabase
    .from('pages')
    .select('content')
    .eq('id', pageId)
    .single();

  if (error) {
    console.error('Error fetching page content:', error);
    return null;
  }

  return data?.content as T;
}

// Update content for a page
export async function updatePageContent(pageId: string, content: unknown): Promise<boolean> {
  const { error } = await supabase
    .from('pages')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', pageId);

  if (error) {
    console.error('Error updating page content:', error);
    return false;
  }

  return true;
}

// Get all pages content
export async function getAllPagesContent(): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from('pages')
    .select('id, content');

  if (error) {
    console.error('Error fetching all pages:', error);
    return {};
  }

  const pages: Record<string, unknown> = {};
  data?.forEach((page) => {
    pages[page.id] = page.content;
  });

  return pages;
}
