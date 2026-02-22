import { supabase } from '../../services/supabase';
import { Feedback, FeedbackFormData, FeedbackSummary, SortMode, ToneTag, IntentTag } from './types';

// Comedy Style Types and Weights
export const COMEDY_TYPES = [
  { key: 'storyteller', label: 'Storyteller', description: 'Long-form story energy' },
  { key: 'oneLinerSniper', label: 'One-Liner Sniper', description: 'Punchline-first quick hits' },
  { key: 'crowdController', label: 'Crowd Controller', description: 'Presence + crowd connection' },
  { key: 'wordWizard', label: 'Word Wizard', description: 'Original writing + clever turns' },
  { key: 'vibeTechnician', label: 'Vibe Technician', description: 'Timing + delivery polish' },
] as const;

export type ComedyTypeKey = typeof COMEDY_TYPES[number]['key'];

// Weights for each comedy type
const COMEDY_TYPE_WEIGHTS: Record<ComedyTypeKey, Record<string, number>> = {
  storyteller: {
    crowd_connection: 0.35,
    joke_craft: 0.30,
    timing_pacing: 0.20,
    stage_presence: 0.10,
    originality: 0.05,
  },
  oneLinerSniper: {
    joke_craft: 0.45,
    timing_pacing: 0.30,
    originality: 0.15,
    stage_presence: 0.05,
    crowd_connection: 0.05,
  },
  crowdController: {
    stage_presence: 0.40,
    crowd_connection: 0.35,
    timing_pacing: 0.15,
    joke_craft: 0.05,
    originality: 0.05,
  },
  wordWizard: {
    originality: 0.45,
    joke_craft: 0.35,
    timing_pacing: 0.10,
    crowd_connection: 0.05,
    stage_presence: 0.05,
  },
  vibeTechnician: {
    timing_pacing: 0.45,
    stage_presence: 0.25,
    crowd_connection: 0.15,
    joke_craft: 0.10,
    originality: 0.05,
  },
};

// Validation helpers
const hasExcessiveCaps = (text: string): boolean => {
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 10) return false;
  const caps = letters.replace(/[^A-Z]/g, '').length;
  return caps / letters.length > 0.7;
};

const hasRepeatedChars = (text: string): boolean => {
  return /(.)\1{4,}/.test(text);
};

export const validateFeedback = (data: FeedbackFormData): string | null => {
  const requiredFields = [data.what_worked, data.what_to_improve, data.next_rep];
  const combinedLength = requiredFields.join('').length;

  if (combinedLength < 15) {
    return 'Please provide more detailed feedback (at least 15 characters total)';
  }

  for (const field of requiredFields) {
    if (hasExcessiveCaps(field)) {
      return 'Please avoid excessive capitalization';
    }
    if (hasRepeatedChars(field)) {
      return 'Please avoid repeated characters';
    }
  }

  const ratings = [
    data.rating_joke_craft,
    data.rating_timing_pacing,
    data.rating_stage_presence,
    data.rating_originality,
    data.rating_crowd_connection,
  ];

  for (const rating of ratings) {
    if (!rating || rating < 1 || rating > 5) {
      return 'All rating categories are required (1-5 stars)';
    }
  }

  if (!data.tone_tag) {
    return 'Please select a tone for your feedback';
  }

  if (!data.intent_tag) {
    return 'Please select your coaching intent';
  }

  return null;
};

