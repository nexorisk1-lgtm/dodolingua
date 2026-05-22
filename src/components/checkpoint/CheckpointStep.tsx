'use client'

/**
 * v9.9 — Checkpoint mixte A1 (vocab + grammaire).
 *
 * Composant dispatcher qui rend un step pioché depuis checkpoint_a1_steps.
 * Chaque step a un préfixe dans son type ("vocab_xxx" ou "grammar_xxx")
 * qui détermine quel sous-composant existant on délègue :
 *  - vocab_situation_qcm / vocab_qcm_audio / vocab_mini_dialog / vocab_gap_fill
 *    / vocab_association → VocabLessonStep
 *  - grammar_recognition / grammar_match / grammar_dialog / grammar_gap_fill
 *    → GrammarStepV6
 *
 * Pas de duplication de logique : on construit un step synthétique au format
 * attendu et on délègue à 100% au composant existant.
 */

import { VocabLessonStep, type VocabStepData } from '@/components/vocab/VocabLessonStep'
import { GrammarStepV6, type StepV6, type StepTypeV6 } from '@/components/grammar/GrammarStepV6'

export interface CheckpointStepData {
  id: string
  position: number
  source_kind: 'vocab' | 'grammar'
  step_type: string // ex: "vocab_situation_qcm" ou "grammar_recognition"
  content_json: any
}

interface Props {
  step: CheckpointStepData
  onContinue: (correct?: boolean) => void
  onBack: () => void
  canGoBack: boolean
  isLast: boolean
  userName?: string
  checkpointTitle?: string
}

export function CheckpointStep({ step, onContinue, onBack, canGoBack, isLast, userName, checkpointTitle }: Props) {
  if (step.source_kind === 'vocab') {
    const innerType = step.step_type.replace(/^vocab_/, '')
    const synthetic: VocabStepData = {
      id: step.id,
      position: step.position,
      phase: 5, // arbitraire, non utilisé pour les types qu'on rend ici
      type: innerType,
      content_json: step.content_json,
    }
    return (
      <VocabLessonStep
        step={synthetic}
        onContinue={onContinue}
        onBack={onBack}
        canGoBack={canGoBack}
        isLast={isLast}
        userName={userName}
        lessonTitle={checkpointTitle}
      />
    )
  }

  if (step.source_kind === 'grammar') {
    const innerType = step.step_type.replace(/^grammar_/, '') as StepTypeV6
    const synthetic: StepV6 = {
      id: step.id,
      position: step.position,
      type: innerType,
      content_json: step.content_json,
    }
    return (
      <GrammarStepV6
        step={synthetic}
        onContinue={onContinue}
        onBack={onBack}
        isLast={isLast}
        canGoBack={canGoBack}
        userName={userName}
        topicTitle={checkpointTitle}
      />
    )
  }

  return <div className="text-sm text-gray-500 italic">Source inconnue : {step.source_kind}</div>
}
