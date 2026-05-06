// Types TypeScript du modèle de données.
// À régénérer automatiquement quand le schéma évolue :
//   npm run db:types

export type LangCode = 'en-GB' | 'es-ES' | 'ar-SA' | 'ko-KR' | 'zh-CN'
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
export type LearnMode = 'oral' | 'complet'
export type QuestType = 'apprentissage' | 'revision' | 'pratique' | 'jeu'
export type QuestStatus = 'pending' | 'in_progress' | 'completed' | 'skipped'
export type LeagueTier = 'bronze' | 'argent' | 'or' | 'saphir' | 'rubis' | 'emeraude' | 'amethyste' | 'perle' | 'obsidienne' | 'diamant'
export type ChallengeType = 'solo' | 'duel' | 'tournament'
export type LangStatus = 'active' | 'paused'
export type ScolaireLevel =
  | 'cm1' | 'cm2' | '6e' | '5e' | '4e' | '3e'
  | '2nde' | '1ere' | 'term'
  | 'l1' | 'l2' | 'l3' | 'm1' | 'm2'
export type GrcLevel = 'junior' | 'confirme' | 'senior' | 'expert'
export type Goal = 'parler' | 'complet' | 'scolaire' | 'pro' | 'voyage' | 'grc' | 'plaisir'
export type CoachMode =
  | 'conversationnel' | 'hybride' | 'professeur'
  | 'business' | 'guide' | 'expert_grc' | 'culturel'

export interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface UserLanguage {
  user_id: string
  lang_code: LangCode
  status: LangStatus
  is_current: boolean
  cefr_global: CefrLevel | null
  cefr_co: CefrLevel | null
  cefr_ce: CefrLevel | null
  cefr_eo: CefrLevel | null
  cefr_ee: CefrLevel | null
  total_points: number
  weekly_points: number
  league_tier: LeagueTier
  daily_goal_min: 5 | 10 | 20
  added_at: string
  last_activity: string | null
}

export interface UserPreferences {
  user_id: string
  lang_code: LangCode
  goals: Goal[]
  scolaire_level: ScolaireLevel | null
  themes: string[]
  mode: LearnMode
  grc_enabled: boolean
  grc_level: GrcLevel | null
  ipa_display: 'permanent' | 'tap' | 'off'
  french_support_level: number
  notification_hour: number
  coach_modes_cached: CoachMode[]
  updated_at: string
}

export interface UserVoicePref {
  user_id: string
  lang_code: LangCode
  voice_name: string
  voice_lang: string
  is_local: boolean
  default_rate: 0.5 | 1.0 | 1.5
  updated_at: string
}

export interface Concept {
  id: string
  domain: string
  cefr_min: CefrLevel
  image_url: string | null
  tags: string[]
  created_at: string
}

export interface Translation {
  id: string
  concept_id: string
  lang_code: LangCode
  lemma: string
  ipa: string | null
  audio_url: string | null
  gender: string | null
  plural: string | null
  register: string | null
}

export interface DailyQuest {
  id: string
  user_id: string
  lang_code: LangCode
  date: string
  quest_type: QuestType
  status: QuestStatus
  content_ref: unknown
  points_earned: number
  completed_at: string | null
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile }
      user_languages: { Row: UserLanguage }
      user_preferences: { Row: UserPreferences }
      user_voice_pref: { Row: UserVoicePref }
      concepts: { Row: Concept }
      translations: { Row: Translation }
      daily_quests: { Row: DailyQuest }
      // (autres tables auto-générées via supabase gen types)
    }
  }
}
