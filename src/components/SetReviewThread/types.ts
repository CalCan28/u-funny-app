// Set Review Thread Types

export type ToneTag = 'SUPPORTIVE' | 'DIRECT' | 'TECHNICAL';
export type IntentTag = 'FUNNIER' | 'CLEANER' | 'CONFIDENT' | 'TIGHTER';

export type RatingCategory =
  | 'joke_craft'
  | 'timing_pacing'
  | 'stage_presence'
  | 'originality'
  | 'crowd_connection';

export const RATING_CATEGORIES: { key: RatingCategory; label: string }[] = [
  { key: 'joke_craft', label: 'Joke Craft' },
  { key: 'timing_pacing', label: 'Timing & Pacing' },
  { key: 'stage_presence', label: 'Stage Presence' },
  { key: 'originality', label: 'Originality' },
  { key: 'crowd_connection', label: 'Crowd Connection' },
];

export const TONE_TAGS: { value: ToneTag; label: string; emoji: string }[] = [
  { value: 'SUPPORTIVE', label: 'Supportive', emoji: '💚' },
  { value: 'DIRECT', label: 'Direct', emoji: '🎯' },
  { value: 'TECHNICAL', label: 'Technical', emoji: '🔧' },
];

export const INTENT_TAGS: { value: IntentTag; label: string; emoji: string }[] = [
  { value: 'FUNNIER', label: 'Funnier', emoji: '😂' },
  { value: 'CLEANER', label: 'Cleaner', emoji: '✨' },
  { value: 'CONFIDENT', label: 'Confident', emoji: '💪' },
  { value: 'TIGHTER', label: 'Tighter', emoji: '🎯' },
];

export const RATING_DESCRIPTIONS: Record<number, string> = {
  1: 'Needs work',
  2: 'Getting there',
  3: 'Solid',
  4: 'Great',
  5: 'Pro-level',
};

export interface Feedback {
  id: string;
  clip_id: string;
  author_id: string;
  what_worked: string;
  what_to_improve: string;
  next_rep: string;
  punch_up_idea: string | null;
  tone_tag: ToneTag;
  intent_tag: IntentTag;
  rating_joke_craft: number;
  rating_timing_pacing: number;
  rating_stage_presence: number;
  rating_originality: number;
  rating_crowd_connection: number;
  overall_score: number;
  helpful_count: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  author?: {
    id: string;
    display_name: string | null;
    stage_name: string | null;
    avatar_url: string | null;
  };
  has_voted_helpful?: boolean;
}

export interface FeedbackSummary {
  total_reviews: number;
  avg_overall: number;
  avg_joke_craft: number;
  avg_timing_pacing: number;
  avg_stage_presence: number;
  avg_originality: number;
  avg_crowd_connection: number;
}

export interface FeedbackFormData {
  what_worked: string;
  what_to_improve: string;
  next_rep: string;
  punch_up_idea: string;
  tone_tag: ToneTag;
  intent_tag: IntentTag;
  rating_joke_craft: number;
  rating_timing_pacing: number;
  rating_stage_presence: number;
  rating_originality: number;
  rating_crowd_connection: number;
}

export type SortMode = 'helpful' | 'newest' | 'highestRated';

// Tips & Critiques types
export type TipsCritiquesTab = 'received' | 'given';

// Re-export from service for convenience
export type { FeedbackWithClip, TipsCritiquesSummary, StyleProfile, ComedyTypeKey } from './feedbackService';
