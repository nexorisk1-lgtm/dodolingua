import { FlashcardsGame } from './Flashcards'
import { QuizGame } from './Quiz'
import { DictationGame } from './Dictation'
import { AudioRecognitionGame } from './AudioRecognition'
import { AssociationGame } from './Association'
import { SentenceBuilderGame } from './SentenceBuilder'
import { ListeningClozeGame } from './ListeningCloze'
import { SpeakingClozeGame } from './SpeakingCloze'
import { MemoryPairsGame } from './MemoryPairs'
import { StoryChoiceGame } from './StoryChoice'
import { PhoneticGame } from './Phonetic'
import { SpeedRoundGame } from './SpeedRound'
import type { GameId } from './types'

export const GAME_COMPONENTS: Record<GameId, React.ComponentType<any>> = {
  flashcards: FlashcardsGame,
  quiz: QuizGame,
  dictation: DictationGame,
  audio_recog: AudioRecognitionGame,
  association: AssociationGame,
  sentence: SentenceBuilderGame,
  listening_cloze: ListeningClozeGame,
  speaking_cloze: SpeakingClozeGame,
  memory: MemoryPairsGame,
  story: StoryChoiceGame,
  phonetic: PhoneticGame,
  speed: SpeedRoundGame,
}

export { GAME_LIST } from './types'
export type { GameProps, GameWord, GameResult, GameId } from './types'