// Fetch feedback for a clip
export const getFeedback = async (
  clipId: string,
  sort: SortMode = 'helpful',
  cursor?: string,
  limit: number = 20
): Promise<{ data: Feedback[]; nextCursor: string | null }> => {
  const { data: currentUser } = await supabase.auth.getUser();
  const userId = currentUser?.user?.id;

  let query = supabase
    .from('clip_feedback')
    .select('*')
    .eq('clip_id', clipId);

  // Apply sorting
  switch (sort) {
    case 'helpful':
      query = query.order('helpful_count', { ascending: false }).order('created_at', { ascending: false });
      break;
    case 'newest':
      query = query.order('created_at', { ascending: false });
      break;
    case 'highestRated':
      query = query.order('overall_score', { ascending: false });
      break;
  }

  // Cursor pagination
  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  query = query.limit(limit);

  const { data, error } = await query;

  if (error) throw error;

  if (!data || data.length === 0) {
    return { data: [], nextCursor: null };
  }

  // Fetch author profiles
  const authorIds = [...new Set(data.map(f => f.author_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, stage_name, avatar_url')
    .in('id', authorIds);

  const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

  // Check if user has voted helpful on each feedback
  let feedbackWithProfiles = data.map(f => ({
    ...f,
    author: profileMap.get(f.author_id) || null,
  }));

  if (userId && feedbackWithProfiles.length > 0) {
    const feedbackIds = feedbackWithProfiles.map(f => f.id);
    const { data: votes } = await supabase
      .from('feedback_helpful_votes')
      .select('feedback_id')
      .eq('user_id', userId)
      .in('feedback_id', feedbackIds);

    const votedIds = new Set(votes?.map(v => v.feedback_id) || []);
    feedbackWithProfiles = feedbackWithProfiles.map(f => ({
      ...f,
      has_voted_helpful: votedIds.has(f.id),
    }));
  }

  const nextCursor = data.length === limit ? data[data.length - 1].created_at : null;

  return { data: feedbackWithProfiles, nextCursor };
};

// Get feedback summary for a clip
export const getFeedbackSummary = async (clipId: string): Promise<FeedbackSummary> => {
  const { data, error } = await supabase
    .from('clip_feedback')
    .select(`
      rating_joke_craft,
      rating_timing_pacing,
      rating_stage_presence,
      rating_originality,
      rating_crowd_connection,
      overall_score
    `)
    .eq('clip_id', clipId);

  if (error) throw error;

  if (!data || data.length === 0) {
    return {
      total_reviews: 0,
      avg_overall: 0,
      avg_joke_craft: 0,
      avg_timing_pacing: 0,
      avg_stage_presence: 0,
      avg_originality: 0,
      avg_crowd_connection: 0,
    };
  }

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const avg = (arr: number[]) => sum(arr) / arr.length;

  return {
    total_reviews: data.length,
    avg_overall: avg(data.map(d => Number(d.overall_score))),
    avg_joke_craft: avg(data.map(d => d.rating_joke_craft)),
    avg_timing_pacing: avg(data.map(d => d.rating_timing_pacing)),
    avg_stage_presence: avg(data.map(d => d.rating_stage_presence)),
    avg_originality: avg(data.map(d => d.rating_originality)),
    avg_crowd_connection: avg(data.map(d => d.rating_crowd_connection)),
  };
};

// Get user's existing feedback for a clip
export const getMyFeedback = async (clipId: string): Promise<Feedback | null> => {
  const { data: currentUser } = await supabase.auth.getUser();
  if (!currentUser?.user) return null;

  const { data, error } = await supabase
    .from('clip_feedback')
    .select('*')
    .eq('clip_id', clipId)
    .eq('author_id', currentUser.user.id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

// Create or update feedback (upsert)
export const upsertFeedback = async (
  clipId: string,
  formData: FeedbackFormData
): Promise<Feedback> => {
  const { data: currentUser } = await supabase.auth.getUser();
  if (!currentUser?.user) throw new Error('Authentication required');

  const validationError = validateFeedback(formData);
  if (validationError) throw new Error(validationError);

  const feedbackData = {
    clip_id: clipId,
    author_id: currentUser.user.id,
    what_worked: formData.what_worked.trim(),
    what_to_improve: formData.what_to_improve.trim(),
    next_rep: formData.next_rep.trim(),
    punch_up_idea: formData.punch_up_idea.trim() || null,
    tone_tag: formData.tone_tag,
    intent_tag: formData.intent_tag,
    rating_joke_craft: formData.rating_joke_craft,
    rating_timing_pacing: formData.rating_timing_pacing,
    rating_stage_presence: formData.rating_stage_presence,
    rating_originality: formData.rating_originality,
    rating_crowd_connection: formData.rating_crowd_connection,
  };

  const { data, error } = await supabase
    .from('clip_feedback')
    .upsert(feedbackData, {
      onConflict: 'clip_id,author_id',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Delete feedback
export const deleteFeedback = async (feedbackId: string): Promise<void> => {
  const { error } = await supabase
    .from('clip_feedback')
    .delete()
    .eq('id', feedbackId);

  if (error) throw error;
};

// Toggle helpful vote
export const toggleHelpfulVote = async (feedbackId: string): Promise<boolean> => {
  const { data: currentUser } = await supabase.auth.getUser();
  if (!currentUser?.user) throw new Error('Authentication required');

  // Check if already voted
  const { data: existingVote } = await supabase
    .from('feedback_helpful_votes')
    .select('id')
    .eq('feedback_id', feedbackId)
    .eq('user_id', currentUser.user.id)
    .single();

  if (existingVote) {
    // Remove vote
    const { error } = await supabase
      .from('feedback_helpful_votes')
      .delete()
      .eq('id', existingVote.id);

    if (error) throw error;
    return false; // No longer voted
  } else {
    // Add vote
    const { error } = await supabase
      .from('feedback_helpful_votes')
      .insert({
        feedback_id: feedbackId,
        user_id: currentUser.user.id,
      });

    if (error) throw error;
    return true; // Now voted
  }
};

// Get aggregated profile stats for a user (for Comedy Style Profile)
export const getUserFeedbackStats = async (userId: string): Promise<{
  totalReviews: number;
  avgOverall: number;
  categoryAverages: Record<string, number>;
  recentFeedback: Feedback[];
}> => {
  // Get all clips by this user
  const { data: userClips } = await supabase
    .from('community_videos')
    .select('id')
    .eq('user_id', userId);

  if (!userClips || userClips.length === 0) {
    return {
      totalReviews: 0,
      avgOverall: 0,
      categoryAverages: {
        joke_craft: 0,
        timing_pacing: 0,
        stage_presence: 0,
        originality: 0,
        crowd_connection: 0,
      },
      recentFeedback: [],
    };
  }

  const clipIds = userClips.map(c => c.id);

  // Get all feedback for user's clips
  const { data: feedback, error } = await supabase
    .from('clip_feedback')
    .select('*')
    .in('clip_id', clipIds)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Fetch author profiles if we have feedback
  let feedbackWithProfiles = feedback || [];
  if (feedback && feedback.length > 0) {
    const authorIds = [...new Set(feedback.map(f => f.author_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, stage_name, avatar_url')
      .in('id', authorIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    feedbackWithProfiles = feedback.map(f => ({
      ...f,
      author: profileMap.get(f.author_id) || null,
    }));
  }

  if (feedbackWithProfiles.length === 0) {
    return {
      totalReviews: 0,
      avgOverall: 0,
      categoryAverages: {
        joke_craft: 0,
        timing_pacing: 0,
        stage_presence: 0,
        originality: 0,
        crowd_connection: 0,
      },
      recentFeedback: [],
    };
  }

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const avg = (arr: number[]) => arr.length ? sum(arr) / arr.length : 0;

  return {
    totalReviews: feedbackWithProfiles.length,
    avgOverall: avg(feedbackWithProfiles.map(f => Number(f.overall_score))),
    categoryAverages: {
      joke_craft: avg(feedbackWithProfiles.map(f => f.rating_joke_craft)),
      timing_pacing: avg(feedbackWithProfiles.map(f => f.rating_timing_pacing)),
      stage_presence: avg(feedbackWithProfiles.map(f => f.rating_stage_presence)),
      originality: avg(feedbackWithProfiles.map(f => f.rating_originality)),
      crowd_connection: avg(feedbackWithProfiles.map(f => f.rating_crowd_connection)),
    },
    recentFeedback: feedbackWithProfiles.slice(0, 10),
  };
};

// ============================================
// TIPS & CRITIQUES FUNCTIONS
// ============================================

export type TipsCritiquesTab = 'received' | 'given';

export interface FeedbackWithClip extends Feedback {
  clip?: {
    id: string;
    title: string;
    thumbnail_url: string;
    user_id: string;
  };
  clipOwner?: {
    id: string;
    display_name: string | null;
    stage_name: string | null;
    avatar_url: string | null;
  };
}

export interface TipsCritiquesSummary {
  totalCount: number;
  avgOverall: number;
  strengthCategory: string;
  focusCategory: string;
  topNextReps: string[];
}

// Get feedback RECEIVED on my clips
export const getReceivedFeedback = async (
  sort: SortMode = 'helpful',
  toneFilter?: ToneTag,
  intentFilter?: IntentTag,
  searchQuery?: string,
  cursor?: string,
  limit: number = 20
): Promise<{ data: FeedbackWithClip[]; nextCursor: string | null }> => {
  const { data: currentUser } = await supabase.auth.getUser();
  if (!currentUser?.user) throw new Error('Authentication required');

  // Get user's clips
  const { data: userClips } = await supabase
    .from('community_videos')
    .select('id, title, thumbnail_url, user_id')
    .eq('user_id', currentUser.user.id);

  if (!userClips || userClips.length === 0) {
    return { data: [], nextCursor: null };
  }

  const clipIds = userClips.map(c => c.id);
  const clipMap = new Map(userClips.map(c => [c.id, c]));

  // Build query
  let query = supabase
    .from('clip_feedback')
    .select('*')
    .in('clip_id', clipIds);

  // Apply filters
  if (toneFilter) {
    query = query.eq('tone_tag', toneFilter);
  }
  if (intentFilter) {
    query = query.eq('intent_tag', intentFilter);
  }

  // Apply sorting
  switch (sort) {
    case 'helpful':
      query = query.order('helpful_count', { ascending: false }).order('created_at', { ascending: false });
      break;
    case 'newest':
      query = query.order('created_at', { ascending: false });
      break;
    case 'highestRated':
      query = query.order('overall_score', { ascending: false });
      break;
  }

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw error;

  if (!data || data.length === 0) {
    return { data: [], nextCursor: null };
  }

  // Fetch author profiles
  const authorIds = [...new Set(data.map(f => f.author_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, stage_name, avatar_url')
    .in('id', authorIds);

  const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

  let results: FeedbackWithClip[] = data.map(f => ({
    ...f,
    author: profileMap.get(f.author_id) || null,
    clip: clipMap.get(f.clip_id) || undefined,
  }));

  // Apply search filter (client-side for now)
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    results = results.filter(f => {
      const clipTitle = f.clip?.title?.toLowerCase() || '';
      const authorName = (f.author?.stage_name || f.author?.display_name || '').toLowerCase();
      return clipTitle.includes(q) || authorName.includes(q);
    });
  }

  const nextCursor = data.length === limit ? data[data.length - 1].created_at : null;
  return { data: results, nextCursor };
};

// Get feedback I GAVE on others' clips
export const getGivenFeedback = async (
  sort: SortMode = 'newest',
  toneFilter?: ToneTag,
  intentFilter?: IntentTag,
  searchQuery?: string,
  cursor?: string,
  limit: number = 20
): Promise<{ data: FeedbackWithClip[]; nextCursor: string | null }> => {
  const { data: currentUser } = await supabase.auth.getUser();
  if (!currentUser?.user) throw new Error('Authentication required');

  // Build query
  let query = supabase
    .from('clip_feedback')
    .select('*')
    .eq('author_id', currentUser.user.id);

  // Apply filters
  if (toneFilter) {
    query = query.eq('tone_tag', toneFilter);
  }
  if (intentFilter) {
    query = query.eq('intent_tag', intentFilter);
  }

  // Apply sorting
  switch (sort) {
    case 'helpful':
      query = query.order('helpful_count', { ascending: false }).order('created_at', { ascending: false });
      break;
    case 'newest':
      query = query.order('created_at', { ascending: false });
      break;
    case 'highestRated':
      query = query.order('overall_score', { ascending: false });
      break;
  }

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw error;

  if (!data || data.length === 0) {
    return { data: [], nextCursor: null };
  }

  // Fetch clips
  const clipIds = [...new Set(data.map(f => f.clip_id))];
  const { data: clips } = await supabase
    .from('community_videos')
    .select('id, title, thumbnail_url, user_id')
    .in('id', clipIds);

  const clipMap = new Map(clips?.map(c => [c.id, c]) || []);

  // Fetch clip owners
  const ownerIds = [...new Set(clips?.map(c => c.user_id) || [])];
  const { data: ownerProfiles } = await supabase
    .from('profiles')
    .select('id, display_name, stage_name, avatar_url')
    .in('id', ownerIds);

  const ownerMap = new Map(ownerProfiles?.map(p => [p.id, p]) || []);

  let results: FeedbackWithClip[] = data.map(f => {
    const clip = clipMap.get(f.clip_id);
    return {
      ...f,
      clip: clip || undefined,
      clipOwner: clip ? ownerMap.get(clip.user_id) || undefined : undefined,
    };
  });

  // Apply search filter
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    results = results.filter(f => {
      const clipTitle = f.clip?.title?.toLowerCase() || '';
      const ownerName = (f.clipOwner?.stage_name || f.clipOwner?.display_name || '').toLowerCase();
      return clipTitle.includes(q) || ownerName.includes(q);
    });
  }

  const nextCursor = data.length === limit ? data[data.length - 1].created_at : null;
  return { data: results, nextCursor };
};

// Get summary for Tips & Critiques tab
export const getTipsCritiquesSummary = async (
  tab: TipsCritiquesTab
): Promise<TipsCritiquesSummary> => {
  const { data: currentUser } = await supabase.auth.getUser();
  if (!currentUser?.user) throw new Error('Authentication required');

  let feedbackData: any[] = [];

  if (tab === 'received') {
    // Get user's clips
    const { data: userClips } = await supabase
      .from('community_videos')
      .select('id')
      .eq('user_id', currentUser.user.id);

    if (userClips && userClips.length > 0) {
      const clipIds = userClips.map(c => c.id);
      const { data } = await supabase
        .from('clip_feedback')
        .select('*')
        .in('clip_id', clipIds);
      feedbackData = data || [];
    }
  } else {
    const { data } = await supabase
      .from('clip_feedback')
      .select('*')
      .eq('author_id', currentUser.user.id);
    feedbackData = data || [];
  }

  if (feedbackData.length === 0) {
    return {
      totalCount: 0,
      avgOverall: 0,
      strengthCategory: '',
      focusCategory: '',
      topNextReps: [],
    };
  }

  // Calculate averages
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const avg = (arr: number[]) => arr.length ? sum(arr) / arr.length : 0;

  const categoryAverages: Record<string, number> = {
    'Joke Craft': avg(feedbackData.map(f => f.rating_joke_craft)),
    'Timing & Pacing': avg(feedbackData.map(f => f.rating_timing_pacing)),
    'Stage Presence': avg(feedbackData.map(f => f.rating_stage_presence)),
    'Originality': avg(feedbackData.map(f => f.rating_originality)),
    'Crowd Connection': avg(feedbackData.map(f => f.rating_crowd_connection)),
  };

  const sortedCategories = Object.entries(categoryAverages).sort((a, b) => b[1] - a[1]);
  const strengthCategory = sortedCategories[0]?.[0] || '';
  const focusCategory = sortedCategories[sortedCategories.length - 1]?.[0] || '';

  // Calculate top 3 next reps (normalized)
  const nextRepCounts = new Map<string, number>();
  feedbackData.forEach(f => {
    if (f.next_rep) {
      const normalized = f.next_rep.toLowerCase().trim().replace(/\s+/g, ' ');
      if (normalized.length > 5) { // Skip very short ones
        nextRepCounts.set(normalized, (nextRepCounts.get(normalized) || 0) + 1);
      }
    }
  });

  const topNextReps = [...nextRepCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([rep]) => rep);

  return {
    totalCount: feedbackData.length,
    avgOverall: avg(feedbackData.map(f => Number(f.overall_score))),
    strengthCategory,
    focusCategory,
    topNextReps,
  };
};

// ============================================
// COMEDY STYLE PROFILE FUNCTIONS
// ============================================

export interface StyleProfile {
  overall100: number;
  overallStars: number;
  typeBreakdownPercent: Record<ComedyTypeKey, number>;
  primaryStyle: ComedyTypeKey;
  secondaryStyle: ComedyTypeKey;
  categoryAverages100: Record<string, number>;
  strengthCategory: string;
  focusCategory: string;
  sampleSize: number;
  isEarlyRead: boolean;
}

// Convert 1-5 rating to 0-100
const ratingTo100 = (rating: number): number => ((rating - 1) / 4) * 100;

// Calculate comedy type score for a single feedback
const calculateTypeScore = (
  feedback: any,
  typeKey: ComedyTypeKey
): number => {
  const weights = COMEDY_TYPE_WEIGHTS[typeKey];
  let score = 0;

  score += ratingTo100(feedback.rating_crowd_connection) * (weights.crowd_connection || 0);
  score += ratingTo100(feedback.rating_joke_craft) * (weights.joke_craft || 0);
  score += ratingTo100(feedback.rating_timing_pacing) * (weights.timing_pacing || 0);
  score += ratingTo100(feedback.rating_stage_presence) * (weights.stage_presence || 0);
  score += ratingTo100(feedback.rating_originality) * (weights.originality || 0);

  return score;
};

// Calculate recency + helpful weight
const calculateFeedbackWeight = (feedback: any): number => {
  const createdAt = new Date(feedback.created_at);
  const now = new Date();
  const ageDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  const recencyWeight = 1 / (1 + ageDays / 30);
  const helpfulBoost = 1 + Math.min(feedback.helpful_count || 0, 10) * 0.03;

  return recencyWeight * helpfulBoost;
};

// Get full comedy style profile
export const getStyleProfile = async (userId: string): Promise<StyleProfile> => {
  // Get user's clips
  const { data: userClips } = await supabase
    .from('community_videos')
    .select('id')
    .eq('user_id', userId);

  const defaultProfile: StyleProfile = {
    overall100: 0,
    overallStars: 0,
    typeBreakdownPercent: {
      storyteller: 20,
      oneLinerSniper: 20,
      crowdController: 20,
      wordWizard: 20,
      vibeTechnician: 20,
    },
    primaryStyle: 'storyteller',
    secondaryStyle: 'oneLinerSniper',
    categoryAverages100: {
      joke_craft: 0,
      timing_pacing: 0,
      stage_presence: 0,
      originality: 0,
      crowd_connection: 0,
    },
    strengthCategory: '',
    focusCategory: '',
    sampleSize: 0,
    isEarlyRead: true,
  };

  if (!userClips || userClips.length === 0) {
    return defaultProfile;
  }

  const clipIds = userClips.map(c => c.id);

  // Get all feedback for user's clips
  const { data: feedback, error } = await supabase
    .from('clip_feedback')
    .select('*')
    .in('clip_id', clipIds);

  if (error) throw error;

  if (!feedback || feedback.length === 0) {
    return defaultProfile;
  }

  // Calculate weighted aggregates
  let totalWeight = 0;
  const typeScores: Record<ComedyTypeKey, number> = {
    storyteller: 0,
    oneLinerSniper: 0,
    crowdController: 0,
    wordWizard: 0,
    vibeTechnician: 0,
  };
  const categoryTotals: Record<string, number> = {
    joke_craft: 0,
    timing_pacing: 0,
    stage_presence: 0,
    originality: 0,
    crowd_connection: 0,
  };
  let overallTotal = 0;

  feedback.forEach(f => {
    const weight = calculateFeedbackWeight(f);
    totalWeight += weight;

    // Calculate type scores
    Object.keys(typeScores).forEach(typeKey => {
      typeScores[typeKey as ComedyTypeKey] += calculateTypeScore(f, typeKey as ComedyTypeKey) * weight;
    });

    // Calculate category averages
    categoryTotals.joke_craft += ratingTo100(f.rating_joke_craft) * weight;
    categoryTotals.timing_pacing += ratingTo100(f.rating_timing_pacing) * weight;
    categoryTotals.stage_presence += ratingTo100(f.rating_stage_presence) * weight;
    categoryTotals.originality += ratingTo100(f.rating_originality) * weight;
    categoryTotals.crowd_connection += ratingTo100(f.rating_crowd_connection) * weight;

    // Overall score
    const feedbackOverall100 = (
      ratingTo100(f.rating_joke_craft) +
      ratingTo100(f.rating_timing_pacing) +
      ratingTo100(f.rating_stage_presence) +
      ratingTo100(f.rating_originality) +
      ratingTo100(f.rating_crowd_connection)
    ) / 5;
    overallTotal += feedbackOverall100 * weight;
  });

  // Normalize by total weight
  Object.keys(typeScores).forEach(key => {
    typeScores[key as ComedyTypeKey] /= totalWeight;
  });
  Object.keys(categoryTotals).forEach(key => {
    categoryTotals[key] /= totalWeight;
  });
  const overall100 = overallTotal / totalWeight;

  // Convert type scores to percentages
  const typeSum = Object.values(typeScores).reduce((a, b) => a + b, 0);
  const typeBreakdownPercent: Record<ComedyTypeKey, number> = {} as any;
  Object.keys(typeScores).forEach(key => {
    typeBreakdownPercent[key as ComedyTypeKey] = (typeScores[key as ComedyTypeKey] / typeSum) * 100;
  });

  // Find primary and secondary styles
  const sortedTypes = Object.entries(typeBreakdownPercent).sort((a, b) => b[1] - a[1]);
  const primaryStyle = sortedTypes[0][0] as ComedyTypeKey;
  const secondaryStyle = sortedTypes[1][0] as ComedyTypeKey;

  // Find strength and focus categories
  const categoryLabels: Record<string, string> = {
    joke_craft: 'Joke Craft',
    timing_pacing: 'Timing & Pacing',
    stage_presence: 'Stage Presence',
    originality: 'Originality',
    crowd_connection: 'Crowd Connection',
  };
  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const strengthCategory = categoryLabels[sortedCategories[0][0]] || '';
  const focusCategory = categoryLabels[sortedCategories[sortedCategories.length - 1][0]] || '';

  return {
    overall100,
    overallStars: Math.round((overall100 / 100) * 5 * 10) / 10,
    typeBreakdownPercent,
    primaryStyle,
    secondaryStyle,
    categoryAverages100: categoryTotals,
    strengthCategory,
    focusCategory,
    sampleSize: feedback.length,
    isEarlyRead: feedback.length < 5,
  };
};
